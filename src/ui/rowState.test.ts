import { describe, expect, it } from 'vitest';
import {
	computeRowState,
	displayFolder,
	formatCandidate,
	isMoveAllTarget,
	NAME_CONFLICT_WARNING,
	parseThreshold,
	type RowStateInput,
} from './rowState';

const base: RowStateInput = {
	currentFolder: '',
	categorizedFolder: 'Categorized',
	parentLabels: ['The Arts'],
	selectedLabel: 'Theory of art',
	error: null,
	nameConflict: false,
};

describe('computeRowState', () => {
	it('allows moving a note to the nested category folder', () => {
		expect(computeRowState(base)).toEqual({
			destFolder: 'Categorized/The Arts/Theory of art',
			sameFolder: false,
			canMove: true,
			warning: null,
		});
	});

	it('disables the move and warns when a file with the same name exists', () => {
		const state = computeRowState({ ...base, nameConflict: true });
		expect(state.canMove).toBe(false);
		expect(state.warning).toBe(NAME_CONFLICT_WARNING);
	});

	it('treats a note that is already in the destination as OK, whatever the conflict check says', () => {
		const state = computeRowState({
			...base,
			currentFolder: 'Categorized/The Arts/Theory of art',
			nameConflict: true,
		});
		expect(state).toMatchObject({ sameFolder: true, canMove: true, warning: null });
	});

	it('disables the move for an error row', () => {
		const state = computeRowState({ ...base, selectedLabel: null, error: 'HTTP 503' });
		expect(state.canMove).toBe(false);
		expect(state.warning).toContain('HTTP 503');
	});

	it('disables the move when there is no candidate and no error message', () => {
		const state = computeRowState({ ...base, selectedLabel: null });
		expect(state.canMove).toBe(false);
	});

	it('puts notes at the vault root when the categorized folder is empty', () => {
		const state = computeRowState({ ...base, categorizedFolder: '', parentLabels: [] });
		expect(state.destFolder).toBe('Theory of art');
	});
});

describe('isMoveAllTarget', () => {
	const movable = computeRowState(base);

	it('includes rows whose probability reaches the threshold', () => {
		expect(isMoveAllTarget(movable, 0.4, 0.4)).toBe(true);
		expect(isMoveAllTarget(movable, 0.9, 0.4)).toBe(true);
	});

	it('leaves out rows below the threshold', () => {
		expect(isMoveAllTarget(movable, 0.399, 0.4)).toBe(false);
	});

	it('leaves out rows that cannot be moved', () => {
		expect(isMoveAllTarget(computeRowState({ ...base, nameConflict: true }), 0.9, 0.4)).toBe(false);
		expect(isMoveAllTarget(computeRowState({ ...base, error: 'x' }), null, 0)).toBe(false);
	});
});

describe('formatting helpers', () => {
	it('formats a candidate with two decimals', () => {
		expect(formatCandidate('Theory of art', 0.876)).toBe('Theory of art (0.88)');
	});

	it('shows the vault root as (root)', () => {
		expect(displayFolder('')).toBe('(root)');
		expect(displayFolder('Notes')).toBe('Notes');
	});

	it('parses the threshold, clamping to 0 to 1', () => {
		expect(parseThreshold('0.456')).toBe(0.46);
		expect(parseThreshold('1.5')).toBe(1);
		expect(parseThreshold('-1')).toBe(0);
		expect(parseThreshold('abc')).toBeNull();
		expect(parseThreshold('')).toBeNull();
	});
});
