import { describe, expect, it } from 'vitest';
import { destinationFolder, destinationPath, parseFolderSetting } from './mover';

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

describe('parseFolderSetting', () => {
	it('normalizes slashes and spaces, and treats empty input as the vault root', () => {
		expect(parseFolderSetting('Categorized')).toBe('Categorized');
		expect(parseFolderSetting(' /Categorized//Sub/ ')).toBe('Categorized/Sub');
		expect(parseFolderSetting('')).toBe('');
		expect(parseFolderSetting('/')).toBe('');
	});

	it('rejects characters that cannot be in a folder name and relative segments', () => {
		expect(parseFolderSetting('a:b')).toBeNull();
		expect(parseFolderSetting('a\\b')).toBeNull();
		expect(parseFolderSetting('What?')).toBeNull();
		expect(parseFolderSetting('../outside')).toBeNull();
		expect(parseFolderSetting('a/./b')).toBeNull();
	});
});
