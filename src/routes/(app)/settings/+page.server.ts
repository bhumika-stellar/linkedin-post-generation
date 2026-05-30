import type { PageServerLoad } from './$types';
import { UserModel, AutomationSettingModel } from '$lib/server/db/models';
import { listJournalPages } from '$lib/server/notion';
import { DEFAULT_MODEL } from '$lib/server/ai';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	// The (app) layout already redirects unauthenticated users, but we guard
	// here too so TypeScript knows session.user.id is defined below.
	if (!session?.user?.id) return { settings: null, automation: null, notionPages: [] };

	const user = await UserModel.findById(session.user.id);
	const automation = await AutomationSettingModel.findByUser(session.user.id);

	// If Notion is configured, pre-load the journal page list so the
	// "specific page" picker has options without a second round-trip.
	// Failures are swallowed silently — the picker just shows an empty list,
	// the user can re-check Notion config in the Notion section above.
	let notionPages: { id: string; title: string }[] = [];
	if (user?.notionAccessToken && user?.notionJournalPageId) {
		try {
			const pages = await listJournalPages({
				apiKey: user.notionAccessToken,
				journalPageId: user.notionJournalPageId
			});
			notionPages = pages.map((p) => ({ id: p.id, title: p.title }));
		} catch {
			// Notion call failed; just show no pages.
		}
	}

	return {
		settings: {
			preferredModel: user?.preferredModel ?? DEFAULT_MODEL,
			// Never send raw secrets to the client — just whether they exist.
			hasNotionToken: !!user?.notionAccessToken,
			notionJournalPageId: user?.notionJournalPageId ?? '',
			hasLinkedinToken: !!user?.linkedinAccessToken,
			linkedinMemberUrn: user?.linkedinMemberUrn ?? '',
			linkedinTokenExpiresAt: user?.linkedinTokenExpiresAt?.toISOString() ?? null,
			userEmail: user?.email ?? '',
			userName: user?.name ?? ''
		},
		automation: automation
			? {
					enabled: automation.enabled,
					frequency: automation.frequency,
					sourceType: automation.sourceType,
					sourcePageId: automation.sourcePageId,
					sourceLookbackDays: automation.sourceLookbackDays,
					prompt: automation.prompt,
					draftTime: automation.draftTime,
					publishDayOfWeek: automation.publishDayOfWeek,
					publishTime: automation.publishTime,
					timezone: automation.timezone,
					lastDraftAt: automation.lastDraftAt?.toISOString() ?? null
				}
			: null,
		notionPages,
		appUrl: process.env.PUBLIC_APP_URL ?? 'http://localhost:5176'
	};
};
