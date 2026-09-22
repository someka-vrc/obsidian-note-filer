import type { CategorizationMethod, CustomTaxonomyEntry } from './taxonomy/types';

export interface NoteFilerSettings {
	apiServerUrl: string;
	/** Name of the secret in Obsidian's SecretStorage that holds the Typesafe API key. */
	apiKeySecretName: string;
	categorizedFolder: string;
	categorizationMethod: CategorizationMethod;
	/** How many levels to categorize; 0 means no limit. */
	categorizationDepth: number;
	confidenceThreshold: number;
	/** Categories the user added on top of the preset taxonomies. */
	customEntries: CustomTaxonomyEntry[];
}

/**
 * Turns the text of the depth input into the saved value.
 * An empty text, zero or a negative number mean no limit and are saved as 0.
 * Returns null when the text is not a whole number.
 */
export function parseDepthSetting(text: string): number | null {
	const trimmed = text.trim();
	if (trimmed === '') {
		return 0;
	}
	if (!/^-?\d+$/.test(trimmed)) {
		return null;
	}
	return Math.max(0, Number(trimmed));
}

export const DEFAULT_API_SERVER_URL = 'https://api.typesafe.ai/v1/systemone';

export const DEFAULT_SETTINGS: NoteFilerSettings = {
	apiServerUrl: DEFAULT_API_SERVER_URL,
	apiKeySecretName: '',
	categorizedFolder: 'Categorized',
	categorizationMethod: 'thema',
	categorizationDepth: 2,
	confidenceThreshold: 0.4,
	customEntries: [],
};
