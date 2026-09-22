import { Notice, requestUrl, type TFile } from 'obsidian';
import { CancelledError } from './categorizer/cancel';
import { categorizeNote } from './categorizer/categorizer';
import { CachingJevAsker, JevAnswerCache, JevApiError, JevClient, type Transport } from './categorizer/jevClient';
import { extractNoteInput } from './categorizer/noteInput';
import { mapWithConcurrency } from './categorizer/pool';
import type NoteFilerPlugin from './main';
import { loadTaxonomy } from './taxonomy';
import { METHOD_DISPLAY_NAMES } from './taxonomy/types';
import { CategorizationModal, type CategorizationRow } from './ui/categorizationModal';
import type { StatusBarController } from './ui/statusBar';

const CONCURRENCY = 8;

const obsidianTransport: Transport = async (request) => {
	const response = await requestUrl({
		url: request.url,
		method: request.method,
		headers: request.headers,
		body: request.body,
		throw: false,
	});
	return { status: response.status, text: response.text };
};

/** Categorizes notes and shows the result. Only one run can be active at a time. */
export class CategorizeRunner {
	private controller: AbortController | null = null;
	/** Survives across runs for the plugin's lifetime, so repeated requests skip the API. */
	private readonly jevCache = new JevAnswerCache();

	constructor(
		private readonly plugin: NoteFilerPlugin,
		private readonly statusBar: StatusBarController,
	) {}

	cancel(): void {
		this.controller?.abort();
	}

	async run(files: TFile[]): Promise<void> {
		if (this.controller) {
			new Notice('Categorization is already running.');
			return;
		}
		if (files.length === 0) {
			new Notice('There are no notes to categorize.');
			return;
		}
		const { app, settings } = this.plugin;
		const apiKey = settings.apiKeySecretName
			? app.secretStorage.getSecret(settings.apiKeySecretName)
			: null;
		if (!apiKey) {
			new Notice('Select an API key in the plugin settings first.');
			return;
		}

		const controller = new AbortController();
		this.controller = controller;
		const client = new CachingJevAsker(
			new JevClient({ url: settings.apiServerUrl, apiKey, transport: obsidianTransport }),
			this.jevCache,
		);
		const options = {
			method: settings.categorizationMethod,
			taxonomy: loadTaxonomy(settings.categorizationMethod, settings.customEntries),
			depth: settings.categorizationDepth,
		};

		let done = 0;
		this.statusBar.showProgress(done, files.length);
		try {
			const rows = await mapWithConcurrency<TFile, CategorizationRow>(
				files,
				CONCURRENCY,
				async (file) => {
					try {
						const content = await app.vault.cachedRead(file);
						const input = extractNoteInput(file.basename, content);
						const categorization = await categorizeNote(input, options, client, controller.signal);
						return { file, outcome: { ok: true, categorization } };
					} catch (error) {
						if (error instanceof JevApiError && error.status === 401) {
							new Notice(error.message);
							controller.abort();
						}
						if (error instanceof CancelledError) {
							throw error;
						}
						const message = error instanceof Error ? error.message : String(error);
						return { file, outcome: { ok: false, error: message } };
					} finally {
						this.statusBar.showProgress(++done, files.length);
					}
				},
				controller.signal,
			);

			new CategorizationModal(app, {
				rows,
				methodName: METHOD_DISPLAY_NAMES[settings.categorizationMethod],
				categorizedFolder: settings.categorizedFolder,
				confidenceThreshold: settings.confidenceThreshold,
				onThresholdChange: (value) => {
					settings.confidenceThreshold = value;
					void this.plugin.saveSettings();
				},
			}).open();
		} catch (error) {
			if (!(error instanceof CancelledError)) {
				throw error;
			}
			new Notice('Categorization was cancelled.');
		} finally {
			this.statusBar.hideProgress();
			this.controller = null;
		}
	}
}
