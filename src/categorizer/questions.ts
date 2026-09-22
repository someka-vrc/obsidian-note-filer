import type { CategorizationMethod, CategoryRef } from '../taxonomy/types';

/** Key of the option that is always added so that the model can decline to choose. */
export const OTHER_KEY = 'other';

/**
 * A question with more options than this is split into several questions of the same request.
 * Typesafe accepts 255 options per question; this leaves room for `Other` and for the longer
 * (path) option texts.
 */
export const MAX_QUESTION_OPTIONS = 200;

export interface JevChoiceQuestion {
	type: 'choice';
	instructions: string;
	criteria: Record<string, string>;
}

/** One option of a question: the taxonomy code is the key and the text is what the model reads. */
export interface QuestionOption {
	code: string;
	text: string;
}

export interface QuestionGroup {
	id: string;
	options: QuestionOption[];
	question: JevChoiceQuestion;
}

interface Wording {
	root: string;
	/** For a question whose options are the categories at one level, listed with their parents. */
	flat: string;
	children: (parent: CategoryRef) => string;
}

const WORDINGS: Record<CategorizationMethod, Wording> = {
	thema: {
		root: 'If this note were a book, which top-level category of the Thema subject classification would it belong to?',
		flat: 'If this note were a book, which category of the Thema subject classification would it belong to?',
		children: (parent) =>
			`If this note were a book, which subcategory of "${parent.label}" (${parent.code}) in the Thema subject classification would it belong to?`,
	},
	// Not verified against real notes; modelled on the Thema wording.
	iab: {
		root: 'If this note were a web page, which top-level category of the IAB Tech Lab Content Taxonomy would it belong to?',
		flat: 'If this note were a web page, which category of the IAB Tech Lab Content Taxonomy would it belong to?',
		children: (parent) =>
			`If this note were a web page, which subcategory of "${parent.label}" in the IAB Tech Lab Content Taxonomy would it belong to?`,
	},
};

const OTHER_DESCRIPTION = 'None of the other categories listed in this question';

export function rootInstructions(method: CategorizationMethod): string {
	return WORDINGS[method].root;
}

export function flatInstructions(method: CategorizationMethod): string {
	return WORDINGS[method].flat;
}

export function childInstructions(method: CategorizationMethod, parent: CategoryRef): string {
	return WORDINGS[method].children(parent);
}

/** Splits options into the fewest evenly sized groups that each stay within the maximum. */
export function splitOptions<T>(options: T[], max = MAX_QUESTION_OPTIONS): T[][] {
	if (options.length <= max) {
		return [options];
	}
	const groupCount = Math.ceil(options.length / max);
	const size = Math.ceil(options.length / groupCount);
	const groups: T[][] = [];
	for (let start = 0; start < options.length; start += size) {
		groups.push(options.slice(start, start + size));
	}
	return groups;
}

/**
 * Builds the questions that decide among `options`. They are sent in one request.
 * Each has `Other` as an extra option, because the answer may lie in another question.
 */
export function buildQuestions(instructions: string, options: QuestionOption[]): QuestionGroup[] {
	return splitOptions(options).map((group, index) => {
		const criteria: Record<string, string> = {};
		for (const option of group) {
			criteria[option.code] = option.text;
		}
		criteria[OTHER_KEY] = OTHER_DESCRIPTION;
		return {
			id: `q${index}`,
			options: group,
			question: { type: 'choice', instructions, criteria },
		};
	});
}
