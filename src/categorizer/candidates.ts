import { OTHER_KEY, type QuestionGroup } from './questions';

export const MAX_CANDIDATES = 3;

export interface JevChoiceAnswer {
	choice: string;
	probabilities: Record<string, number>;
	confidence: number;
}

export interface RankedOption {
	code: string;
	probability: number;
}

/**
 * Picks the most probable options across all questions of one step. `Other` is never picked.
 *
 * Probabilities of different questions are not comparable: each question sums to 1 on its own.
 * When the options were split into several questions, the probability of `Other` in a question tells
 * how likely the answer lies elsewhere, so each option is weighted by `1 - p(Other)` of its question.
 * A single question is used as it is.
 */
export function rankOptions(
	groups: QuestionGroup[],
	answers: Record<string, JevChoiceAnswer>,
	limit = MAX_CANDIDATES,
): RankedOption[] {
	const ranked: RankedOption[] = [];
	for (const group of groups) {
		const answer = answers[group.id];
		if (!answer) {
			throw new Error(`The answer to question ${group.id} is missing.`);
		}
		const weight =
			groups.length > 1 ? 1 - Math.min(1, Math.max(0, answer.probabilities[OTHER_KEY] ?? 0)) : 1;
		for (const option of group.options) {
			const probability = (answer.probabilities[option.code] ?? 0) * weight;
			if (option.code !== OTHER_KEY && probability > 0) {
				ranked.push({ code: option.code, probability });
			}
		}
	}
	// Array.prototype.sort is stable, so equal probabilities keep the taxonomy order.
	return ranked.sort((a, b) => b.probability - a.probability).slice(0, limit);
}
