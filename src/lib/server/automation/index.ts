/**
 * Automation helpers — pure functions used by the daily cron.
 *
 * Kept separate from the route handler so:
 *   - they can be unit-tested without spinning up SvelteKit,
 *   - the cron route stays a thin orchestration layer (read state, call
 *     these helpers, write state),
 *   - the timezone math lives in one place.
 *
 * No DB calls, no fetch, no env access — pure functions in / out.
 */
import type { AutomationSetting } from '$lib/server/db/models/types';

// ---------------------------------------------------------------------------
// Cadence math
// ---------------------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Has enough time passed since `lastDraftAt` for a fresh draft to be due?
 *
 * We use simple "days elapsed" rather than calendar arithmetic because the
 * cron only runs once a day — so checking "is it >= N days since the last
 * one?" can never accidentally double-fire within the same UTC day.
 *
 * The thresholds are deliberately one less than the obvious value (6 instead
 * of 7 for weekly etc.) so the cron is forgiving of drift: if last week's
 * cron ran at 09:00 and this week's runs at 08:55, we still draft.
 */
export function isDraftDue(automation: AutomationSetting, now: Date): boolean {
	if (!automation.lastDraftAt) return true; // never drafted before
	const elapsedDays = (now.getTime() - automation.lastDraftAt.getTime()) / MS_PER_DAY;
	switch (automation.frequency) {
		case 'daily':
			return elapsedDays >= 0.9;
		case 'weekly':
			return elapsedDays >= 6.5;
		case 'biweekly':
			return elapsedDays >= 13.5;
		case 'monthly':
			return elapsedDays >= 27.5;
	}
}

// ---------------------------------------------------------------------------
// Draft-time gate
// ---------------------------------------------------------------------------

/**
 * Is `now` within the same hour as the user's configured draftTime?
 *
 * The cron runs hourly. We compare the user's local hour (in their timezone)
 * against the hour portion of draftTime. We intentionally ignore minutes so
 * that a cron firing at :02 past the hour still matches a draftTime of "08:00".
 */
export function isDraftTimeNow(automation: AutomationSetting, now: Date): boolean {
	const [hourStr] = automation.draftTime.split(':');
	const targetHour = Number(hourStr);
	const localParts = formatInTimezone(now, automation.timezone);
	return localParts.hour === targetHour;
}

// ---------------------------------------------------------------------------
// Timezone-aware schedule math
// ---------------------------------------------------------------------------

/**
 * Compute the UTC instant at which an approved post should be published,
 * given the user's preferred day-of-week + time-of-day in their timezone.
 *
 * Strategy:
 *   1. Express `now` in the user's timezone to get year/month/day/etc.
 *   2. For each candidate (today, today+1, today+2, …), check whether it
 *      lands on the target weekday and is still in the future at the
 *      target time-of-day.
 *   3. Return the first match as a UTC Date.
 *
 * Why iterate instead of one-shot arithmetic? Daylight-saving transitions
 * mean "add 5 days" can produce the wrong UTC instant by an hour. Doing it
 * by walking calendar days in the user's timezone sidesteps DST entirely.
 *
 * For frequency='daily' there's no `publishDayOfWeek` constraint — we just
 * pick the next occurrence of the target time, which is "today if it hasn't
 * happened yet, otherwise tomorrow."
 */
export function computeNextPublishTime(
	automation: AutomationSetting,
	now: Date
): Date {
	const [hourStr, minuteStr] = automation.publishTime.split(':');
	const targetHour = Number(hourStr);
	const targetMinute = Number(minuteStr);
	const targetDay = automation.publishDayOfWeek; // null when frequency='daily'

	// Walk forward up to 14 days — covers any weekly/biweekly target plus
	// a generous DST safety margin.
	for (let offset = 0; offset < 14; offset++) {
		const candidateUtc = candidateForOffset(now, offset, targetHour, targetMinute, automation.timezone);

		// Reject candidates in the past — happens when offset=0 and we're
		// already past the target time today.
		if (candidateUtc.getTime() <= now.getTime()) continue;

		// For daily frequency, the first future candidate wins.
		if (automation.frequency === 'daily' || targetDay === null) {
			return candidateUtc;
		}

		// Otherwise the candidate must land on the target weekday in the
		// user's timezone (not UTC — Sunday in IST may be Saturday in UTC).
		const localWeekday = getWeekdayInTimezone(candidateUtc, automation.timezone);
		if (localWeekday === targetDay) return candidateUtc;
	}

	// Should be unreachable for sane inputs. Falls back to "publish now"
	// rather than throwing so a misconfiguration doesn't kill the whole cron.
	return now;
}

