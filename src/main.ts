import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, NoteFilerSettings } from './settings';

export default class NoteFilerPlugin extends Plugin {
	settings!: NoteFilerSettings;

	async onload() {
		await this.loadSettings();
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<NoteFilerSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
