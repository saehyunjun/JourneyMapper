type RevealOptions = {
	once?: boolean;
	rootMargin?: string;
	threshold?: number | number[];
	onReveal?: () => void;
};

function findScrollParent(node: HTMLElement): Element | null {
	let el: HTMLElement | null = node.parentElement;
	while (el && el !== document.documentElement) {
		const overflowY = getComputedStyle(el).overflowY;
		if (overflowY === 'auto' || overflowY === 'scroll') return el;
		el = el.parentElement;
	}
	return null;
}

export function reveal(node: HTMLElement, options: RevealOptions = {}) {
	const { once = true, rootMargin = '0px 0px -10% 0px', threshold = 0.1, onReveal } = options;

	let triggered = false;
	const fire = () => {
		if (triggered) return;
		triggered = true;
		node.classList.add('is-revealed');
		onReveal?.();
	};

	const root = findScrollParent(node);
	const io = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					fire();
					if (once) io.unobserve(node);
				} else if (!once) {
					node.classList.remove('is-revealed');
					triggered = false;
				}
			}
		},
		{ root, rootMargin, threshold }
	);

	io.observe(node);

	const fallback = window.setTimeout(() => {
		if (triggered) return;
		const rect = node.getBoundingClientRect();
		const viewH = window.innerHeight || document.documentElement.clientHeight;
		const inView = rect.top < viewH && rect.bottom > 0;
		if (inView) fire();
	}, 600);

	return {
		destroy() {
			io.disconnect();
			clearTimeout(fallback);
		}
	};
}

export function animateProgress(duration: number, onUpdate: (t: number) => void): () => void {
	let raf = 0;
	const start = performance.now();
	const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

	const tick = (now: number) => {
		const elapsed = now - start;
		const t = Math.min(1, elapsed / duration);
		onUpdate(easeOutCubic(t));
		if (t < 1) raf = requestAnimationFrame(tick);
	};
	raf = requestAnimationFrame(tick);

	return () => cancelAnimationFrame(raf);
}
