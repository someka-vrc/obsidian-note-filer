import type { CategoryRef, Taxonomy, TaxonomyNode } from './types';

/** A category together with the categories above it (top level first). */
export interface LevelEntry {
	node: TaxonomyNode;
	parents: CategoryRef[];
}

/** Separates the levels in the text of a flat option. `>` cannot appear in a label (see the taxonomy build). */
const PATH_SEPARATOR = ' > ';

/**
 * Lists the categories at `depth` (1 is the top level) in taxonomy order.
 * A category above that depth that has no children is included too, so that no leaf is lost.
 */
export function nodesAtDepth(taxonomy: Taxonomy, depth: number): LevelEntry[] {
	const entries: LevelEntry[] = [];
	const walk = (nodes: TaxonomyNode[], parents: CategoryRef[]): void => {
		for (const node of nodes) {
			if (parents.length + 1 >= depth || !node.children?.length) {
				entries.push({ node, parents });
			} else {
				walk(node.children, [...parents, { code: node.code, label: node.label }]);
			}
		}
	};
	walk(taxonomy.root.children, []);
	return entries;
}

/** `Top > Sub > Category`: the text that lets the model tell apart categories from different branches. */
export function pathLabel(entry: LevelEntry): string {
	return [...entry.parents.map((parent) => parent.label), entry.node.label].join(PATH_SEPARATOR);
}
