import { describe, expect, it } from 'vitest';
import { destinationFolder, destinationPath } from './mover';

describe('destinationFolder', () => {
	it('nests the labels below the categorized folder', () => {
		expect(destinationFolder('Categorized', ['The Arts', 'Theory of art'])).toBe(
			'Categorized/The Arts/Theory of art',
		);
	});

	it('ignores stray slashes and an empty root', () => {
		expect(destinationFolder('/Categorized/', ['A'])).toBe('Categorized/A');
		expect(destinationFolder('', ['A', 'B'])).toBe('A/B');
	});
});

describe('destinationPath', () => {
	it('puts the file in the folder, or at the vault root when the folder is empty', () => {
		expect(destinationPath('Categorized/A', 'note.md')).toBe('Categorized/A/note.md');
		expect(destinationPath('', 'note.md')).toBe('note.md');
	});
});
