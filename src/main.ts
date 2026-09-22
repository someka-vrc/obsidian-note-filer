import { MarkdownView, Notice, Plugin, TFile, TFolder, type Menu, type TAbstractFile } from 'obsidian';
import { CategorizeRunner } from './runner';
import { DEFAULT_SETTINGS, NoteFilerSettings } from './settings';
import { HOVER_LINK_SOURCE } from './ui/categorizationRow';
import { NoteFilerSettingTab } from './ui/settingsTab';
import { StatusBarController } from './ui/statusBar';
import { collectMarkdownFiles } from './vault/collect';

export default class NoteFilerPlugin extends Plugin {
	settings!: NoteFilerSettings;
	private runner!: CategorizeRunner;

	async onload() {
		await this.loadSettings();

		const statusBar = new StatusBarController(this, {
			onClick: () => void this.categorizeActiveNote(),
			onCancel: () => this.runner.cancel(),
		});
		this.runner = new CategorizeRunner(this, statusBar);

		this.addCommand({
			id: 'categorize-current-note',
			name: 'Categorize current note and move',
			callback: () => void this.categorizeActiveNote(),
		});

		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => this.addMenuItem(menu, [file])),
		);
		this.registerEvent(
			this.app.workspace.on('files-menu', (menu, files) => this.addMenuItem(menu, files)),
		);

		this.addSettingTab(new NoteFilerSettingTab(this.app, this));

		this.registerHoverLinkSource(HOVER_LINK_SOURCE, {
			display: 'Note Filer',
			defaultMod: false,
		});
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

	private async categorizeActiveNote(): Promise<void> {
		const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
		if (!file) {
			new Notice('Open a note to categorize.');
			return;
		}
		await this.runner.run([file]);
	}

	/** Adds the menu item for notes and folders; other kinds of files cannot be categorized. */
	private addMenuItem(menu: Menu, targets: TAbstractFile[]): void {
		const categorizable = targets.some(
			(target) => target instanceof TFolder || (target instanceof TFile && target.extension === 'md'),
		);
		if (!categorizable) {
			return;
		}
		menu.addItem((item) =>
			item
				.setTitle('Categorize and move')
				.setIcon('library-big')
				.onClick(() => void this.runner.run(collectMarkdownFiles(targets))),
		);
	}
}