/**
 * Build a UTC Date that, when rendered in `timezone`, falls on
 * `today + offset days` at HH:MM.
 *
 * Uses Intl.DateTimeFormat to peek at what the *date in that timezone* is
 * `offset` days from now, then composes a local-naive Y-M-D H:M and converts
 * it back to UTC by binary-searching the offset (the only reliable approach
 * across DST transitions without a date library).
 */
function candidateForOffset(
	now: Date,
	offset: number,
	hour: number,
	minute: number,
	timezone: string
): Date {
	// Get year/month/day in the user's timezone for `now + offset days`.
	const shifted = new Date(now.getTime() + offset * MS_PER_DAY);
	const parts = formatInTimezone(shifted, timezone);

	// Compose a "local clock time" string and find the UTC instant that maps
	// to it. We do a quick search: try the naive UTC interpretation, measure
	// the timezone offset at that moment, and correct.
	const naiveIso = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(hour)}:${pad(minute)}:00`;
	const naiveUtc = new Date(naiveIso + 'Z'); // interpret as UTC first

	// Measure the offset of `naiveUtc` in the target timezone.
	const tzOffsetMinutes = timezoneOffsetMinutes(naiveUtc, timezone);

	// If the user's timezone is UTC+5:30 and we wrote "09:00" assuming UTC,
	// the actual UTC instant for 09:00 local is 03:30 UTC — i.e. earlier by
	// the offset.
	return new Date(naiveUtc.getTime() - tzOffsetMinutes * 60 * 1000);
}

/**
 * Returns the timezone offset (in minutes from UTC) that applies at the given
 * instant in the given timezone. Positive for east of UTC.
 *
 * Worked-out via Intl: format the instant in the target zone and in UTC,
 * then diff the two clock readings.
 */
function timezoneOffsetMinutes(instant: Date, timezone: string): number {
	const tzParts = formatInTimezone(instant, timezone);
	const utcParts = formatInTimezone(instant, 'UTC');

	const tzMs = Date.UTC(
		tzParts.year,
		tzParts.month - 1,
		tzParts.day,
		tzParts.hour,
		tzParts.minute
	);
	const utcMs = Date.UTC(
		utcParts.year,
		utcParts.month - 1,
		utcParts.day,
		utcParts.hour,
		utcParts.minute
	);
	return Math.round((tzMs - utcMs) / 60000);
}

interface DateParts {
	year: number;
	month: number; // 1..12
	day: number;
	hour: number;
	minute: number;
	weekday: number; // 0..6 (Sun..Sat)
}

function formatInTimezone(date: Date, timezone: string): DateParts {
	// Intl.DateTimeFormat with all the parts we need, in the target timezone.
	const fmt = new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		weekday: 'short'
	});

	const parts = fmt.formatToParts(date);
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

	const weekdayMap: Record<string, number> = {
		Sun: 0,
		Mon: 1,
		Tue: 2,
		Wed: 3,
		Thu: 4,
		Fri: 5,
		Sat: 6
	};

	// Intl returns hour as "24" at midnight in some locales — normalise.
	const rawHour = Number(get('hour'));
	const hour = rawHour === 24 ? 0 : rawHour;

	return {
		year: Number(get('year')),
		month: Number(get('month')),
		day: Number(get('day')),
		hour,
		minute: Number(get('minute')),
		weekday: weekdayMap[get('weekday')] ?? 0
	};
}

function getWeekdayInTimezone(date: Date, timezone: string): number {
	return formatInTimezone(date, timezone).weekday;
}

function pad(n: number): string {
	return n < 10 ? `0${n}` : String(n);
}
