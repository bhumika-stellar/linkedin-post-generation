/**
 * Email notifications via Resend.
 *
 * Single Responsibility: this module only knows how to send emails. It does
 * not know about posts, crons, or databases — callers pass in the data they
 * want emailed.
 *
 * Fail-soft design: a failed email logs a warning but never throws. A broken
 * notification should not prevent a draft from being created or a post from
 * being published.
 *
 * Env var required: RESEND_API_KEY (free tier: 3,000 emails/month)
 */
import { Resend } from 'resend';
import { env } from '$env/dynamic/private';

function getClient(): Resend | null {
	if (!env.RESEND_API_KEY) {
		console.warn('[email] RESEND_API_KEY not set — skipping email');
		return null;
	}
	return new Resend(env.RESEND_API_KEY);
}

/**
 * Notify the user that a new auto-draft is ready for review.
 *
 * @param to       - Recipient email address (from user.email)
 * @param postId   - ID of the created post (used to build the deep link)
 * @param preview  - First ~100 chars of the generated post for context
 * @param appUrl   - Base URL of the app (e.g. https://postgen.example.com)
 */
export async function sendDraftReadyEmail(
	to: string,
	postId: string,
	preview: string,
	appUrl: string = 'http://localhost:5176'
): Promise<void> {
	const resend = getClient();
	if (!resend) return;

	const postUrl = `${appUrl}/posts?refine=${encodeURIComponent(postId)}`;

	try {
		await resend.emails.send({
			from: 'PostGen <onboarding@resend.dev>',
			to,
			subject: 'New draft ready for review',
			html: `
				<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
					<h2 style="margin-bottom: 4px;">A new draft is waiting for you</h2>
					<p style="color: #666; margin-top: 0;">Your automation generated a LinkedIn post from your latest Notion notes.</p>
					<div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
						<p style="margin: 0; color: #333; font-size: 14px;">${escapeHtml(preview)}…</p>
					</div>
					<a href="${postUrl}"
					   style="display: inline-block; background: #171717; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px;">
						Review &amp; refine
					</a>
					<p style="color: #999; font-size: 12px; margin-top: 24px;">
						You're receiving this because you enabled auto-posting in PostGen.
					</p>
				</div>
			`
		});
	} catch (err) {
		console.warn('[email] Failed to send draft-ready notification:', err);
	}
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
