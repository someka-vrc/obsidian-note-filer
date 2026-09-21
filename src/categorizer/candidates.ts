import type { Candidate } from './types';
import { OTHER_KEY, type QuestionGroup } from './questions';

export const MAX_CANDIDATES = 3;

export interface JevChoiceAnswer {
	choice: string;
	probabilities: Record<string, number>;
	confidence: number;
}

/**
 * Picks the most probable categories across all questions of one level.
 * Probabilities of different questions are compared as they are. `Other` is never a candidate.
 */
export function rankCandidates(
	groups: QuestionGroup[],
	answers: Record<string, JevChoiceAnswer>,
): Candidate[] {
	const candidates: Candidate[] = [];
	for (const group of groups) {
		const answer = answers[group.id];
		if (!answer) {
			throw new Error(`The answer to question ${group.id} is missing.`);
		}
		for (const option of group.options) {
			const probability = answer.probabilities[option.code];
			if (option.code !== OTHER_KEY && probability !== undefined && probability > 0) {
				candidates.push({ code: option.code, label: option.label, probability });
			}
		}
	}
	// Array.prototype.sort is stable, so equal probabilities keep the taxonomy order.
	return candidates.sort((a, b) => b.probability - a.probability).slice(0, MAX_CANDIDATES);
}
