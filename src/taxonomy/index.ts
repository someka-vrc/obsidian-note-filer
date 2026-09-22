import iab from './data/IAB_ContentsTaxonomy.json';
import thema from './data/Thema.json';
import { mergeCustomEntries } from './customEntries';
import type { CategorizationMethod, CustomTaxonomyEntry, Taxonomy } from './types';

const TAXONOMIES: Record<CategorizationMethod, Taxonomy> = {
	thema,
	iab,
};

/** Loads the preset taxonomy for `method`, with any matching `customEntries` grafted on. */
export function loadTaxonomy(method: CategorizationMethod, customEntries: CustomTaxonomyEntry[] = []): Taxonomy {
	const base = TAXONOMIES[method];
	const relevant = customEntries.filter((entry) => entry.method === method);
	return relevant.length === 0 ? base : mergeCustomEntries(base, relevant);
}
