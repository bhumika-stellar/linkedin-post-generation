import type { PageServerLoad } from './$types';
import { TemplateModel } from '$lib/server/db/models';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();

	const templates = await TemplateModel.findByUser(session!.user!.id!);

	return { templates };
};
