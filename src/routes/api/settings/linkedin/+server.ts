/**
 * /api/settings/linkedin
 *
 *   POST   — verify a pasted LinkedIn access token, derive the member URN
 *            from /v2/userinfo, and persist both on the user row. Returns
 *            the connection summary so the UI can show "Connected as <name>".
 *
 *   DELETE — clear the stored LinkedIn token + URN (disconnect).
 *
 * Why two HTTP methods on one route?
 *   They both target "the user's LinkedIn connection" as a singular resource,
 *   so by REST conventions they belong on the same path. POST = create/replace,
 *   DELETE = remove.
 *
 * Why verify on the server?
 *   We could just store whatever the user pastes, but verifying immediately
 *   gives instant "Connected as Bhumika" feedback and surfaces typos before
 *   they cause a silent failure inside the cron a week later.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { UserModel } from '$lib/server/db/models';
import { verifyToken } from '$lib/server/linkedin';

export const POST: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) error(401, 'Not authenticated');

	const { accessToken } = await event.request.json();
	if (!accessToken || typeof accessToken !== 'string') {
		error(400, 'accessToken is required');
	}

	let verified;
	try {
		verified = await verifyToken(accessToken);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Token verification failed';
		// 422 (Unprocessable Entity) is the right status for "syntax was fine
		// but the value didn't validate against an external service."
		error(422, message);
	}

	await UserModel.update(session.user.id, {
		linkedinAccessToken: accessToken,
		linkedinMemberUrn: verified.memberUrn,
		linkedinTokenExpiresAt: verified.expiresAtHint
	});

	return json({
		memberUrn: verified.memberUrn,
		memberName: verified.memberName,
		memberEmail: verified.memberEmail,
		expiresAt: verified.expiresAtHint.toISOString()
	});
};

export const DELETE: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) error(401, 'Not authenticated');

	await UserModel.disconnectLinkedin(session.user.id);

	return json({ message: 'LinkedIn disconnected' });
};
