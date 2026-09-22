import { describe, expect, it } from 'vitest';
import { loadTaxonomy } from './index';
import { nodesAtDepth, pathLabel } from './levels';
import type { Taxonomy } from './types';

const taxonomy: Taxonomy = {
	root: {
		children: [
			{
				code: 'A',
				label: 'Arts',
				children: [
					{ code: 'AB', label: 'Theory' },
					{ code: 'AC', label: 'Painting', children: [{ code: 'ACA', label: 'Oil' }] },
				],
			},
			{ code: 'B', label: 'Business' },
		],
	},
};

describe('nodesAtDepth', () => {
	it('lists the top level for depth 1', () => {
		expect(nodesAtDepth(taxonomy, 1).map((e) => e.node.code)).toEqual(['A', 'B']);
	});

	it('lists the second level, keeps a leaf above it, and records the parents', () => {
		const entries = nodesAtDepth(taxonomy, 2);
		expect(entries.map((e) => e.node.code)).toEqual(['AB', 'AC', 'B']);
		expect(entries[0]?.parents).toEqual([{ code: 'A', label: 'Arts' }]);
		expect(entries[2]?.parents).toEqual([]);
	});

	it('lists the deepest categories when depth exceeds the taxonomy', () => {
		expect(nodesAtDepth(taxonomy, 9).map((e) => e.node.code)).toEqual(['AB', 'ACA', 'B']);
	});

	it('matches the level sizes of Thema', () => {
		const thema = loadTaxonomy('thema');
		expect(nodesAtDepth(thema, 1)).toHaveLength(20);
		expect(nodesAtDepth(thema, 2)).toHaveLength(147);
		// The 1,162 third-level categories and the 14 second-level leaves.
		expect(nodesAtDepth(thema, 3)).toHaveLength(1162 + 14);
	});
});

describe('pathLabel', () => {
	it('joins the parent labels and the label', () => {
		const [first] = nodesAtDepth(taxonomy, 3);
		expect(first && pathLabel(first)).toBe('Arts > Theory');
		expect(pathLabel({ node: { code: 'B', label: 'Business' }, parents: [] })).toBe('Business');
	});
});
