/**
 * Avatar upload endpoint for participant profiles.
 *
 * The participant drawer POSTs a multipart form { interviewId, file } here.
 * In dev the image is written under static/content-assets/avatars/ and the
 * served URL is stored on the profile. In prod the image is uploaded to
 * Vercel Blob and the Blob's public URL is stored. The filename carries a
 * timestamp so a replaced avatar busts the browser cache.
 */
import { json, error } from '@sveltejs/kit';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { put } from '@vercel/blob';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
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

	let avatarUrl: string;
	if (dev) {
		mkdirSync(resolve(AVATAR_DIR), { recursive: true });
		writeFileSync(resolve(AVATAR_DIR, filename), Buffer.from(await file.arrayBuffer()));
		avatarUrl = `/content-assets/avatars/${filename}`;
	} else {
		if (!env.BLOB_READ_WRITE_TOKEN) {
			error(500, 'Blob storage is not configured — set BLOB_READ_WRITE_TOKEN.');
		}
		const blob = await put(`avatars/${filename}`, file, {
			access: 'public',
			contentType: file.type,
			token: env.BLOB_READ_WRITE_TOKEN
		});
		avatarUrl = blob.url;
	}

	return json({ profile: await saveProfile(interviewId, { avatar_url: avatarUrl }) });
};
