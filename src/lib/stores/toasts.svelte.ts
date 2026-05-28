/**
 * Toast store — transient success confirmations shown in the bottom-right,
 * plus long-running progress toasts for in-flight jobs (e.g. corpus autotag).
 *
 * `toasts.push()` adds a toast and schedules its removal after `duration` ms
 * (0 keeps it until dismissed). `toasts.update(id, partial)` mutates an
 * existing toast in place — used to advance the step label / progress bar on
 * a persistent progress toast without spawning a new one. ToastViewport
 * renders the live list and switches visual treatment on `variant`.
 */
export type ToastVariant = 'success' | 'progress' | 'error';

export type Toast = {
	id: number;
	message: string;
	/** Optional link target (e.g. the participant's persona page). */
	href?: string;
	linkLabel?: string;
	/** Visual treatment. Defaults to 'success' so existing call sites are
	 *  unchanged. */
	variant?: ToastVariant;
	/** 0..1 progress fraction for `variant: 'progress'`. Renders as a bar in
	 *  the viewport. Omit to render the toast in indeterminate state. */
	progress?: number;
	/** Sub-line under the message — e.g. "Step 2 of 3: Proposing sentiment". */
	progressLabel?: string;
};

let items = $state<Toast[]>([]);
let seq = 0;

export const toasts = {
	/** The live toast list, oldest first. */
	get list(): Toast[] {
		return items;
	},

	/**
	 * Add a toast. It stays for `duration` ms (default 5000), then ToastViewport
	 * slides it out. Pass `duration: 0` to keep it until dismissed — required
	 * for progress toasts that the caller mutates via `update()`.
	 */
	push(toast: {
		message: string;
		href?: string;
		linkLabel?: string;
		duration?: number;
		variant?: ToastVariant;
		progress?: number;
		progressLabel?: string;
	}): number {
		const id = ++seq;
		items.push({
			id,
			message: toast.message,
			href: toast.href,
			linkLabel: toast.linkLabel,
			variant: toast.variant,
			progress: toast.progress,
			progressLabel: toast.progressLabel
		});
		const ms = toast.duration ?? 5000;
		if (ms > 0 && typeof window !== 'undefined') {
			setTimeout(() => toasts.dismiss(id), ms);
		}
		return id;
	},

	/**
	 * Update an existing toast in place. No-op if the id has already been
	 * dismissed. Used to advance the progress bar / step label on a
	 * persistent progress toast.
	 */
	update(
		id: number,
		partial: Partial<Pick<Toast, 'message' | 'progress' | 'progressLabel' | 'variant'>>
	): void {
		const idx = items.findIndex((t) => t.id === id);
		if (idx < 0) return;
		items[idx] = { ...items[idx], ...partial };
	},

	dismiss(id: number): void {
		items = items.filter((t) => t.id !== id);
	}
};
