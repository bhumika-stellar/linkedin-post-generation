/**
 * AutomationSettingModel — data-access layer for the `automation_setting` table.
 *
 * One row per user. The row is created lazily — we don't insert a row at user
 * signup; we wait until the user actually saves anything in Settings →
 * Automation. Until then, "no row" is semantically equivalent to "automation
 * is off." The cron's eligibility filter handles this implicitly: a left join
 * with `enabled=true` only matches users who have a row.
 *
 * `upsert()` is the workhorse here: the Settings page sends partial updates,
 * and we don't want every PATCH to first do a SELECT then INSERT-or-UPDATE.
 * Postgres's ON CONFLICT does the merge atomically.
 */
import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '../index';
import { automationSettings } from '../schema/automation';
import { users } from '../schema/auth';
import type { AutomationSetting, NewAutomationSetting, User } from './types';

export const AutomationSettingModel = {
	async findByUser(userId: string): Promise<AutomationSetting | undefined> {
		const [row] = await db
			.select()
			.from(automationSettings)
			.where(eq(automationSettings.userId, userId));
		return row;
	},

	/**
	 * Insert-or-update. The user's first save creates the row; subsequent saves
	 * merge their fields in. We always set userId so the ON CONFLICT clause has
	 * a key to match on.
	 *
	 * Why upsert instead of separate create/update? The Settings UI doesn't
	 * know whether a row exists — and shouldn't have to. Hiding that behind a
	 * single primitive keeps the API route a one-liner.
	 */
	async upsert(
		userId: string,
		data: Omit<NewAutomationSetting, 'userId'>
	): Promise<AutomationSetting> {
		const [row] = await db
			.insert(automationSettings)
			.values({ userId, ...data })
			.onConflictDoUpdate({
				target: automationSettings.userId,
				set: { ...data, updatedAt: new Date() }
			})
			.returning();
		return row;
	},

	/**
	 * Bumps the cadence clock after a successful draft. Separate method to
	 * keep the call site in the cron readable: `touchLastDraftAt(userId)`
	 * reads as the action it is, vs `upsert(userId, { lastDraftAt: now })`
	 * which buries the intent in a generic update.
	 */
	async touchLastDraftAt(userId: string, when: Date): Promise<void> {
		await db
			.update(automationSettings)
			.set({ lastDraftAt: when, updatedAt: new Date() })
			.where(eq(automationSettings.userId, userId));
	},

	/**
	 * Returns users whose automation is fully configured and enabled —
	 * the cron's per-iteration eligibility check.
	 *
	 * Conditions, all required:
	 *   - automation_setting.enabled = true
	 *   - automation_setting.prompt is non-null (we'd refuse to generate from empty)
	 *   - user.linkedin_access_token + linkedin_member_urn set (publish target)
	 *   - user.notion_access_token + notion_journal_page_id set (source)
	 *
	 * Returns the user joined with their automation row in one shot so the
	 * cron has everything it needs without a follow-up query per user.
	 */
	async findEligible(): Promise<Array<{ user: User; automation: AutomationSetting }>> {
		const rows = await db
			.select({ user: users, automation: automationSettings })
			.from(automationSettings)
			.innerJoin(users, eq(users.id, automationSettings.userId))
			.where(
				and(
					eq(automationSettings.enabled, true),
					isNotNull(automationSettings.prompt),
					isNotNull(users.linkedinAccessToken),
					isNotNull(users.linkedinMemberUrn),
					isNotNull(users.notionAccessToken),
					isNotNull(users.notionJournalPageId)
				)
			);

		return rows;
	}
};
