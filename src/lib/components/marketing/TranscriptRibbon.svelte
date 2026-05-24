<script lang="ts" module>
	export type TranscriptTagTone =
		| 'barrier'
		| 'emotion'
		| 'theme'
		| 'journey'
		| 'finding'
		| 'decision';

	export type TranscriptTag = {
		label: string;
		detail?: string;
		x: number;
		y: number;
		anchor?: 'left' | 'right' | 'center';
		tone?: TranscriptTagTone;
		delay?: number;
	};

	export type TranscriptCenterBubble = {
		x: number;
		y: number;
		label?: string;
		detail?: string;
		delay?: number;
	};
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	let {
		id = 'marketing',
		transcripts,
		tags,
		centerBubble = undefined,
		speed = 1,
		interactive = true,
		reducedMotion = undefined,
		height = 3600
	}: {
		id?: string;
		transcripts: string[];
		tags: TranscriptTag[];
		centerBubble?: TranscriptCenterBubble;
		speed?: number;
		interactive?: boolean;
		reducedMotion?: boolean;
		height?: number;
	} = $props();

	const WIDTH = 1200;
	const ribbonPath =
		'M 90 210 C 280 80, 500 90, 720 210 S 1110 380, 1020 610 S 690 900, 380 1005 S 90 1240, 260 1455 S 720 1710, 1000 1860 S 1095 2160, 860 2295 S 360 2475, 190 2735 S 320 3190, 630 3320 S 1070 3495, 1090 3650';
	const pathId = $derived(`transcript-ribbon-path-${id}`);
	const textPayload = $derived(transcripts.join('  •  '));
	const streamText = $derived(Array.from({ length: 5 }, () => textPayload).join('  •  '));

	let prefersReducedMotion = $state(false);
	const motionReduced = $derived(reducedMotion ?? prefersReducedMotion);
	const duration = $derived(`${Math.max(54, 110 / Math.max(speed, 0.25))}s`);

	const toneClassMap: Record<TranscriptTagTone, string> = {
		barrier: 'tag-barrier',
		emotion: 'tag-emotion',
		theme: 'tag-theme',
		journey: 'tag-journey',
		finding: 'tag-finding',
		decision: 'tag-decision'
	};

	onMount(() => {
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		const update = () => {
			prefersReducedMotion = media.matches;
		};
		update();
		media.addEventListener('change', update);
		return () => media.removeEventListener('change', update);
	});

	function tagWidth(label: string, detail?: string) {
		const longest = Math.max(label.length, detail?.length ?? 0);
		return Math.min(248, Math.max(138, 34 + longest * 7.1));
	}

	function tagHeight(detail?: string) {
		return detail ? 62 : 42;
	}

	function tagClass(tone?: TranscriptTagTone) {
		return tone ? toneClassMap[tone] : 'tag-theme';
	}

	function tagOffset(anchor: TranscriptTag['anchor'], width: number) {
		if (anchor === 'left') return -width - 26;
		if (anchor === 'center') return -(width / 2);
		return 26;
	}
</script>

