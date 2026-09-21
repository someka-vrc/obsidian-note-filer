export interface TaxonomyNode {
	code: string;
	label: string;
	children?: TaxonomyNode[];
}

export interface Taxonomy {
	root: { children: TaxonomyNode[] };
}

export type CategorizationMethod = 'thema' | 'iab';

/** Display names shown in the settings and the categorization view. */
export const METHOD_DISPLAY_NAMES: Record<CategorizationMethod, string> = {
	thema: 'Thema',
	iab: 'IAB Contents Taxonomy',
};
