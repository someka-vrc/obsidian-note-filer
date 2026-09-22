export interface TaxonomyNode {
	code: string;
	label: string;
	children?: TaxonomyNode[];
}

/** A category as it is shown to the user and used as a folder name. */
export interface CategoryRef {
	code: string;
	label: string;
}

export interface Taxonomy {
	root: { children: TaxonomyNode[] };
}

export type CategorizationMethod = 'thema' | 'iab';

/** A user-defined category grafted onto a preset taxonomy. */
export interface CustomTaxonomyEntry {
	/** Generated id used as the node's code. Not shown to the user. */
	code: string;
	method: CategorizationMethod;
	/** Code of the node this category is placed under, or null for a top-level category. */
	parentCode: string | null;
	label: string;
}

/** Display names shown in the settings and the categorization view. */
export const METHOD_DISPLAY_NAMES: Record<CategorizationMethod, string> = {
	thema: 'Thema',
	iab: 'IAB Contents Taxonomy',
};
