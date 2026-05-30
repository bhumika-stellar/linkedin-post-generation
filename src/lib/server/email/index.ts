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

const PROD_URL = 'https://linkedin-post-generation.vercel.app';

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
	appUrl: string = PROD_URL
): Promise<void> {
	const resend = getClient();
	if (!resend) return;

	const baseUrl = appUrl === 'http://localhost:5176' ? PROD_URL : appUrl;
	const postUrl = `${baseUrl}/posts?refine=${encodeURIComponent(postId)}`;

	try {
		await resend.emails.send({
			from: 'PostGen <onboarding@resend.dev>',
			to,
			subject: '✍️ Your LinkedIn draft is ready for review',
			html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <!-- Header -->
        <tr><td style="background:#0a0a0a;border-radius:12px 12px 0 0;padding:28px 32px;">
          <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">PostGen</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:32px;">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0a0a0a;letter-spacing:-0.5px;">
            Your draft is ready
          </h1>
          <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.5;">
            PostGen generated a LinkedIn post from your latest Notion notes. Review it before it goes live.
          </p>

          <!-- Preview box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="background:#f9fafb;border:1px solid #e5e7eb;border-left:3px solid #0a0a0a;border-radius:6px;padding:16px 18px;">
              <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${escapeHtml(preview)}…</p>
            </td></tr>
          </table>

          <!-- CTA button -->
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#0a0a0a;border-radius:8px;">
              <a href="${postUrl}"
                 style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.1px;">
                Review &amp; refine →
              </a>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:20px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
            You're receiving this because you enabled automation in PostGen.<br>
            <a href="${baseUrl}/settings" style="color:#6b7280;text-decoration:underline;">Manage settings</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
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
