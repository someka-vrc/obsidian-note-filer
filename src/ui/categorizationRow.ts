import type { App, TFile } from 'obsidian';
import type { Candidate } from '../categorizer/types';
import { currentFolder, hasNameConflict } from '../vault/mover';
import type { CategorizationRow } from './categorizationModal';
import {
	computeRowState,
	displayFolder,
	formatCandidate,
	resolveDestFolder,
} from './rowState';
import type { RowState } from './rowState';

export interface RowHandlers {
	onSkip: (row: CategorizationRowView) => void;
	onMove: (row: CategorizationRowView) => void;
}

/** The DOM and the state of one row in the categorization view. */
export class CategorizationRowView {
	readonly file: TFile;
	readonly el: HTMLElement;
	state: RowState;

	private readonly candidates: Candidate[];
	private readonly parentLabels: string[];
	private readonly error: string | null;
	private readonly folderBefore: string;
	private selectedIndex = 0;

	private readonly destEl: HTMLElement;
	private readonly warningEl: HTMLElement;
	private readonly moveButton: HTMLButtonElement;

	constructor(
		listEl: HTMLElement,
		private readonly app: App,
		row: CategorizationRow,
		private readonly categorizedFolder: string,
		handlers: RowHandlers,
	) {
		this.file = row.file;
		this.folderBefore = currentFolder(row.file);
		if (row.outcome.ok) {
			this.candidates = row.outcome.categorization.candidates.slice(0, 3);
			this.parentLabels = row.outcome.categorization.parents.map((parent) => parent.label);
			this.error = this.candidates.length === 0 ? 'No candidates were found.' : null;
		} else {
			this.candidates = [];
			this.parentLabels = [];
			this.error = row.outcome.error;
		}

		this.el = listEl.createDiv({ cls: 'note-filer-row' });
		const bodyEl = this.el.createDiv({ cls: 'note-filer-row-body' });

		const topEl = bodyEl.createDiv({ cls: 'note-filer-row-top' });
		topEl.createSpan({
			cls: 'note-filer-file-name',
			text: this.file.name,
			attr: { title: this.file.path },
		});
		if (this.error === null) {
			const selectEl = topEl.createEl('select', { cls: 'dropdown note-filer-candidate' });
			this.candidates.forEach((candidate, index) => {
				selectEl.createEl('option', {
					text: formatCandidate(candidate.label, candidate.probability),
					value: String(index),
				});
			});
			selectEl.addEventListener('change', () => {
				this.selectedIndex = Number(selectEl.value);
				this.refresh();
			});
		} else {
			topEl.createSpan({
				cls: 'note-filer-error-label',
				text: 'Error',
				attr: { title: this.error },
			});
		}

		const pathsEl = bodyEl.createDiv({ cls: 'note-filer-row-paths' });
		const currentEl = pathsEl.createSpan({
			cls: 'note-filer-path',
			text: displayFolder(this.folderBefore),
			attr: { title: displayFolder(this.folderBefore) },
		});
		currentEl.addClass('is-current');
		pathsEl.createSpan({ cls: 'note-filer-path-arrow', text: '→' });
		this.destEl = pathsEl.createSpan({ cls: 'note-filer-path is-destination' });

		this.warningEl = bodyEl.createDiv({ cls: 'note-filer-row-warning' });

		const actionsEl = this.el.createDiv({ cls: 'note-filer-row-actions' });
		const skipButton = actionsEl.createEl('button', { text: 'Skip' });
		skipButton.addEventListener('click', () => handlers.onSkip(this));
		this.moveButton = actionsEl.createEl('button', { text: 'Move', cls: 'mod-cta' });
		this.moveButton.addEventListener('click', () => handlers.onMove(this));

		this.state = this.compute();
		this.render();
	}

	/** Probability of the selected candidate, or `null` when there are no candidates. */
	get selectedProbability(): number | null {
		return this.candidates[this.selectedIndex]?.probability ?? null;
	}

	remove(): void {
		this.el.remove();
	}

	private compute(): RowState {
		const label = this.candidates[this.selectedIndex]?.label ?? null;
		const nameConflict =
			label !== null &&
			hasNameConflict(
				this.app,
				this.file,
				resolveDestFolder(this.categorizedFolder, this.parentLabels, label),
			);
		return computeRowState({
			currentFolder: this.folderBefore,
			categorizedFolder: this.categorizedFolder,
			parentLabels: this.parentLabels,
			selectedLabel: label,
			error: this.error,
			nameConflict,
		});
	}

	private refresh(): void {
		this.state = this.compute();
		this.render();
	}

	private render(): void {
		const hasDest = this.error === null;
		const dest = hasDest ? displayFolder(this.state.destFolder) : '-';
		this.destEl.setText(dest);
		this.destEl.setAttribute('title', dest);
		this.warningEl.setText(this.state.warning ?? '');
		this.warningEl.setAttribute('title', this.state.warning ?? '');
		this.warningEl.toggleClass('is-empty', this.state.warning === null);
		this.moveButton.setText(this.state.sameFolder ? 'OK' : 'Move');
		this.moveButton.disabled = !this.state.canMove;
	}
}
