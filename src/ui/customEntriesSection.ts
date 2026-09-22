import { createEntryCode } from '../taxonomy/customEntries';
import { findByCode, pathLabel } from '../taxonomy/levels';
import { loadTaxonomy } from '../taxonomy';
import type { CategorizationMethod, CustomTaxonomyEntry, Taxonomy, TaxonomyNode } from '../taxonomy/types';

export interface CustomEntriesHandlers {
	getEntries: () => CustomTaxonomyEntry[];
	setEntries: (entries: CustomTaxonomyEntry[]) => Promise<void>;
}

/** Characters that cannot appear in a folder name (matches the check the bundled taxonomies pass). */
const INVALID_LABEL_CHARS = /[\\/:*?"<>|&]/;

/** Settings-tab section that lists the custom categories for the current method and lets you add more. */
export class CustomEntriesSection {
	private readonly listEl: HTMLElement;
	private readonly formEl: HTMLElement;
	private method: CategorizationMethod;

	constructor(
		containerEl: HTMLElement,
		private readonly handlers: CustomEntriesHandlers,
		method: CategorizationMethod,
	) {
		this.method = method;
		const wrapperEl = containerEl.createDiv({ cls: 'note-filer-custom-entries' });
		this.listEl = wrapperEl.createDiv({ cls: 'note-filer-custom-entries-list' });
		this.formEl = wrapperEl.createDiv({ cls: 'note-filer-custom-entries-form' });
		this.renderList();
		this.renderAddButton();
	}

	/** Switches which taxonomy method's entries are shown, e.g. after the method setting changes. */
	setMethod(method: CategorizationMethod): void {
		this.method = method;
		this.renderList();
		this.renderAddButton();
	}

	private taxonomy(): Taxonomy {
		return loadTaxonomy(this.method, this.handlers.getEntries());
	}

	private entriesForMethod(): CustomTaxonomyEntry[] {
		return this.handlers.getEntries().filter((entry) => entry.method === this.method);
	}

	private renderList(): void {
		this.listEl.empty();
		const entries = this.entriesForMethod();
		if (entries.length === 0) {
			this.listEl.createDiv({ cls: 'note-filer-custom-entry-empty', text: 'No custom categories yet.' });
			return;
		}
		const taxonomy = this.taxonomy();
		for (const entry of entries) {
			const rowEl = this.listEl.createDiv({ cls: 'note-filer-custom-entry-row' });
			const infoEl = rowEl.createDiv({ cls: 'note-filer-custom-entry-info' });
			infoEl.createDiv({ cls: 'note-filer-custom-entry-label', text: entry.label });
			infoEl.createDiv({
				cls: 'note-filer-custom-entry-parent',
				text: entry.parentCode === null ? 'Top level' : (this.parentPath(taxonomy, entry.parentCode) ?? '?'),
			});
			const removeButton = rowEl.createEl('button', { text: 'Remove' });
			removeButton.addEventListener('click', () => void this.removeEntry(entry.code));
		}
	}

	private async removeEntry(code: string): Promise<void> {
		await this.handlers.setEntries(this.withoutEntryAndDescendants(code));
		this.renderList();
	}

	private parentPath(taxonomy: Taxonomy, parentCode: string): string | null {
		const entry = findByCode(taxonomy, parentCode);
		return entry ? pathLabel(entry) : null;
	}

	private withoutEntryAndDescendants(code: string): CustomTaxonomyEntry[] {
		const all = this.handlers.getEntries();
		const toRemove = new Set<string>([code]);
		let changed = true;
		while (changed) {
			changed = false;
			for (const entry of all) {
				if (entry.parentCode !== null && toRemove.has(entry.parentCode) && !toRemove.has(entry.code)) {
					toRemove.add(entry.code);
					changed = true;
				}
			}
		}
		return all.filter((entry) => !toRemove.has(entry.code));
	}

	private renderAddButton(): void {
		this.formEl.empty();
		const openButton = this.formEl.createEl('button', { text: 'Add category' });
		openButton.addEventListener('click', () => this.renderAddForm());
	}

	private renderAddForm(): void {
		this.formEl.empty();
		const taxonomy = this.taxonomy();
		let parentCode: string | null = null;

		const formBoxEl = this.formEl.createDiv({ cls: 'note-filer-custom-entry-form' });
		formBoxEl.createDiv({ cls: 'note-filer-custom-entry-form-label', text: 'Place under' });
		const pickerEl = formBoxEl.createDiv({ cls: 'note-filer-parent-picker' });
		renderParentPicker(pickerEl, taxonomy.root.children, (code) => {
			parentCode = code;
		});

		formBoxEl.createDiv({ cls: 'note-filer-custom-entry-form-label', text: 'Category name' });
		const labelInput = formBoxEl.createEl('input', {
			type: 'text',
			placeholder: 'New category',
			cls: 'note-filer-wide-input',
		});

		const errorEl = formBoxEl.createDiv({ cls: 'note-filer-custom-entry-error' });

		const actionsEl = formBoxEl.createDiv({ cls: 'note-filer-custom-entry-actions' });
		const addButton = actionsEl.createEl('button', { text: 'Add', cls: 'mod-cta' });
		const cancelButton = actionsEl.createEl('button', { text: 'Cancel' });

		addButton.addEventListener('click', () => {
			const label = labelInput.value.trim();
			const error = validateLabel(label, taxonomy, parentCode);
			if (error) {
				errorEl.setText(error);
				return;
			}
			void this.addEntry({ code: createEntryCode(), method: this.method, parentCode, label });
		});
		cancelButton.addEventListener('click', () => this.renderAddButton());
	}

	private async addEntry(entry: CustomTaxonomyEntry): Promise<void> {
		await this.handlers.setEntries([...this.handlers.getEntries(), entry]);
		this.renderList();
		this.renderAddButton();
	}
}

/**
 * Renders a chain of `<select>`s that let the user drill into `roots` level by level and stop at
 * any level, calling `onChange` with the resulting parent code (null for the top level) each time
 * the selection changes.
 */
function renderParentPicker(
	containerEl: HTMLElement,
	roots: TaxonomyNode[],
	onChange: (parentCode: string | null) => void,
): void {
	containerEl.empty();
	onChange(null);
	renderLevel(containerEl, roots, null);

	function renderLevel(levelEl: HTMLElement, nodes: TaxonomyNode[], stopAtCode: string | null): void {
		const selectEl = levelEl.createEl('select', { cls: 'dropdown' });
		selectEl.createEl('option', {
			text: stopAtCode === null ? 'Top level' : 'Add here',
			value: '',
		});
		for (const node of nodes) {
			selectEl.createEl('option', { text: node.label, value: node.code });
		}
		const nextLevelEl = levelEl.createDiv();
		selectEl.addEventListener('change', () => {
			nextLevelEl.empty();
			if (selectEl.value === '') {
				onChange(stopAtCode);
				return;
			}
			const node = nodes.find((candidate) => candidate.code === selectEl.value);
			if (!node) {
				return;
			}
			onChange(node.code);
			if (node.children?.length) {
				renderLevel(nextLevelEl, node.children, node.code);
			}
		});
	}
}

function validateLabel(label: string, taxonomy: Taxonomy, parentCode: string | null): string | null {
	if (label === '') {
		return 'Enter a name.';
	}
	if (INVALID_LABEL_CHARS.test(label)) {
		return 'The name cannot contain \\ / : * ? " < > | or &.';
	}
	const siblings = parentCode === null ? taxonomy.root.children : (findByCode(taxonomy, parentCode)?.node.children ?? []);
	if (siblings.some((sibling) => sibling.label.toLowerCase() === label.toLowerCase())) {
		return 'A category with this name already exists at this level.';
	}
	return null;
}
