<!--
	StatBar — one labelled horizontal count bar.

	The atomic row of the analysis page's "Themes & emotions" tab: a label, a
	track whose fill is `count / max`, and the count. Shared so the participant
	drawer can render the same breakdown scoped to one interviewee.
-->
<script lang="ts">
	let {
		label,
		count,
		max,
		tint = 'bg-accent-mint',
		labelClass = 'w-44'
	}: {
		label: string;
		count: number;
		max: number;
		/** Tailwind background class for the fill. */
		tint?: string;
		/** Width utility for the label column — narrow it for tight layouts. */
		labelClass?: string;
	} = $props();
</script>

<div class="flex items-center gap-3 text-sm">
	<span class="{labelClass} shrink-0 truncate text-slate-700" title={label}>{label}</span>
	<div class="h-4 flex-1 rounded-sm bg-slate-100">
		<div
			class="h-full rounded-sm {tint}"
			style="width: {(count / Math.max(1, max)) * 100}%"
		></div>
	</div>
	<span class="w-8 shrink-0 text-right tabular-nums text-slate-500">{count}</span>
</div>
