/**
 * Key Findings board store.
 *
 * A single runes-based store that owns the board, persists it to localStorage,
 * and keeps an undo/redo history. Every mutation goes through `update()`, which
 * snapshots the previous board onto the undo stack (coalescing rapid edits such
 * as typing into one history entry) and schedules a debounced save.
 *
 * The store is a module singleton — import `keyFindings` anywhere. It is safe to
 * construct during SSR (no storage access until `load()` runs in the browser).
 */
import {
	emptyBoard,
	newId,
	type Board,
	type Card,
	type Block,
	type Priority,
	type CardSize,
	type CardAnimation
} from '$lib/key-findings/types';

const STORAGE_KEY = 'jm.key-findings.board.v2';
const HISTORY_LIMIT = 100;
/** Edits sharing a coalesce key within this window collapse to one undo step. */
const COALESCE_MS = 600;

function clone<T>(value: T): T {
	return structuredClone($state.snapshot(value) as T);
}

class KeyFindingsStore {
	board = $state<Board>(emptyBoard());
	/** True once the persisted board has been read in the browser. */
	loaded = $state(false);

	#past = $state<Board[]>([]);
	#future = $state<Board[]>([]);
	#lastCoalesceKey: string | null = null;
	#lastCommitAt = 0;
	#saveTimer: ReturnType<typeof setTimeout> | null = null;

	canUndo = $derived(this.#past.length > 0);
	canRedo = $derived(this.#future.length > 0);

	/** Read the board from localStorage; call once from the browser. */
	load() {
		if (this.loaded || typeof localStorage === 'undefined') return;
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				const parsed = JSON.parse(raw) as Board;
				if (parsed && Array.isArray(parsed.cards)) this.board = parsed;
			}
		} catch {
			/* corrupt payload — fall back to the empty board */
		}
		this.loaded = true;
	}

	/** Seed the board with starter cards only when nothing is stored yet. */
	seedIfEmpty(make: () => Card[]) {
		if (this.board.cards.length) return;
		this.update((b) => {
			b.cards = make();
		});
	}

	#scheduleSave() {
		if (typeof localStorage === 'undefined') return;
		if (this.#saveTimer) clearTimeout(this.#saveTimer);
		this.#saveTimer = setTimeout(() => this.flush(), 400);
	}

