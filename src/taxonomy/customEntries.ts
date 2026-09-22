import type { CustomTaxonomyEntry, Taxonomy, TaxonomyNode } from './types';

let counter = 0;

/** Generates a code for a new custom entry. It never collides with a preset taxonomy code. */
export function createEntryCode(): string {
	counter += 1;
	return `custom:${Date.now()}:${counter}`;
}

/**
 * Grafts `entries` onto `taxonomy`, returning a new tree; `taxonomy` is left untouched.
 * Entries may nest under other entries (in any order). An entry whose parent code is not found
 * in the taxonomy or among the other entries (e.g. after switching taxonomy method) is dropped.
 */
export function mergeCustomEntries(taxonomy: Taxonomy, entries: CustomTaxonomyEntry[]): Taxonomy {
	const root = taxonomy.root.children.map(cloneNode);
	const byCode = new Map<string, TaxonomyNode>();
	index(root, byCode);

	const pending = [...entries];
	let placedSomething = true;
	while (pending.length > 0 && placedSomething) {
		placedSomething = false;
		for (let i = pending.length - 1; i >= 0; i--) {
			const entry = pending[i]!;
			const parent = entry.parentCode === null ? null : byCode.get(entry.parentCode);
			if (entry.parentCode !== null && !parent) {
				continue;
			}
			const node: TaxonomyNode = { code: entry.code, label: entry.label };
			if (parent) {
				parent.children = [...(parent.children ?? []), node];
			} else {
				root.push(node);
			}
			byCode.set(node.code, node);
			pending.splice(i, 1);
			placedSomething = true;
		}
	}
	return { root: { children: root } };
}

function cloneNode(node: TaxonomyNode): TaxonomyNode {
	return { ...node, children: node.children?.map(cloneNode) };
}

function index(nodes: TaxonomyNode[], byCode: Map<string, TaxonomyNode>): void {
	for (const node of nodes) {
		byCode.set(node.code, node);
		if (node.children) {
			index(node.children, byCode);
		}
	}
}
