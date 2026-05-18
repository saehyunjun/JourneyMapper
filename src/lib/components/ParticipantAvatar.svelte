<!--
	ParticipantAvatar — a bits-ui avatar for one interviewee.

	Drop it in wherever a participant is shown or selectable. `size` controls
	the dimensions; `preview` wraps the avatar in a LinkPreview hover card with
	the participant's demographics, counts, and a link to their fingerprint.
	With `preview` off it renders a bare avatar, safe to nest inside a button.
-->
<script lang="ts" module>
	import interviewsRaw from '$lib/content/wctglpdemo-data/interviews_structured.json';
	import { annotations } from '$lib/content/wctglpdemo-data/analysis';

	type Meta = { turns: number; demographics: string; tagged: number };

	const META = new Map<string, Meta>();
	for (const iv of (
		interviewsRaw as {
			interviews: {
				interview_id: string;
				turn_count?: number;
				participant_metadata?: { demographics_raw?: string };
			}[];
		}
	).interviews) {
		META.set(iv.interview_id, {
			turns: iv.turn_count ?? 0,
			demographics: iv.participant_metadata?.demographics_raw ?? '',
			tagged: 0
		});
	}
	for (const a of annotations) {
		const m = META.get(a.interview_id);
		if (m && a.themes.length > 0) m.tagged++;
	}
</script>

<script lang="ts">
	import { Avatar, LinkPreview } from 'bits-ui';
	import { participantAvatarUrl } from '$lib/participant-avatars';
	import { participantLabel } from '$lib/content/wctglpdemo-data/analysis';

	let {
		interviewId,
		size = 'md',
		preview = false,
		src: srcOverride = null,
		class: className = ''
	}: {
		interviewId: string;
		size?: 'sm' | 'md' | 'lg' | 'xl';
		preview?: boolean;
		/** An uploaded avatar URL to show instead of the bundled image. */
		src?: string | null;
		class?: string;
	} = $props();

	const SIZES = {
		sm: 'size-7 text-[10px]',
		md: 'size-9 text-xs',
		lg: 'size-12 text-sm',
		xl: 'size-20 text-xl'
	} as const;

	const label = $derived(participantLabel(interviewId));
	const src = $derived(srcOverride ?? participantAvatarUrl(interviewId));
	const initials = $derived(interviewId.match(/\d+/)?.[0] ?? '?');
	const meta = $derived(META.get(interviewId));
</script>

{#snippet avatarEl(s: 'sm' | 'md' | 'lg' | 'xl', extra: string)}
	<Avatar.Root
		class="inline-flex shrink-0 items-center justify-center rounded-full bg-accent-mint/15 font-semibold uppercase text-accent-mint {SIZES[
			s
		]} {extra}"
	>
		<div class="flex h-full w-full items-center justify-center overflow-hidden rounded-full">
			{#if src}
				<Avatar.Image {src} alt={label} class="h-full w-full object-cover" />
			{/if}
			<Avatar.Fallback>{initials}</Avatar.Fallback>
		</div>
	</Avatar.Root>
{/snippet}

{#if preview}
	<LinkPreview.Root>
		<LinkPreview.Trigger
			href="/wctglpdemo/fingerprint?interview={interviewId}"
			class="inline-flex rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-mint"
		>
			{@render avatarEl(size, className)}
		</LinkPreview.Trigger>
		<LinkPreview.Content
			class="z-50 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-lg"
			sideOffset={8}
		>
			<div class="flex gap-3">
				{@render avatarEl('lg', '')}
				<div class="flex flex-col gap-0.5 text-sm">
					<h4 class="font-medium text-slate-800">{label}</h4>
					{#if meta?.demographics}
						<p class="text-xs text-slate-500">{meta.demographics}</p>
					{/if}
					{#if meta}
						<p class="text-xs text-slate-500">
							{meta.turns} turns · {meta.tagged} tagged {meta.tagged === 1
								? 'segment'
								: 'segments'}
						</p>
					{/if}
					<a
						href="/wctglpdemo/fingerprint?interview={interviewId}"
						class="mt-1 text-xs font-medium text-accent-mint hover:underline"
					>
						View fingerprint →
					</a>
				</div>
			</div>
		</LinkPreview.Content>
	</LinkPreview.Root>
{:else}
	{@render avatarEl(size, className)}
{/if}
