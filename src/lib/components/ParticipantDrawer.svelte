<!--
	ParticipantDrawer — a right-side sheet with one interviewee's details.

	Shows the participant's avatar (with upload/replace), an editable details
	form (name, gender, country, age range, individual/composite flag), and a
	deterministic word-usage tally. Edits are persisted through the
	/participant-profiles and /participant-avatar endpoints; the saved profile
	is written back into the bindable `profiles` record so the host stays current.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import RightDrawer from '$lib/components/RightDrawer.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import ParticipantAvatar from '$lib/components/ParticipantAvatar.svelte';
	import SentimentBar from '$lib/components/SentimentBar.svelte';
	import SentimentRing from '$lib/components/SentimentRing.svelte';
	import {
		annotations,
		wordUsage,
		participantLabel,
		titleCase,
		themeBreakdown,
		emotionBreakdown,
		fragmentsMatching
	} from '$lib/content/wctglpdemo-data/analysis';
	import ParticipantFragmentsDrawer, {
		type FragmentSelection
	} from '$lib/components/ParticipantFragmentsDrawer.svelte';
	import {
		AGE_RANGES,
		GENDERS,
		emptyProfile,
		profileName,
		type ParticipantProfile,
		type ParticipantType
	} from '$lib/types/participant-profile';
	import LucideEdit from '@lucide/svelte/icons/square-pen';

	let {
		open = $bindable(false),
		interviewId = null,
		profiles = $bindable()
	}: {
		open?: boolean;
		interviewId?: string | null;
		profiles: Record<string, ParticipantProfile>;
	} = $props();

	const profile = $derived(
		interviewId ? (profiles[interviewId] ?? emptyProfile(interviewId)) : null
	);

	// --- Editable details form ---
	let firstName = $state('');
	let lastInitial = $state('');
	let gender = $state('');
	let country = $state('');
	let ageRange = $state('');
	let participantType = $state<ParticipantType>('individual');

	let saving = $state(false);
	let uploading = $state(false);
	let justSaved = $state(false);
	let errorMsg = $state('');
	// The profile shows read-only until the analyst clicks "Edit".
	let editing = $state(false);

	// Seed the editable form from the stored profile. The profile read is
	// untracked so persisting an edit (which mutates `profiles`) does not
	// re-run the re-seed effect and wipe the "saved" confirmation.
	function seedForm() {
		const id = interviewId;
		const p = id ? untrack(() => profiles[id]) : null;
		firstName = p?.first_name ?? '';
		lastInitial = p?.last_initial ?? '';
		gender = p?.gender ?? '';
		country = p?.country ?? '';
		ageRange = p?.age_range ?? '';
		participantType = p?.participant_type ?? 'individual';
	}

	// Re-seed and drop back to read-only view whenever the participant changes.
	$effect(() => {
		interviewId;
		seedForm();
		editing = false;
		justSaved = false;
		errorMsg = '';
		fragmentSelection = null;
	});

	function cancelEdit() {
		seedForm();
		editing = false;
		errorMsg = '';
	}

	// Compact identity facts shown as chips in the drawer's top bar.
	const detailChips = $derived([
		{ label: 'Gender', value: gender ? titleCase(gender) : '—' },
		{ label: 'Country', value: country.trim() || '—' },
		{ label: 'Age range', value: ageRange || '—' },
		{ label: 'Type', value: titleCase(participantType) }
	]);

	// Deterministic word usage for this participant, if the pipeline produced it.
	const usage = $derived(interviewId ? wordUsage.by_participant[interviewId] : undefined);
	const topWords = $derived(usage?.word_usage.slice(0, 14) ?? []);
	const maxWord = $derived(Math.max(1, ...topWords.map((w) => w.count)));

	// Themes / emotions / sentiment — the analysis page's "Themes & emotions"
	// tab, scoped to this participant's segment annotations. Each row carries
	// its contributing segments so SentimentBar can split it by sentiment.
	const segs = $derived(
		interviewId ? annotations.filter((a) => a.interview_id === interviewId) : []
	);
	const themeRows = $derived(
		interviewId ? themeBreakdown((a) => a.interview_id === interviewId) : []
	);
	const maxTheme = $derived(Math.max(1, ...themeRows.map((t) => t.count)));
	const emotionRows = $derived(
		interviewId ? emotionBreakdown((a) => a.interview_id === interviewId) : []
	);
	const maxEmotion = $derived(Math.max(1, ...emotionRows.map((e) => e.count)));
	const hasBreakdown = $derived(themeRows.length > 0 || emotionRows.length > 0);

	let fileInput = $state<HTMLInputElement | null>(null);

	// --- Secondary drawer: tagged fragments behind a clicked row ---
	// Clicking a theme, subtheme, emotion, or word-usage row opens a stacked
	// drawer listing every coded fragment behind it, scoped to this participant.
	const participantName = $derived(
		profile ? profileName(profile, participantLabel(interviewId ?? '')) : ''
	);
	let fragmentSelection = $state<FragmentSelection | null>(null);

	function showFragments(
		kind: string,
		label: string,
		fragments: FragmentSelection['fragments']
	) {
		fragmentSelection = { kind, label, subtitle: participantName, fragments };
	}
	function openThemeFragments(themeId: string) {
		showFragments(
			'Theme',
			titleCase(themeId),
			fragmentsMatching((a) => a.interview_id === interviewId && a.themes.includes(themeId))
		);
	}
	function openSubthemeFragments(subId: string) {
		showFragments(
			'Subtheme',
			titleCase(subId),
			fragmentsMatching((a) => a.interview_id === interviewId && a.subthemes.includes(subId))
		);
	}
	function openEmotionFragments(emotionId: string) {
		showFragments(
			'Emotion',
			titleCase(emotionId),
			fragmentsMatching((a) => a.interview_id === interviewId && a.emotions.includes(emotionId))
		);
	}
	function openWordFragments(word: string) {
		// Match the whole word, case-insensitively, against each fragment's text.
		const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
		showFragments(
			'Word',
			word,
			fragmentsMatching((a) => a.interview_id === interviewId).filter((f) => re.test(f.text))
		);
	}

	async function saveDetails() {
		if (!interviewId || saving) return;
		saving = true;
		errorMsg = '';
		try {
			const res = await fetch('/wctglpdemo/participant-profiles', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					interviewId,
					profile: {
						first_name: firstName,
						last_initial: lastInitial,
						gender,
						country,
						age_range: ageRange,
						participant_type: participantType
					}
				})
			});
			if (!res.ok) {
				errorMsg = 'Could not save details.';
				return;
			}
			const { profile: saved } = await res.json();
			profiles[interviewId] = saved;
			justSaved = true;
			editing = false;
		} catch {
			errorMsg = 'Could not save details.';
		} finally {
			saving = false;
		}
	}

	async function uploadAvatar(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !interviewId || uploading) return;
		uploading = true;
		errorMsg = '';
		try {
			const form = new FormData();
			form.append('interviewId', interviewId);
			form.append('file', file);
			const res = await fetch('/wctglpdemo/participant-avatar', { method: 'POST', body: form });
			if (!res.ok) {
				errorMsg = 'Could not upload avatar.';
				return;
			}
			const { profile: saved } = await res.json();
			profiles[interviewId] = saved;
		} catch {
			errorMsg = 'Could not upload avatar.';
		} finally {
			uploading = false;
			input.value = '';
		}
	}