<div class="ribbon-shell" aria-hidden="true" style={`height:${height}px;`}>
	<svg
		class="ribbon-svg"
		viewBox={`0 0 ${WIDTH} ${height}`}
		preserveAspectRatio="none"
		role="presentation"
	>
		<defs>
			<path id={pathId} d={ribbonPath} />
			<filter id={`bubble-glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
				<feGaussianBlur stdDeviation="8" result="blur" />
				<feColorMatrix
					in="blur"
					type="matrix"
					values="1 0 0 0 0
					        0 1 0 0 0
					        0 0 1 0 0
					        0 0 0 .18 0"
				/>
			</filter>
		</defs>

		{#if motionReduced}
			<text class="stream stream-primary" dy="0">
				<textPath href={`#${pathId}`} startOffset="2%">{streamText}</textPath>
			</text>
		{:else}
			<text class="stream stream-primary" dy="0">
				<textPath href={`#${pathId}`} startOffset="-10%">{streamText}
					<animate
						attributeName="startOffset"
						from="-10%"
						to="92%"
						dur={duration}
						repeatCount="indefinite"
					/>
				</textPath>
			</text>
		{/if}

		{#if centerBubble}
			<g
				class={`center-bubble ${motionReduced ? 'is-static' : ''}`}
				transform={`translate(${centerBubble.x}, ${centerBubble.y})`}
				style={`--bubble-delay:${centerBubble.delay ?? 0}s;`}
			>
				<ellipse
					cx="0"
					cy="0"
					rx="84"
					ry="44"
					filter={`url(#bubble-glow-${id})`}
					class="center-bubble-shadow"
				/>
				<rect x="-84" y="-44" width="168" height="88" rx="44" ry="44" class="center-bubble-shell" />
				<g class="center-bubble-bars" aria-hidden="true">
					{#each [18, 24, 30, 22, 14, 38, 28, 12, 8, 14, 28, 42, 30, 16, 24, 18] as barHeight, index}
						<rect
							x={-52 + index * 7}
							y={-barHeight / 2}
							width="3"
							height={barHeight}
							rx="2"
						/>
					{/each}
				</g>
				{#if centerBubble.label}
					<text class="center-bubble-label" x="0" y="-60">{centerBubble.label}</text>
				{/if}
				{#if centerBubble.detail}
					<text class="center-bubble-detail" x="0" y="66">{centerBubble.detail}</text>
				{/if}
			</g>
		{/if}

		{#each tags as tag}
			{@const width = tagWidth(tag.label, tag.detail)}
			{@const height = tagHeight(tag.detail)}
			{@const anchor = tagOffset(tag.anchor, width)}
			{@const toneClass = tagClass(tag.tone)}
			<g
				class={`tag ${toneClass} ${interactive ? 'tag-interactive' : ''} ${motionReduced ? 'is-static' : ''}`}
				transform={`translate(${tag.x + anchor}, ${tag.y})`}
				style={`--tag-delay:${tag.delay ?? 0}s;`}
			>
				{#if tag.anchor !== 'center'}
					<line
						x1={tag.anchor === 'left' ? width : 0}
						y1="20"
						x2={tag.anchor === 'left' ? width + 22 : -22}
						y2="20"
					/>
				{/if}
				<rect width={width} height={height} rx="18" ry="18" />
				<text class="tag-label" x="18" y="25">{tag.label}</text>
				{#if tag.detail}
					<text class="tag-detail" x="18" y="45">{tag.detail}</text>
				{/if}
			</g>
		{/each}
	</svg>
</div>

<style>
	.ribbon-shell {
		position: absolute;
		inset: 0 0 auto;
		width: 100%;
		pointer-events: none;
		opacity: 0.96;
	}

	.ribbon-svg {
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
	}

	.stream {
		font-family: var(--font-heading);
		font-size: 27px;
		font-weight: 500;
		letter-spacing: 0.01em;
	}

	.stream-primary {
		fill: rgba(49, 47, 40, 0.36);
	}

	.tag {
		transform-box: fill-box;
		transform-origin: center;
	}

	.tag rect {
		fill: rgba(244, 245, 243, 0.93);
		stroke: rgba(68, 96, 121, 0.18);
		stroke-width: 1;
	}

	.tag line {
		stroke: rgba(68, 96, 121, 0.32);
		stroke-width: 1.5;
		stroke-linecap: round;
	}

	.tag-label {
		font-family: var(--font-body);
		font-size: 13px;
		font-weight: 600;
		fill: rgba(41, 68, 87, 0.96);
	}

	.tag-detail {
		font-family: var(--font-body);
		font-size: 11px;
		fill: rgba(49, 47, 40, 0.72);
	}

	.tag-barrier rect {
		fill: rgba(253, 220, 204, 0.88);
		stroke: rgba(204, 99, 36, 0.24);
	}

	.tag-emotion rect {
		fill: rgba(208, 217, 220, 0.95);
		stroke: rgba(68, 96, 121, 0.24);
	}

	.tag-theme rect {
		fill: rgba(244, 244, 255, 0.96);
		stroke: rgba(106, 153, 194, 0.28);
	}

	.tag-journey rect {
		fill: rgba(231, 229, 226, 0.96);
		stroke: rgba(144, 85, 58, 0.24);
	}

	.tag-finding rect {
		fill: rgba(125, 191, 167, 0.16);
		stroke: rgba(89, 144, 119, 0.32);
	}

	.tag-decision rect {
		fill: rgba(41, 68, 87, 0.92);
		stroke: rgba(41, 68, 87, 0.48);
	}

	.tag-decision .tag-label,
	.tag-decision .tag-detail {
		fill: rgba(244, 245, 243, 0.96);
	}

	.tag-interactive {
		pointer-events: auto;
		transition: transform 220ms var(--ease-smooth);
	}

	.tag-interactive:hover {
		transform: scale(1.02);
	}

	.tag:not(.is-static) {
		animation: tag-rise 8.6s var(--ease-smooth) infinite;
		animation-delay: var(--tag-delay);
	}

	.center-bubble {
		transform-box: fill-box;
		transform-origin: center;
	}

	.center-bubble-shadow {
		fill: rgba(41, 68, 87, 0.14);
	}

	.center-bubble-shell {
		fill: rgba(246, 241, 230, 0.95);
		stroke: rgba(41, 68, 87, 0.9);
		stroke-width: 2.4;
	}

	.center-bubble-bars rect {
		fill: rgba(41, 68, 87, 0.92);
	}

	.center-bubble-label,
	.center-bubble-detail {
		font-family: var(--font-body);
		text-anchor: middle;
	}

	.center-bubble-label {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		fill: rgba(41, 68, 87, 0.84);
	}

	.center-bubble-detail {
		font-size: 11px;
		fill: rgba(49, 47, 40, 0.66);
	}

	.center-bubble:not(.is-static) {
		animation: bubble-breathe 6.4s var(--ease-smooth) infinite;
		animation-delay: var(--bubble-delay);
	}

	@keyframes tag-rise {
		0%,
		18% {
			opacity: 0;
			transform: translateY(18px) scale(0.96);
		}

		26%,
		42% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}

		58% {
			opacity: 0.32;
			transform: translateY(-6px) scale(0.995);
		}

		100% {
			opacity: 0;
			transform: translateY(-14px) scale(0.985);
		}
	}

	@keyframes bubble-breathe {
		0%,
		100% {
			opacity: 0.92;
			transform: scale(1);
		}

		50% {
			opacity: 1;
			transform: scale(1.025);
		}
	}

	@media (max-width: 900px) {
		.stream {
			font-size: 20px;
		}

		.tag-label {
			font-size: 12px;
		}

		.tag-detail {
			font-size: 10px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.tag,
		.center-bubble {
			animation: none;
		}
	}
</style>
