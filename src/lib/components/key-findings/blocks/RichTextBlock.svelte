<!--
	RichTextBlock — inline rich-text editing for a card's insight text.

	Wraps a TipTap (ProseMirror) editor. The serialised HTML is the source of
	truth on the block; `onChange` fires on every edit so the store can persist
	and coalesce it into one undo step. When `editable` is false (read / present
	mode) the toolbar hides and the prose renders statically.
-->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Underline from '@tiptap/extension-underline';
	import Link from '@tiptap/extension-link';
	import Highlight from '@tiptap/extension-highlight';
	import Placeholder from '@tiptap/extension-placeholder';
	import {
		Bold,
		Italic,
		Underline as UnderlineIcon,
		Heading2,
		Heading3,
		List,
		ListOrdered,
		Highlighter,
		Link as LinkIcon,
		Quote
	} from '@lucide/svelte';

	let {
		html,
		editable = true,
		fontScale = 1,
		onChange
	}: { html: string; editable?: boolean; fontScale?: number; onChange: (html: string) => void } = $props();

	let element = $state<HTMLDivElement>();
	let editor = $state<Editor>();
	// Mirror of the editor's active marks/nodes so the toolbar can reflect state.
	let active = $state<Record<string, boolean>>({});

	function refresh() {
		if (!editor) return;
		active = {
			bold: editor.isActive('bold'),
			italic: editor.isActive('italic'),
			underline: editor.isActive('underline'),
			h2: editor.isActive('heading', { level: 2 }),
			h3: editor.isActive('heading', { level: 3 }),
			bullet: editor.isActive('bulletList'),
			ordered: editor.isActive('orderedList'),
			highlight: editor.isActive('highlight'),
			link: editor.isActive('link'),
			blockquote: editor.isActive('blockquote')
		};
	}

	onMount(() => {
		editor = new Editor({
			element,
			extensions: [
				StarterKit,
				Underline,
				Highlight,
				Link.configure({ openOnClick: false, autolink: true }),
				Placeholder.configure({ placeholder: 'Write your insight…' })
			],
			content: html || '<p></p>',
			editable,
			onUpdate: ({ editor }) => {
				onChange(editor.getHTML());
				refresh();
			},
			onSelectionUpdate: refresh,
			onFocus: refresh
		});
		refresh();
	});

	onDestroy(() => editor?.destroy());

	// Reflect external content changes (undo/redo, duplication) without echoing
	// back through onUpdate.
	$effect(() => {
		const next = html;
		if (editor && next !== editor.getHTML()) {
			editor.commands.setContent(next || '<p></p>', { emitUpdate: false });
		}
	});

	$effect(() => {
		editor?.setEditable(editable);
	});

	function setLink() {
		if (!editor) return;
		const prev = editor.getAttributes('link').href as string | undefined;
		const url = window.prompt('Link URL', prev ?? 'https://');
		if (url === null) return;
		if (url === '') {
			editor.chain().focus().extendMarkRange('link').unsetLink().run();
			return;
		}
		editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
	}

	type Tool = { key: string; label: string; icon: typeof Bold; run: () => void };
	const tools = $derived<Tool[]>(
		editor
			? [
					{ key: 'h2', label: 'Heading', icon: Heading2, run: () => editor!.chain().focus().toggleHeading({ level: 2 }).run() },
					{ key: 'h3', label: 'Subheading', icon: Heading3, run: () => editor!.chain().focus().toggleHeading({ level: 3 }).run() },
					{ key: 'bold', label: 'Bold', icon: Bold, run: () => editor!.chain().focus().toggleBold().run() },
					{ key: 'italic', label: 'Italic', icon: Italic, run: () => editor!.chain().focus().toggleItalic().run() },
					{ key: 'underline', label: 'Underline', icon: UnderlineIcon, run: () => editor!.chain().focus().toggleUnderline().run() },
					{ key: 'bullet', label: 'Bullet list', icon: List, run: () => editor!.chain().focus().toggleBulletList().run() },
					{ key: 'ordered', label: 'Numbered list', icon: ListOrdered, run: () => editor!.chain().focus().toggleOrderedList().run() },
					{ key: 'blockquote', label: 'Callout', icon: Quote, run: () => editor!.chain().focus().toggleBlockquote().run() },
					{ key: 'highlight', label: 'Highlight', icon: Highlighter, run: () => editor!.chain().focus().toggleHighlight().run() },
					{ key: 'link', label: 'Link', icon: LinkIcon, run: setLink }
				]
			: []
	);
