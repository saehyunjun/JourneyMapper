/**
 * Avatar upload endpoint for participant profiles.
 *
 * The participant drawer POSTs a multipart form { interviewId, file } here; the
 * image is written under static/content-assets/avatars and its served URL is
 * stored on the participant's profile. The filename carries a timestamp so a
 * replaced avatar busts the browser cache.
 *
 * Note: this writes into the source tree, so it is a dev/demo-time operation —
 * see the matching note in $lib/server/highlights.
 */
import { json, error } from '@sveltejs/kit';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { saveProfile } from '$lib/server/participant-profiles';
import type { RequestHandler } from './$types';

const AVATAR_DIR = 'static/content-assets/avatars';
const MAX_BYTES = 5 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/jpg': 'jpg',
	'image/webp': 'webp',
	'image/gif': 'gif'
};

export const POST: RequestHandler = async ({ request }) => {
	const form = await request.formData().catch(() => null);
	if (!form) error(400, 'Expected a multipart form body.');

	const interviewId = String(form.get('interviewId') ?? '').trim();
	const file = form.get('file');

	if (!interviewId) error(400, 'Missing interviewId.');
	if (!(file instanceof File) || file.size === 0) error(400, 'Missing avatar image file.');

	const ext = EXT_BY_TYPE[file.type];
	if (!ext) error(400, `Unsupported image type "${file.type}".`);
	if (file.size > MAX_BYTES) error(413, 'Avatar image must be 5 MB or smaller.');

	const filename = `${interviewId}-${Date.now()}.${ext}`;
	mkdirSync(resolve(AVATAR_DIR), { recursive: true });
	writeFileSync(resolve(AVATAR_DIR, filename), Buffer.from(await file.arrayBuffer()));

	const avatarUrl = `/content-assets/avatars/${filename}`;
	return json({ profile: saveProfile(interviewId, { avatar_url: avatarUrl }) });
};
