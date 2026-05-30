/**
 * UserModel — thin data-access layer for the `users` table.
 *
 * The `users` table is created and owned by Auth.js (via the Drizzle adapter),
 * but it has been extended with application-specific columns:
 *   - openrouterApiKey       — per-user OpenRouter key.
 *   - preferredModel         — last-selected model ID.
 *   - notionAccessToken      — Notion integration secret.
 *   - notionWorkspaceName    — display label for the connected Notion workspace.
 *   - notionJournalPageId    — root Notion page whose sub-pages are sources.
 *   - linkedinAccessToken    — 60-day LinkedIn OAuth token, pasted in Settings.
 *   - linkedinMemberUrn      — urn:li:person:<sub>, derived from /v2/userinfo.
 *   - linkedinTokenExpiresAt — best-effort expiry hint for the UI.
 *
 * All methods are async and return plain objects (no ORM proxies).
 */
import { eq } from 'drizzle-orm';
import { db } from '../index';
import { users } from '../schema/auth';
import type { User } from './types';

// Whitelist of fields that are safe for the user to update via Settings.
// Centralising this here means the API route stays a thin pass-through and
// any new safe field only has to be added in one place.
type UpdatableUserFields = Partial<
	Pick<
		User,
		| 'name'
		| 'openrouterApiKey'
		| 'preferredModel'
		| 'notionAccessToken'
		| 'notionWorkspaceName'
		| 'notionJournalPageId'
		| 'linkedinAccessToken'
		| 'linkedinMemberUrn'
		| 'linkedinTokenExpiresAt'
	>
>;

export const UserModel = {
	async findById(id: string): Promise<User | undefined> {
		const [user] = await db.select().from(users).where(eq(users.id, id));
		return user;
	},

	async findByEmail(email: string): Promise<User | undefined> {
		const [user] = await db.select().from(users).where(eq(users.email, email));
		return user;
	},

	async update(id: string, data: UpdatableUserFields) {
		const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
		return updated;
	},

	/**
	 * Clear the LinkedIn columns in one shot. Used by the disconnect endpoint.
	 * Distinct from `update({ linkedinAccessToken: null, ... })` for clarity at
	 * call sites — disconnecting is a meaningful operation, not a partial edit.
	 */
	async disconnectLinkedin(id: string) {
		const [updated] = await db
			.update(users)
			.set({
				linkedinAccessToken: null,
				linkedinMemberUrn: null,
				linkedinTokenExpiresAt: null
			})
			.where(eq(users.id, id))
			.returning();
		return updated;
	}
};