</script>

<RightDrawer bind:open>
	{#if interviewId && profile}
		<div class="flex h-full flex-col">
			<!-- Top bar — avatar, identity, and the profile facts -->
			<div class="flex flex-col gap-4 border-b border-slate-200 p-6">
				<div class="flex items-start gap-4">
					<div class="flex flex-col items-center gap-1.5">
						<!-- Avatar framed by a donut of the participant's sentiment mix -->
						<div class="relative grid size-28 place-items-center">
							<SentimentRing blocks={segs} size={112} class="absolute inset-0" />
							<ParticipantAvatar {interviewId} size="xl" src={profile.avatar_url} />
						</div>
						{#if editing}
							<Button
								variant="link"
								size="sm"
								onclick={() => fileInput?.click()}
								disabled={uploading}
							>
								{uploading ? 'Uploading…' : profile.avatar_url ? 'Change avatar' : 'Upload avatar'}
							</Button>
						{/if}
						<input
							bind:this={fileInput}
							type="file"
							accept="image/png,image/jpeg,image/webp,image/gif"
							class="hidden"
							onchange={uploadAvatar}
						/>
					</div>
					
					<div class="flex min-w-0 flex-1 flex-col gap-1">
						<span class="uppercase font-heading text-accent-mint">Participant details</span>
						<h2 class="font-heading text-3xl font-light uppercase text-primary">
							{profileName(profile, participantLabel(interviewId))}
						</h2>
						<p class="text-xs text-slate-500">{participantLabel(interviewId)}</p>
						<Button variant="link" size="sm" 
						onclick={() => (editing = true)}>
							Edit
							<LucideEdit />
						</Button>			
					</div>
					{#if !editing}
						<div class="flex shrink-0 items-center gap-2">
							{#if justSaved}
								<span class="text-xs font-medium text-emerald-600">✓ Saved</span>
							{/if}
						</div>
						{/if}
					</div>
					
					<!-- Profile facts — gender, country, age range, participant type -->
			
				{#if !editing}
					<dl class="grid grid-cols-4 gap-2">
						{#each detailChips as chip (chip.label)}
							<div class="flex flex-col gap-0.5 rounded-md bg-none px-2.5 py-1.5">
								<dt class="text-[10px] font-medium uppercase tracking-wide text-slate-400">
									{chip.label}
								</dt>
								<dd class="truncate text-sm text-slate-800" title={chip.value}>
									{chip.value}
								</dd>
							</div>
						{/each}
					</dl>
				{/if}
			</div>

			<div class="flex flex-1 flex-col gap-7 overflow-y-auto p-6">
				{#if errorMsg}
					<p class="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
						{errorMsg}
					</p>
				{/if}

				<!-- Edit form — only while editing; the facts otherwise live in the top bar -->
				{#if editing}
					<section class="flex flex-col gap-4">
						<h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
							Edit profile
						</h3>
						<div class="grid grid-cols-2 gap-3">
						<label class="flex flex-col gap-1 text-xs font-medium text-slate-500">
							First name
							<input
								type="text"
								bind:value={firstName}
								placeholder="Jane"
								class="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
							/>
						</label>
						<label class="flex flex-col gap-1 text-xs font-medium text-slate-500">
							Last initial
							<input
								type="text"
								bind:value={lastInitial}
								maxlength="1"
								placeholder="D"
								class="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
							/>
						</label>
					</div>

					<label class="flex flex-col gap-1 text-xs font-medium text-slate-500">
						Gender
						<select
							bind:value={gender}
							class="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
						>
							<option value="">—</option>
							{#each GENDERS as g (g)}
								<option value={g} class="capitalize">{g}</option>
							{/each}
						</select>
					</label>

					<div class="grid grid-cols-2 gap-3">
						<label class="flex flex-col gap-1 text-xs font-medium text-slate-500">
							Country
							<input
								type="text"
								bind:value={country}
								placeholder="United States"
								class="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
							/>
						</label>
						<label class="flex flex-col gap-1 text-xs font-medium text-slate-500">
							Age range
							<select
								bind:value={ageRange}
								class="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
							>
								<option value="">—</option>
								{#each AGE_RANGES as a (a)}
									<option value={a}>{a}</option>
								{/each}
							</select>
						</label>
					</div>

					<div class="flex flex-col gap-1.5">
						<span class="text-xs font-medium text-slate-500">Participant type</span>
						<div class="flex overflow-hidden">
							{#each ['individual', 'composite'] as const as type (type)}
								<Button
									variant="ghost"
									onclick={() => (participantType = type)}
									aria-pressed={participantType === type}
									class="
										{participantType === type
										? 'bg-accent-mint text-white'
										: 'bg-white text-slate-600 hover:bg-none'}"
								>
									{type}
						</Button>
							{/each}
						</div>
						<p class="text-xs text-slate-400">
							{participantType === 'composite'
								? 'A blended persona drawn from several interviews.'
								: 'A single, real interviewee.'}
						</p>
					</div>

						<div class="flex items-center gap-3">
							<Button onclick={saveDetails} disabled={saving}>
								{saving ? 'Saving…' : 'Save details'}
							</Button>
							<button
								type="button"
								onclick={cancelEdit}
								class="text-sm font-medium text-slate-500 hover:underline"
							>
								Cancel
							</button>
						</div>
					</section>
				{/if}

				<!-- Themes & emotions — sentiment-split breakdowns, scoped here -->
				<section class="flex flex-col gap-5">
					<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
						<h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
							Themes &amp; emotions
						</h3>
					</div>

					{#if hasBreakdown}
						<!-- Themes — each bar's width is its frequency, split by sentiment -->
						<div class="flex flex-col gap-1.5">
							<p class="text-xs font-medium text-muted-foreground uppercase font-heading">
								Themes · {themeRows.length}
							</p>
							{#each themeRows as t (t.id)}
								<button
									type="button"
									onclick={() => openThemeFragments(t.id)}
									title="View tagged segments"
									class="font-medium px-1.5 py-0.5 text-left transition-colors hover:bg-accent-mint-foreground 
									hover:font-semibold hover:cursor-pointer" 
								>
									<SentimentBar
										label={titleCase(t.id)}
										blocks={t.blocks}
										max={maxTheme}
										labelClass="w-40"
									/>
								</button>
								{#if t.subthemes.length}
									<div class="ml-4 flex flex-col gap-1 border-l border-muted-foreground pl-2">
										{#each t.subthemes as s (s.id)}
											<button
												type="button"
												onclick={() => openSubthemeFragments(s.id)}
												title="View tagged segments"
												class="px-1.5 py-.5 text-left transition-colors hover:bg-accent-mint-foreground
												hover:font-medium hover:cursor-pointer"
											>
												<SentimentBar
													label={titleCase(s.id)}
													blocks={s.blocks}
													max={maxTheme}
													labelClass="w-40"
													shape="dots"
												/>
											</button>
										{/each}
									</div>
								{/if}
							{/each}
						</div>

						<!-- Emotions -->
						{#if emotionRows.length}
							<div class="flex flex-col gap-1.5">
								<p class="text-xs font-medium text-slate-500">
									Emotions · {emotionRows.length}
								</p>
								{#each emotionRows as e (e.id)}
									<button
										type="button"
										onclick={() => openEmotionFragments(e.id)}
										title="View tagged segments"
										class="-mx-1.5 rounded px-1.5 py-0.5 text-left transition-colors hover:bg-none"
									>
										<SentimentBar
											label={titleCase(e.id)}
											blocks={e.blocks}
											max={maxEmotion}
											labelClass="w-40"
										/>
									</button>
								{/each}
							</div>
						{/if}
					{:else}
						<p class="text-xs text-muted-foreground">
							No tagged segments for this participant yet.
						</p>
					{/if}
				</section>

				<!-- Word usage -->
				<section class="flex flex-col gap-2 border-t border-slate-100 pt-6">
					<h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
						Word usage
					</h3>
					{#if usage}
						<p class="text-xs text-muted-foreground">
							{usage.total_words} words spoken · {usage.unique_words} unique. Top words by mention
							count.
						</p>
						<div class="mt-1 flex flex-col gap-1.5">
							{#each topWords as w (w.word)}
								<button
									type="button"
									onclick={() => openWordFragments(w.word)}
									title="View segments using this word"
									class="-mx-1.5 flex items-center gap-2 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-none"
								>
									<span class="w-28 shrink-0 truncate text-left text-slate-700">{w.word}</span>
									<div class="h-3 flex-1 rounded-sm bg-slate-100">
										<div
											class="h-full rounded-sm bg-accent-mint"
											style="width: {(w.count / maxWord) * 100}%"
										></div>
									</div>
									<span class="w-5 shrink-0 text-right tabular-nums text-slate-500">{w.count}</span>
								</button>
							{/each}
						</div>
					{:else}
						<p class="text-xs text-muted-foreground">
							No word-usage data for this participant yet.
						</p>
					{/if}
				</section>
			</div>

			<!-- Secondary drawer — tagged fragments behind a clicked row -->
			<ParticipantFragmentsDrawer
				selection={fragmentSelection}
				{profiles}
				onclose={() => (fragmentSelection = null)}
			/>
		</div>
	{/if}
</RightDrawer>