</script>

<div class="kf-richtext" style="--kf-fs: {fontScale};">
	{#if editable}
		<div class="kf-toolbar" role="toolbar" aria-label="Text formatting">
			{#each tools as t (t.key)}
				{@const Icon = t.icon}
				<button
					type="button"
					class="kf-tool"
					class:active={active[t.key]}
					aria-label={t.label}
					aria-pressed={active[t.key] ?? false}
					title={t.label}
					onmousedown={(e) => e.preventDefault()}
					onclick={t.run}
				>
					<Icon class="size-3.5" />
				</button>
			{/each}
		</div>
	{/if}
	<div bind:this={element} class="kf-prose"></div>
</div>

<style>
	.kf-toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		margin-bottom: 0.5rem;
		border-bottom: 1px solid var(--color-border, #e2e8f0);
		padding-bottom: 0.5rem;
		opacity: 0;
		transition: opacity 0.15s ease;
	}
	.kf-richtext:hover .kf-toolbar,
	.kf-richtext:focus-within .kf-toolbar {
		opacity: 1;
	}
	.kf-tool {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 6px;
		color: #64748b;
		transition: background 0.12s ease, color 0.12s ease;
	}
	.kf-tool:hover {
		background: #f1f5f9;
		color: #0f172a;
	}
	.kf-tool.active {
		background: color-mix(in srgb, var(--teal, #7dbfa7) 22%, white);
		color: #0f172a;
	}
	.kf-tool:focus-visible {
		outline: 2px solid var(--teal, #7dbfa7);
		outline-offset: 1px;
	}

	/* Prose styling for the editable surface + static render. The root font-size
	   scales with --kf-fs; headings use em so they scale together. */
	.kf-prose :global(.ProseMirror) {
		outline: none;
		font-family: var(--font-body, system-ui), sans-serif;
		font-size: calc(0.95rem * var(--kf-fs, 1));
		line-height: 1.6;
		color: var(--ink, #312f28);
	}
	.kf-prose :global(.ProseMirror p) {
		margin: 0 0 0.6em;
	}
	.kf-prose :global(.ProseMirror h2) {
		font-family: var(--font-body, sans-serif);
		font-size: 1.5em;
		font-weight: 600;
		margin: 0.4em 0 0.3em;
	}
	.kf-prose :global(.ProseMirror h3) {
		font-family: var(--font-body, sans-serif);
		font-size: 1.2em;
		font-weight: 600;
		margin: 0.4em 0 0.3em;
	}
	.kf-prose :global(.ProseMirror ul),
	.kf-prose :global(.ProseMirror ol) {
		margin: 0 0 0.6em;
		padding-left: 1.25rem;
	}
	.kf-prose :global(.ProseMirror ul) {
		list-style: disc;
	}
	.kf-prose :global(.ProseMirror ol) {
		list-style: decimal;
	}
	.kf-prose :global(.ProseMirror a) {
		color: var(--orange, #cc6324);
		text-decoration: underline;
	}
	.kf-prose :global(.ProseMirror mark) {
		background: #fef3c7;
		border-radius: 3px;
		padding: 0 1px;
	}
	.kf-prose :global(.ProseMirror blockquote) {
		border-left: 3px solid var(--teal, #7dbfa7);
		background: color-mix(in srgb, var(--teal, #7dbfa7) 8%, white);
		margin: 0.5em 0;
		padding: 0.5em 0.85em;
		border-radius: 0 8px 8px 0;
		color: #334155;
	}
	.kf-prose :global(.ProseMirror p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		color: #94a3b8;
		pointer-events: none;
		height: 0;
	}
</style>
