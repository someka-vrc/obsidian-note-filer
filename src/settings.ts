export type CategorizationMethod = 'thema' | 'iab';

export interface NoteFilerSettings {
	apiServerUrl: string;
	/** Name of the secret in Obsidian's SecretStorage that holds the Typesafe API key. */
	apiKeySecretName: string;
	categorizedFolder: string;
	categorizationMethod: CategorizationMethod;
	categorizationDepth: number;
	confidenceThreshold: number;
}

export const DEFAULT_API_SERVER_URL = 'https://api.typesafe.ai/v1/systemone';

export const DEFAULT_SETTINGS: NoteFilerSettings = {
	apiServerUrl: DEFAULT_API_SERVER_URL,
	apiKeySecretName: '',
	categorizedFolder: 'Categorized',
	categorizationMethod: 'thema',
	categorizationDepth: 2,
	confidenceThreshold: 0.4,
};
