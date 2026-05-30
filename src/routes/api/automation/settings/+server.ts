/**
 * PATCH /api/automation/settings
 *
 * Partial update of the user's automation_setting row. Backed by an UPSERT
 * so the user's first save creates the row and subsequent saves merge fields.
 *
 * The request body is whitelist-validated: only known fields are accepted,
 * and each one is type-checked. Anything else is ignored. This is the
 * "thin route, fat model" pattern from the project philosophy — the route's
 * only job is auth + input validation; the model owns the persistence logic.
 *
 * Special validation: enabling automation requires that the user has all
 * prerequisites set (LinkedIn connected, Notion configured, prompt non-empty).
 * The client UI greys out the toggle when those aren't met, but we re-check
 * here because we never trust the client.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { UserModel, AutomationSettingModel } from '$lib/server/db/models';
import type {
	AutomationFrequency,
	AutomationSourceType
} from '$lib/server/db/models/types';

const FREQUENCIES = new Set<AutomationFrequency>(['daily', 'weekly', 'biweekly', 'monthly']);
const SOURCE_TYPES = new Set<AutomationSourceType>(['notion_page', 'notion_recent']);

export const PATCH: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) error(401, 'Not authenticated');

	const body = await event.request.json();

	// Build the update object field-by-field, validating each as we go.
	const updates: Record<string, unknown> = {};

	if ('enabled' in body) {
		if (typeof body.enabled !== 'boolean') error(400, 'enabled must be a boolean');
		updates.enabled = body.enabled;
	}

	if ('frequency' in body) {
		if (!FREQUENCIES.has(body.frequency)) error(400, 'frequency is invalid');
		updates.frequency = body.frequency;
	}

	if ('sourceType' in body) {
		if (!SOURCE_TYPES.has(body.sourceType)) error(400, 'sourceType is invalid');
		updates.sourceType = body.sourceType;
	}

	if ('sourcePageId' in body) {
		if (body.sourcePageId !== null && typeof body.sourcePageId !== 'string') {
			error(400, 'sourcePageId must be a string or null');
		}
		updates.sourcePageId = body.sourcePageId;
	}

	if ('sourceLookbackDays' in body) {
		const n = Number(body.sourceLookbackDays);
		if (!Number.isInteger(n) || n < 1 || n > 90) {
			error(400, 'sourceLookbackDays must be an integer between 1 and 90');
		}
		updates.sourceLookbackDays = n;
	}

	if ('prompt' in body) {
		if (body.prompt !== null && typeof body.prompt !== 'string') {
			error(400, 'prompt must be a string or null');
		}
		updates.prompt = body.prompt;
	}

	if ('publishDayOfWeek' in body) {
		if (body.publishDayOfWeek !== null) {
			const n = Number(body.publishDayOfWeek);
			if (!Number.isInteger(n) || n < 0 || n > 6) {
				error(400, 'publishDayOfWeek must be 0..6 or null');
			}
			updates.publishDayOfWeek = n;
		} else {
			updates.publishDayOfWeek = null;
		}
	}

	if ('draftTime' in body) {
		if (typeof body.draftTime !== 'string' || !/^\d{2}:\d{2}$/.test(body.draftTime)) {
			error(400, 'draftTime must be HH:MM');
		}
		updates.draftTime = body.draftTime;
	}

	if ('publishTime' in body) {
		if (typeof body.publishTime !== 'string' || !/^\d{2}:\d{2}$/.test(body.publishTime)) {
			error(400, 'publishTime must be HH:MM');
		}
		updates.publishTime = body.publishTime;
	}

	if ('timezone' in body) {
		if (typeof body.timezone !== 'string') error(400, 'timezone must be a string');
		updates.timezone = body.timezone;
	}

	if (Object.keys(updates).length === 0) {
		error(400, 'No valid fields to update');
	}

	// Server-side prerequisite check when turning automation ON.
	// We re-fetch state from the DB rather than trust the client.
	if (updates.enabled === true) {
		const user = await UserModel.findById(session.user.id);
		const existing = await AutomationSettingModel.findByUser(session.user.id);

		// Effective prompt = either what the user just sent, or what's already saved.
		const effectivePrompt =
			'prompt' in updates ? (updates.prompt as string | null) : existing?.prompt;

		const missing: string[] = [];
		if (!user?.linkedinAccessToken || !user?.linkedinMemberUrn) missing.push('LinkedIn connection');
		if (!user?.notionAccessToken || !user?.notionJournalPageId) missing.push('Notion configuration');
		if (!effectivePrompt || !effectivePrompt.trim()) missing.push('prompt');

		if (missing.length > 0) {
			error(
				400,
				`Cannot enable automation — missing: ${missing.join(', ')}.`
			);
		}
	}

	const row = await AutomationSettingModel.upsert(session.user.id, updates);
	return json({ automation: row });
};
