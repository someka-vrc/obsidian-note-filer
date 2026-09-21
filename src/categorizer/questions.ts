import type { CategorizationMethod, TaxonomyNode } from '../taxonomy/types';

/** Key of the option that is always added so that the model can decline to choose. */
export const OTHER_KEY = 'other';

/** A question with this many options or more is split into several questions. */
export const SPLIT_THRESHOLD = 100;

export interface JevChoiceQuestion {
	type: 'choice';
	instructions: string;
	criteria: Record<string, string>;
}

export interface QuestionGroup {
	id: string;
	options: TaxonomyNode[];
	question: JevChoiceQuestion;
}

interface Wording {
	root: string;
	sub: (parent: TaxonomyNode) => string;
}

const WORDINGS: Record<CategorizationMethod, Wording> = {
	thema: {
		root: 'If this note were a book, which top-level category of the Thema subject classification would it belong to?',
		sub: (parent) =>
			`If this note were a book, which subcategory of "${parent.label}" (${parent.code}) in the Thema subject classification would it belong to?`,
	},
	// Not verified against real notes; modelled on the Thema wording.
	iab: {
		root: 'If this note were a web page, which top-level category of the IAB Tech Lab Content Taxonomy would it belong to?',
		sub: (parent) =>
			`If this note were a web page, which subcategory of "${parent.label}" in the IAB Tech Lab Content Taxonomy would it belong to?`,
	},
};

const OTHER_DESCRIPTION = 'None of the other categories listed in this question';

/** Splits options into the fewest evenly sized groups that each stay below the threshold. */
export function splitOptions<T>(options: T[]): T[][] {
	if (options.length < SPLIT_THRESHOLD) {
		return [options];
	}
	const groupCount = Math.ceil(options.length / (SPLIT_THRESHOLD - 1));
	const size = Math.ceil(options.length / groupCount);
	const groups: T[][] = [];
	for (let start = 0; start < options.length; start += size) {
		groups.push(options.slice(start, start + size));
	}
	return groups;
}

/**
 * Builds the questions that decide one level: the children of `parent` (or the top level when null).
 * The questions are sent in one request. Each has `Other` as an extra option.
 */
export function buildQuestions(
	method: CategorizationMethod,
	parent: TaxonomyNode | null,
	options: TaxonomyNode[],
): QuestionGroup[] {
	const wording = WORDINGS[method];
	const instructions = parent === null ? wording.root : wording.sub(parent);
	return splitOptions(options).map((group, index) => {
		const criteria: Record<string, string> = {};
		for (const option of group) {
			criteria[option.code] = option.label;
		}
		criteria[OTHER_KEY] = OTHER_DESCRIPTION;
		return {
			id: `q${index}`,
			options: group,
			question: { type: 'choice', instructions, criteria },
		};
	});
}
