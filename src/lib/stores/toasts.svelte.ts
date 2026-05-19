/**
 * Toast store — transient success confirmations shown in the bottom-right.
 *
 * `toasts.push()` adds a toast and schedules its removal after `duration` ms;
 * ToastViewport.svelte renders the live list with the stack + slide transitions.
 * Newest toasts sit on top of older ones.
 */
export type Toast = {
	id: number;
	message: string;
	/** Optional link target (e.g. the participant's fingerprint page). */
	href?: string;
	linkLabel?: string;
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
	 * slides it out. Pass `duration: 0` to keep it until dismissed.
	 */
	push(toast: {
		message: string;
		href?: string;
		linkLabel?: string;
		duration?: number;
	}): number {
		const id = ++seq;
		items.push({ id, message: toast.message, href: toast.href, linkLabel: toast.linkLabel });
		const ms = toast.duration ?? 5000;
		if (ms > 0 && typeof window !== 'undefined') {
			setTimeout(() => toasts.dismiss(id), ms);
		}
		return id;
	},

	dismiss(id: number): void {
		items = items.filter((t) => t.id !== id);
	}
};
