import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { templates } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();

	const userTemplates = await db
		.select()
		.from(templates)
		.where(eq(templates.userId, session!.user!.id!))
		.orderBy(desc(templates.createdAt));

	return { templates: userTemplates };
};
