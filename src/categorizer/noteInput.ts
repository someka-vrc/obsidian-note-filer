import type { NoteInput } from './types';

const BODY_LENGTH = 200;
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;
const IMAGE_ONLY_LINE = /^!\[.*?\](\(.*?\))?$/;

/**
 * Builds the text sent to Typesafe: the title and the first 200 characters of the body.
 * The frontmatter, blank lines and lines that only embed an image are left out.
 */
export function extractNoteInput(title: string, content: string): NoteInput {
	const lines = content
		.replace(FRONTMATTER, '')
		.split(/\r?\n/)
		.filter((line) => {
			const trimmed = line.trim();
			return trimmed !== '' && !IMAGE_ONLY_LINE.test(trimmed);
		});
	const body = Array.from(lines.join('\n')).slice(0, BODY_LENGTH).join('');
	return { title, body };
}
