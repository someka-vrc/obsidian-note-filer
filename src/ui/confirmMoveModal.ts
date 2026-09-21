import { Modal } from 'obsidian';
import type { App } from 'obsidian';

/** Asks whether to move many notes at once. Resolves to `true` only when the user confirms. */
export class ConfirmMoveModal extends Modal {
	private resolve: ((confirmed: boolean) => void) | null = null;

	constructor(
		app: App,
		private readonly count: number,
	) {
		super(app);
	}

	/** Opens the dialog and waits for the answer. */
	ask(): Promise<boolean> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}

	onOpen(): void {
		this.setTitle('Move all notes');
		this.contentEl.createEl('p', { text: `Move ${this.count} notes to their categorized folders?` });
		const buttons = this.contentEl.createDiv({ cls: 'modal-button-container' });
		const confirmButton = buttons.createEl('button', { text: 'Confirm', cls: 'mod-cta' });
		confirmButton.addEventListener('click', () => this.answer(true));
		const cancelButton = buttons.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => this.answer(false));
		confirmButton.focus();
	}

	onClose(): void {
		this.contentEl.empty();
		this.finish(false);
	}

	private answer(confirmed: boolean): void {
		this.finish(confirmed);
		this.close();
	}

	private finish(confirmed: boolean): void {
		this.resolve?.(confirmed);
		this.resolve = null;
	}
}
