import { PluginSettingTab, SecretComponent, Setting } from 'obsidian';
import type { App } from 'obsidian';
import type NoteFilerPlugin from '../main';
import { DEFAULT_API_SERVER_URL, parseDepthSetting } from '../settings';
import { METHOD_DISPLAY_NAMES } from '../taxonomy/types';
import type { CategorizationMethod } from '../taxonomy/types';
import { parseFolderSetting } from '../vault/mover';
import { FolderSuggest } from './folderSuggest';
import { parseThreshold } from './rowState';

export class NoteFilerSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: NoteFilerPlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		this.addApiServerUrl(containerEl);
		this.addApiKey(containerEl);
		this.addCategorizedFolder(containerEl);
		this.addMethod(containerEl);
		this.addDepth(containerEl);
		this.addThreshold(containerEl);
	}

	private async save(): Promise<void> {
		await this.plugin.saveSettings();
	}

	private addApiServerUrl(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Typesafe API server URL')
			.setDesc('URL of the API server that receives note titles and excerpts for categorization.')
			.addText((text) => {
				text
					.setPlaceholder(DEFAULT_API_SERVER_URL)
					.setValue(this.plugin.settings.apiServerUrl)
					.onChange(async (value) => {
						this.plugin.settings.apiServerUrl = value.trim();
						await this.save();
					});
				text.inputEl.addClass('note-filer-wide-input');
			})
			.addExtraButton((button) => {
				button
					.setIcon('rotate-ccw')
					.setTooltip('Reset to default')
					.onClick(async () => {
						this.plugin.settings.apiServerUrl = DEFAULT_API_SERVER_URL;
						await this.save();
						this.display();
					});
			});
	}

	private addApiKey(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Typesafe API key')
			.setDesc('Select a secret that holds the API key.')
			.addComponent((el) =>
				new SecretComponent(this.app, el)
					.setValue(this.plugin.settings.apiKeySecretName)
					.onChange(async (name) => {
						this.plugin.settings.apiKeySecretName = name;
						await this.save();
					}),
			);
	}

	private addCategorizedFolder(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Categorized folder')
			.setDesc(
				'Root folder for the categorized notes.',
			)
			.addSearch((search) => {
				const inputEl = search.inputEl;
				search.setPlaceholder('Vault root').setValue(this.plugin.settings.categorizedFolder);
				const suggest = new FolderSuggest(this.app, inputEl);
				suggest.onSelect((folder) => {
					suggest.setValue(folder.path);
					inputEl.dispatchEvent(new Event('input'));
					suggest.close();
				});
				inputEl.addEventListener('input', () => {
					const value = parseFolderSetting(inputEl.value);
					inputEl.toggleClass('note-filer-invalid', value === null);
					if (value !== null) {
						this.plugin.settings.categorizedFolder = value;
						void this.save();
					}
				});
				inputEl.addEventListener('blur', () => {
					inputEl.value = this.plugin.settings.categorizedFolder;
					inputEl.toggleClass('note-filer-invalid', false);
				});
			});
	}

	private addMethod(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Categorization method')
			.setDesc('Taxonomy used to categorize notes.')
			.addDropdown((dropdown) => {
				for (const [method, name] of Object.entries(METHOD_DISPLAY_NAMES)) {
					dropdown.addOption(method, name);
				}
				dropdown.setValue(this.plugin.settings.categorizationMethod).onChange(async (value) => {
					this.plugin.settings.categorizationMethod = value as CategorizationMethod;
					await this.save();
				});
			});
	}

	private addDepth(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Categorization depth')
			.setDesc(
				'How many levels of the taxonomy to categorize. Use a whole number of 1 or more, or 0 for no limit. If the taxonomy has fewer levels, notes are categorized down to the deepest level.',
			)
			.addText((text) => {
				text.inputEl.type = 'number';
				text.inputEl.min = '0';
				text.inputEl.step = '1';
				this.bindNumberInput(
					text.inputEl,
					() => this.plugin.settings.categorizationDepth,
					parseDepthSetting,
					async (value) => {
						this.plugin.settings.categorizationDepth = value;
						await this.save();
					},
				);
			});
	}

	private addThreshold(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Confidence threshold')
			.setDesc(
				'Candidates at or above this confidence are moved by Move all. Use a number from 0.0 to 1.0. You can also change it in the categorization view.',
			)
			.addText((text) => {
				text.inputEl.type = 'number';
				text.inputEl.min = '0';
				text.inputEl.max = '1';
				text.inputEl.step = '0.1';
				this.bindNumberInput(
					text.inputEl,
					() => this.plugin.settings.confidenceThreshold,
					(input) => {
						const value = Number(input);
						// Out of range input is not saved (unlike the categorization view, which rounds it).
						return input.trim() !== '' && value >= 0 && value <= 1
							? parseThreshold(input)
							: null;
					},
					async (value) => {
						this.plugin.settings.confidenceThreshold = value;
						await this.save();
					},
				);
			});
	}

	/**
	 * Wires a numeric text input: valid input is saved as it is typed, invalid input is not saved and is
	 * marked as such, and the last saved value is restored when the input loses focus.
	 */
	private bindNumberInput(
		inputEl: HTMLInputElement,
		getSaved: () => number,
		parse: (input: string) => number | null,
		save: (value: number) => Promise<void>,
	): void {
		inputEl.value = String(getSaved());
		inputEl.addEventListener('input', () => {
			const value = parse(inputEl.value);
			inputEl.toggleClass('note-filer-invalid', value === null);
			if (value !== null) {
				void save(value);
			}
		});
		inputEl.addEventListener('blur', () => {
			inputEl.value = String(getSaved());
			inputEl.toggleClass('note-filer-invalid', false);
		});
	}
}
