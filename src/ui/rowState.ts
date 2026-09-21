/**
 * Pure state logic for the rows of the categorization view.
 * Nothing here touches the DOM or the Obsidian API, so it can be tested on its own.
 */
import { destinationFolder } from '../vault/mover';

export interface RowStateInput {
	/** Folder of the note now; the vault root is an empty string. */
	currentFolder: string;
	/** The Categorized folder setting; an empty string is the vault root. */
	categorizedFolder: string;
	/** Labels of the levels above the candidate. */
	parentLabels: string[];
	/** Label of the candidate that is selected in the dropdown, or `null` when there are no candidates. */
	selectedLabel: string | null;
	/** Error message when no candidates were obtained, otherwise `null`. */
	error: string | null;
	/** Whether another file with the same name exists in the destination folder. */
	nameConflict: boolean;
}

export interface RowState {
	/** Destination folder path; an empty string when there is no destination. */
	destFolder: string;
	/** True when the destination is the folder the note is already in. */
	sameFolder: boolean;
	/** Whether the Move (or OK) button is enabled. */
	canMove: boolean;
	/** Why the row cannot be moved, or `null`. */
	warning: string | null;
}

export const NAME_CONFLICT_WARNING =
	'A file with the same name already exists in the destination folder.';

/** Folder path of the selected candidate: `<categorized folder>/<parent labels>/<label>`. */
export function resolveDestFolder(
	categorizedFolder: string,
	parentLabels: string[],
	selectedLabel: string,
): string {
	return destinationFolder(categorizedFolder, [...parentLabels, selectedLabel]);
}

export function computeRowState(input: RowStateInput): RowState {
	if (input.error !== null || input.selectedLabel === null) {
		const detail = input.error ?? 'No candidates were found.';
		return {
			destFolder: '',
			sameFolder: false,
			canMove: false,
			warning: `Categorization failed: ${detail}`,
		};
	}
	const destFolder = resolveDestFolder(
		input.categorizedFolder,
		input.parentLabels,
		input.selectedLabel,
	);
	const sameFolder = destFolder === input.currentFolder;
	// Nothing is moved when the note is already there, so a name clash cannot occur.
	if (!sameFolder && input.nameConflict) {
		return { destFolder, sameFolder, canMove: false, warning: NAME_CONFLICT_WARNING };
	}
	return { destFolder, sameFolder, canMove: true, warning: null };
}

/** Whether "Move all" handles this row: it can be moved and the selected candidate reaches the threshold. */
export function isMoveAllTarget(
	state: RowState,
	selectedProbability: number | null,
	threshold: number,
): boolean {
	return state.canMove && selectedProbability !== null && selectedProbability >= threshold;
}

/** Text of a dropdown option: `Label (0.87)`. */
export function formatCandidate(label: string, probability: number): string {
	return `${label} (${probability.toFixed(2)})`;
}

/** Folder path for display; the vault root is shown as `(root)`. */
export function displayFolder(path: string): string {
	return path === '' ? '(root)' : path;
}

/**
 * Turns the text of the threshold input into a value from 0.0 to 1.0, rounded to two decimals.
 * Returns `null` when the text is not a number.
 */
export function parseThreshold(text: string): number | null {
	if (text.trim() === '') {
		return null;
	}
	const value = Number(text);
	if (!Number.isFinite(value)) {
		return null;
	}
	return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}
