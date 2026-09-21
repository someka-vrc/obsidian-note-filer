import { describe, expect, it } from 'vitest';
import { extractNoteInput } from './noteInput';

describe('extractNoteInput', () => {
	it('drops the frontmatter, blank lines and image-only lines', () => {
		const content = [
			'---',
			'title: Ignored',
			'tags: [a]',
			'---',
			'',
			'First line',
			'![[photo.png]]',
			'![alt](https://example.test/a.png)',
			'',
			'Second line',
		].join('\n');

		expect(extractNoteInput('My note', content)).toEqual({
			title: 'My note',
			body: 'First line\nSecond line',
		});
	});

	it('keeps lines that mix text and an image', () => {
		expect(extractNoteInput('t', 'see ![[a.png]] here').body).toBe('see ![[a.png]] here');
	});

	it('cuts the body at 200 characters, counting an emoji as one', () => {
		const body = extractNoteInput('t', '😀'.repeat(300)).body;
		expect(Array.from(body)).toHaveLength(200);
	});

	it('handles CRLF and a note without a body', () => {
		expect(extractNoteInput('t', '---\r\na: 1\r\n---\r\nText\r\n').body).toBe('Text');
		expect(extractNoteInput('t', '').body).toBe('');
	});
});
