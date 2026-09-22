import { describe, expect, it } from 'vitest';
import { mergeCustomEntries } from './customEntries';
import { loadTaxonomy } from './index';
import type { CustomTaxonomyEntry, Taxonomy } from './types';

const taxonomy: Taxonomy = {
	root: {
		children: [
			{
				code: 'A',
				label: 'Arts',
				children: [{ code: 'AB', label: 'Theory' }],
			},
			{ code: 'B', label: 'Business' },
		],
	},
};

function entry(overrides: Partial<CustomTaxonomyEntry>): CustomTaxonomyEntry {
	return { code: 'custom:1', method: 'thema', parentCode: null, label: 'Custom', ...overrides };
}

describe('mergeCustomEntries', () => {
	it('adds a top-level entry', () => {
		const merged = mergeCustomEntries(taxonomy, [entry({ code: 'c1', label: 'New top' })]);
		expect(merged.root.children.map((n) => n.code)).toEqual(['A', 'B', 'c1']);
	});

	it('nests an entry under an existing preset category', () => {
		const merged = mergeCustomEntries(taxonomy, [entry({ code: 'c1', parentCode: 'A', label: 'New sub' })]);
		const arts = merged.root.children.find((n) => n.code === 'A');
		expect(arts?.children?.map((n) => n.code)).toEqual(['AB', 'c1']);
	});

	it('nests an entry under another custom entry regardless of array order', () => {
		const child = entry({ code: 'c2', parentCode: 'c1', label: 'Grandchild' });
		const parent = entry({ code: 'c1', parentCode: 'A', label: 'Child' });
		const merged = mergeCustomEntries(taxonomy, [child, parent]);
		const arts = merged.root.children.find((n) => n.code === 'A');
		const c1 = arts?.children?.find((n) => n.code === 'c1');
		expect(c1?.children?.map((n) => n.code)).toEqual(['c2']);
	});

	it('drops entries whose parent cannot be found', () => {
		const merged = mergeCustomEntries(taxonomy, [entry({ code: 'c1', parentCode: 'does-not-exist' })]);
		expect(merged.root.children.map((n) => n.code)).toEqual(['A', 'B']);
	});

	it('does not mutate the original taxonomy', () => {
		mergeCustomEntries(taxonomy, [entry({ code: 'c1', parentCode: 'A' })]);
		expect(taxonomy.root.children.find((n) => n.code === 'A')?.children).toEqual([{ code: 'AB', label: 'Theory' }]);
	});
});

describe('loadTaxonomy with custom entries', () => {
	it('only grafts entries that match the requested method', () => {
		const entries = [entry({ code: 'c1', method: 'thema' }), entry({ code: 'c2', method: 'iab' })];
		const thema = loadTaxonomy('thema', entries);
		expect(thema.root.children.map((n) => n.code)).toContain('c1');
		expect(thema.root.children.map((n) => n.code)).not.toContain('c2');
	});

	it('returns the bundled taxonomy unchanged when there are no matching entries', () => {
		expect(loadTaxonomy('thema', [])).toBe(loadTaxonomy('thema'));
	});
});
