<!--
	BlurbText — renders a Haiku-generated string that may contain inline
	references using the syntax  [surface text](ref:KIND:ID)  where KIND is
	one of "theme" / "subtheme" / "finding" / "interview".

	Matched refs become buttons that fire `onref` with the parsed kind + id.
	Anything that doesn't match — including malformed refs or refs whose
	target the caller refuses (no handler / unknown id) — falls through as
	plain text. That gives us soft-fail behaviour: if Haiku hallucinates an
	id, the reader sees the surface text intact rather than a broken link.
-->
<script lang="ts">
	export type RefKind = 'theme' | 'subtheme' | 'finding' | 'interview';

	type Props = {
		text: string;
		onref?: (kind: RefKind, id: string) => void;
		/** Optional id allow-list per kind. When provided, refs to ids not
		 *  in the set render as plain text instead of buttons. */
		known?: Partial<Record<RefKind, Set<string>>>;
	};

	let { text, onref, known }: Props = $props();

	type Segment =
		| { kind: 'text'; value: string }
		| { kind: 'ref'; refKind: RefKind; refId: string; surface: string };

	const REF_KINDS: RefKind[] = ['theme', 'subtheme', 'finding', 'interview'];
	const PATTERN = /\[([^\]\n]+)\]\(ref:([a-z]+):([a-zA-Z0-9_\-]+)\)/g;

	const segments = $derived.by<Segment[]>(() => {
		const out: Segment[] = [];
		let lastIndex = 0;
		for (const m of text.matchAll(PATTERN)) {
			const [full, surface, rawKind, refId] = m;
			const start = m.index ?? 0;
			if (start > lastIndex) out.push({ kind: 'text', value: text.slice(lastIndex, start) });
			const refKind = REF_KINDS.includes(rawKind as RefKind) ? (rawKind as RefKind) : null;
			const allowed = refKind && (!known?.[refKind] || known[refKind]!.has(refId));
			if (refKind && allowed) {
				out.push({ kind: 'ref', refKind, refId, surface });
			} else {
				out.push({ kind: 'text', value: surface });
			}
			lastIndex = start + full.length;
		}
		if (lastIndex < text.length) out.push({ kind: 'text', value: text.slice(lastIndex) });
		return out;
	});
</script>

{#each segments as seg, i (i)}
	{#if seg.kind === 'text'}{seg.value}{:else if onref}<button
			type="button"
			class="blurb-ref"
			onclick={() => onref?.(seg.refKind, seg.refId)}
			aria-label={`Open ${seg.refKind} ${seg.refId}`}
		>{seg.surface}</button>{:else}{seg.surface}{/if}
{/each}

<style>
	.blurb-ref {
		display: inline;
		border: 0;
		background: transparent;
		padding: 0;
		font: inherit;
		color: inherit;
		text-decoration: underline;
		text-decoration-color: rgba(48, 47, 40, 0.3);
		text-decoration-thickness: 1px;
		text-underline-offset: 3px;
		cursor: pointer;
		transition: color 160ms ease, text-decoration-color 160ms ease;
	}
	.blurb-ref:hover,
	.blurb-ref:focus-visible {
		color: var(--accent-mint, #0c8265);
		text-decoration-color: currentColor;
		outline: none;
	}
</style>
