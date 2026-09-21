import { describe, expect, it } from 'vitest';
import { loadTaxonomy } from './index';
import type { TaxonomyNode } from './types';

function countByDepth(nodes: TaxonomyNode[], depth = 0, counts: number[] = []): number[] {
	counts[depth] = (counts[depth] ?? 0) + nodes.length;
	for (const node of nodes) {
		countByDepth(node.children ?? [], depth + 1, counts);
	}
	return counts.filter((count) => count > 0);
}

function allNodes(nodes: TaxonomyNode[]): TaxonomyNode[] {
	return nodes.flatMap((node) => [node, ...allNodes(node.children ?? [])]);
}

describe('bundled taxonomies', () => {
	it('has the Thema levels that the Jev experiments were run on', () => {
		expect(countByDepth(loadTaxonomy('thema').root.children).slice(0, 2)).toEqual([20, 147]);
	});

	it('has the IAB top levels', () => {
		expect(countByDepth(loadTaxonomy('iab').root.children).slice(0, 2)).toEqual([37, 325]);
	});

	it.each(['thema', 'iab'] as const)('%s labels are usable as folder names', (method) => {
		const nodes = allNodes(loadTaxonomy(method).root.children);
		for (const node of nodes) {
			expect(node.label).not.toMatch(/[\\/:*?"<>|&]/);
			expect(node.label).toBe(node.label.trim());
			expect(node.label).not.toBe('');
		}
		expect(new Set(nodes.map((node) => node.code)).size).toBe(nodes.length);
	});

	it('keeps sibling labels unique, so different categories never share a folder', () => {
		for (const method of ['thema', 'iab'] as const) {
			for (const node of [{ children: loadTaxonomy(method).root.children } as TaxonomyNode].concat(
				allNodes(loadTaxonomy(method).root.children),
			)) {
				const labels = (node.children ?? []).map((child) => child.label.toLowerCase());
				expect(new Set(labels).size).toBe(labels.length);
			}
		}
	});
});