	/** Write the board to storage immediately (e.g. before switching cards). */
	flush() {
		if (typeof localStorage === 'undefined') return;
		if (this.#saveTimer) {
			clearTimeout(this.#saveTimer);
			this.#saveTimer = null;
		}
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify($state.snapshot(this.board)));
		} catch {
			/* quota or serialisation failure — drop silently */
		}
	}

	/**
	 * Apply a mutation to the live board. Pass a `coalesceKey` for high-frequency
	 * edits (e.g. `richtext:<blockId>`) so a burst becomes a single undo step.
	 */
	update(mutator: (board: Board) => void, coalesceKey?: string) {
		const now = Date.now();
		const coalesce =
			coalesceKey != null &&
			coalesceKey === this.#lastCoalesceKey &&
			now - this.#lastCommitAt < COALESCE_MS;

		if (!coalesce) {
			this.#past = [...this.#past, clone(this.board)].slice(-HISTORY_LIMIT);
			this.#future = [];
		}
		this.#lastCoalesceKey = coalesceKey ?? null;
		this.#lastCommitAt = now;

		mutator(this.board);
		this.#scheduleSave();
	}

	undo() {
		if (!this.#past.length) return;
		const prev = this.#past[this.#past.length - 1];
		this.#past = this.#past.slice(0, -1);
		this.#future = [clone(this.board), ...this.#future];
		this.board = prev;
		this.#lastCoalesceKey = null;
		this.#scheduleSave();
	}

	redo() {
		if (!this.#future.length) return;
		const next = this.#future[0];
		this.#future = this.#future.slice(1);
		this.#past = [...this.#past, clone(this.board)].slice(-HISTORY_LIMIT);
		this.board = next;
		this.#lastCoalesceKey = null;
		this.#scheduleSave();
	}

	// ---- Card operations ----------------------------------------------------

	#find(cardId: string): Card | undefined {
		return this.board.cards.find((c) => c.id === cardId);
	}

	addCard(card: Card, atIndex?: number) {
		this.update((b) => {
			if (atIndex == null || atIndex >= b.cards.length) b.cards.push(card);
			else b.cards.splice(Math.max(0, atIndex), 0, card);
		});
	}

	duplicateCard(cardId: string) {
		this.update((b) => {
			const idx = b.cards.findIndex((c) => c.id === cardId);
			if (idx < 0) return;
			const copy = clone(b.cards[idx]);
			copy.id = newId('card');
			copy.title = copy.title ? `${copy.title} (copy)` : copy.title;
			copy.blocks = copy.blocks.map((bl) => ({ ...bl, id: newId('blk') }));
			b.cards.splice(idx + 1, 0, copy);
		});
	}

	removeCard(cardId: string) {
		this.update((b) => {
			b.cards = b.cards.filter((c) => c.id !== cardId);
		});
	}

	patchCard(cardId: string, patch: Partial<Card>, coalesceKey?: string) {
		this.update((b) => {
			const card = b.cards.find((c) => c.id === cardId);
			if (card) Object.assign(card, patch);
		}, coalesceKey);
	}

	setTitle(cardId: string, title: string) {
		this.patchCard(cardId, { title }, `title:${cardId}`);
	}

	setSize(cardId: string, size: CardSize) {
		this.patchCard(cardId, { size });
	}

	setPriority(cardId: string, priority: Priority) {
		this.patchCard(cardId, { priority });
	}

	setAnimation(cardId: string, animation: CardAnimation) {
		this.patchCard(cardId, { animation });
	}

	addTag(cardId: string, tag: string) {
		const clean = tag.trim();
		if (!clean) return;
		const card = this.#find(cardId);
		if (!card || card.tags.includes(clean)) return;
		this.patchCard(cardId, { tags: [...card.tags, clean] });
	}

	removeTag(cardId: string, tag: string) {
		const card = this.#find(cardId);
		if (!card) return;
		this.patchCard(cardId, { tags: card.tags.filter((t) => t !== tag) });
	}

	/** Commit a reordered card list (from drag-and-drop). */
	reorderCards(cards: Card[]) {
		this.update((b) => {
			b.cards = cards;
		});
	}

	// ---- Block operations ---------------------------------------------------

	addBlock(cardId: string, block: Block, atIndex?: number) {
		this.update((b) => {
			const card = b.cards.find((c) => c.id === cardId);
			if (!card) return;
			if (atIndex == null || atIndex >= card.blocks.length) card.blocks.push(block);
			else card.blocks.splice(Math.max(0, atIndex), 0, block);
		});
	}

	replaceBlock(cardId: string, blockId: string, newBlock: Block) {
		this.update((b) => {
			const card = b.cards.find((c) => c.id === cardId);
			if (!card) return;
			const i = card.blocks.findIndex((bl) => bl.id === blockId);
			if (i >= 0) card.blocks[i] = newBlock;
		});
	}

	updateBlock(cardId: string, blockId: string, patch: Partial<Block>, coalesceKey?: string) {
		this.update((b) => {
			const card = b.cards.find((c) => c.id === cardId);
			const block = card?.blocks.find((bl) => bl.id === blockId);
			if (block) Object.assign(block, patch);
		}, coalesceKey);
	}

	removeBlock(cardId: string, blockId: string) {
		this.update((b) => {
			const card = b.cards.find((c) => c.id === cardId);
			if (card) card.blocks = card.blocks.filter((bl) => bl.id !== blockId);
		});
	}

	moveBlock(cardId: string, blockId: string, direction: -1 | 1) {
		this.update((b) => {
			const card = b.cards.find((c) => c.id === cardId);
			if (!card) return;
			const i = card.blocks.findIndex((bl) => bl.id === blockId);
			const j = i + direction;
			if (i < 0 || j < 0 || j >= card.blocks.length) return;
			[card.blocks[i], card.blocks[j]] = [card.blocks[j], card.blocks[i]];
		});
	}

	clearAll() {
		this.update((b) => {
			b.cards = [];
		});
	}
}

export const keyFindings = new KeyFindingsStore();
