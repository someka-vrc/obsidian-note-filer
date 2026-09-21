import iab from './data/IAB_ContentsTaxonomy.json';
import thema from './data/Thema.json';
import type { CategorizationMethod, Taxonomy } from './types';

const TAXONOMIES: Record<CategorizationMethod, Taxonomy> = {
	thema,
	iab,
};

export function loadTaxonomy(method: CategorizationMethod): Taxonomy {
	return TAXONOMIES[method];
}
