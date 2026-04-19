import type { PageServerLoad } from './$types';
import { PostModel } from '$lib/server/db/models';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();

	const posts = await PostModel.findByUser(session!.user!.id!);

	return { posts };
};
