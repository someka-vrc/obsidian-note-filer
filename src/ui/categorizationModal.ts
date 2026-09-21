import { Modal, Notice } from 'obsidian';
import type { App, TFile } from 'obsidian';
import type { Categorization } from '../categorizer/types';
import { moveNote } from '../vault/mover';
import { CategorizationRowView } from './categorizationRow';
import { ConfirmMoveModal } from './confirmMoveModal';
import { isMoveAllTarget, parseThreshold } from './rowState';

export interface CategorizationRow {
	file: TFile;
	outcome: { ok: true; categorization: Categorization } | { ok: false; error: string };
}

export interface CategorizationModalOptions {
	rows: CategorizationRow[];
	/** Display name of the categorization method, shown in the footer. */
	methodName: string;
	/** The Categorized folder setting; an empty string is the vault root. */
	categorizedFolder: string;
	/** Initial confidence threshold. */
	confidenceThreshold: number;
	/** Called when the threshold is changed. Saving it is up to the caller. */
	onThresholdChange: (value: number) => void;
}

/** Move all asks for confirmation when it would move at least this many notes. */
const CONFIRM_MOVE_ALL_AT = 100;

export class CategorizationModal extends Modal {
	private readonly rows = new Set<CategorizationRowView>();
	private threshold: number;
	private busy = false;
	private closed = false;

	private countEl!: HTMLElement;
	private thresholdInput!: HTMLInputElement;

	constructor(
		app: App,
		private readonly options: CategorizationModalOptions,
	) {
		super(app);
		this.threshold = parseThreshold(String(options.confidenceThreshold)) ?? 0;
	}

	onOpen(): void {
		this.modalEl.addClass('note-filer-modal');
		this.setTitle('Categorize and move');

		const listEl = this.contentEl.createDiv({ cls: 'note-filer-list' });
		for (const row of this.options.rows) {
			this.rows.add(
				new CategorizationRowView(listEl, this.app, row, this.options.categorizedFolder, {
					onSkip: (view) => this.skip(view),
					onMove: (view) => void this.moveOne(view),
				}),
			);
		}
		this.buildFooter();
		this.updateCount();
		if (this.rows.size === 0) {
			this.close();
		}
	}

	onClose(): void {
		this.closed = true;
		this.rows.clear();
		this.contentEl.empty();
	}

	private buildFooter(): void {
		const footerEl = this.contentEl.createDiv({ cls: 'note-filer-footer' });
		this.countEl = footerEl.createSpan({ cls: 'note-filer-footer-item' });
		footerEl.createSpan({
			cls: 'note-filer-footer-item',
			text: `Method: ${this.options.methodName}`,
			attr: { title: this.options.methodName },
		});

		const thresholdEl = footerEl.createEl('label', { cls: 'note-filer-footer-item' });
		thresholdEl.createSpan({ text: 'Threshold' });
		this.thresholdInput = thresholdEl.createEl('input', {
			cls: 'note-filer-threshold',
			type: 'number',
			attr: { min: '0', max: '1', step: '0.1' },
		});
		this.thresholdInput.value = String(this.threshold);
		this.thresholdInput.addEventListener('change', () => this.commitThreshold());

		const cancelButton = footerEl.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => this.close());
		const moveAllButton = footerEl.createEl('button', { text: 'Move all', cls: 'mod-cta' });
		moveAllButton.addEventListener('click', () => void this.moveAll());
	}

	private commitThreshold(): void {
		const value = parseThreshold(this.thresholdInput.value);
		if (value === null) {
			// Not a number: go back to the last valid value.
			this.thresholdInput.value = String(this.threshold);
			return;
		}
		this.thresholdInput.value = String(value);
		if (value !== this.threshold) {
			this.threshold = value;
			this.options.onThresholdChange(value);
		}
	}

	private updateCount(): void {
		const count = this.rows.size;
		this.countEl.setText(`${count} ${count === 1 ? 'note' : 'notes'}`);
	}

	private removeRow(view: CategorizationRowView): void {
		view.remove();
		this.rows.delete(view);
		if (this.closed) {
			return;
		}
		this.updateCount();
		if (this.rows.size === 0) {
			this.close();
		}
	}

	private setBusy(busy: boolean): void {
		this.busy = busy;
		this.modalEl.toggleClass('is-busy', busy);
	}

	private skip(view: CategorizationRowView): void {
		if (!this.busy) {
			this.removeRow(view);
		}
	}

	private async moveOne(view: CategorizationRowView): Promise<void> {
		if (this.busy || !view.state.canMove) {
			return;
		}
		this.setBusy(true);
		try {
			await this.moveRow(view);
		} finally {
			this.setBusy(false);
		}
	}

	/** Moves the note of a row and removes the row. On failure, shows a notice and keeps the row. */
	private async moveRow(view: CategorizationRowView): Promise<void> {
		try {
			if (!view.state.sameFolder) {
				await moveNote(this.app, view.file, view.state.destFolder);
			}
			this.removeRow(view);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`Could not move "${view.file.name}": ${message}`);
		}
	}

	private async moveAll(): Promise<void> {
		if (this.busy) {
			return;
		}
		// Apply a threshold that has been typed but not committed yet.
		this.commitThreshold();
		const targets = [...this.rows].filter((view) =>
			isMoveAllTarget(view.state, view.selectedProbability, this.threshold),
		);
		if (targets.length === 0) {
			new Notice('No notes to move at this threshold.');
			return;
		}
		this.setBusy(true);
		try {
			if (targets.length >= CONFIRM_MOVE_ALL_AT) {
				const confirmed = await new ConfirmMoveModal(this.app, targets.length).ask();
				if (!confirmed || this.closed) {
					return;
				}
			}
			for (const view of targets) {
				if (this.closed) {
					break;
				}
				await this.moveRow(view);
			}
		} finally {
			this.setBusy(false);
		}
	}
}
