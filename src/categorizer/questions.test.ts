import { describe, expect, it } from 'vitest';
import { rankOptions } from './candidates';
import {
	buildQuestions,
	childInstructions,
	flatInstructions,
	MAX_QUESTION_OPTIONS,
	OTHER_KEY,
	rootInstructions,
	splitOptions,
	type QuestionOption,
} from './questions';

function options(count: number): QuestionOption[] {
	return Array.from({ length: count }, (_, i) => ({ code: `C${i}`, text: `Label ${i}` }));
}

describe('splitOptions', () => {
	it('keeps up to the maximum in one group', () => {
		expect(splitOptions(options(MAX_QUESTION_OPTIONS))).toHaveLength(1);
		expect(splitOptions(options(147))).toHaveLength(1);
	});

	it('splits more than the maximum into evenly sized groups within it', () => {
		const groups = splitOptions(options(201));
		expect(groups.map((g) => g.length)).toEqual([101, 100]);

		const many = splitOptions(options(1176));
		expect(many.every((g) => g.length <= MAX_QUESTION_OPTIONS)).toBe(true);
		expect(many).toHaveLength(6);
		expect(many.flat().map((o) => o.code)).toEqual(options(1176).map((o) => o.code));
	});
});

describe('buildQuestions', () => {
	it('adds Other to every question and uses codes as keys and texts as values', () => {
		const groups = buildQuestions('Which?', options(3));
		expect(groups).toHaveLength(1);
		expect(groups[0]?.question.criteria).toMatchObject({ C0: 'Label 0', C2: 'Label 2' });
		expect(groups[0]?.question.instructions).toBe('Which?');
		expect(OTHER_KEY in (groups[0]?.question.criteria ?? {})).toBe(true);
	});

	it('gives each split question its own options and Other, with ids q0, q1, ...', () => {
		const groups = buildQuestions('Which?', options(325));
		expect(groups.map((g) => g.id)).toEqual(['q0', 'q1']);
		for (const group of groups) {
			expect(Object.keys(group.question.criteria)).toHaveLength(group.options.length + 1);
			expect(OTHER_KEY in group.question.criteria).toBe(true);
		}
	});
});

describe('instructions', () => {
	it('names the parent for the children of a category', () => {
		expect(childInstructions('thema', { code: 'A', label: 'The Arts' })).toContain('"The Arts" (A)');
	});

	it.each(['thema', 'iab'] as const)('%s has different wordings for top, flat and children', (method) => {
		expect(new Set([rootInstructions(method), flatInstructions(method)]).size).toBe(2);
	});
});

describe('rankOptions', () => {
	it('uses the probabilities of a single question as they are', () => {
		const groups = buildQuestions('Which?', options(3));
		const answers = {
			q0: { choice: 'C0', confidence: 1, probabilities: { C0: 0.5, C1: 0.3, C2: 0.1, [OTHER_KEY]: 0.1 } },
		};
		expect(rankOptions(groups, answers)).toEqual([
			{ code: 'C0', probability: 0.5 },
			{ code: 'C1', probability: 0.3 },
			{ code: 'C2', probability: 0.1 },
		]);
	});

	it('weights split questions by 1 - p(Other), drops Other and keeps the top three', () => {
		const groups = buildQuestions('Which?', options(250));
		const answers = {
			// The answer probably lies in q1: q0 puts most of its probability on Other.
			q0: { choice: 'C1', confidence: 0.5, probabilities: { C1: 0.4, C2: 0.1, [OTHER_KEY]: 0.5 } },
			q1: { choice: 'C200', confidence: 0.5, probabilities: { C200: 0.7, C201: 0.2, C202: 0.05, [OTHER_KEY]: 0.05 } },
		};
		const result = rankOptions(groups, answers);
		// 0.7 * 0.95, 0.4 * 0.5, 0.2 * 0.95: without the weight C1 (0.4) would beat C201 (0.2) by more.
		expect(result.map((c) => c.code)).toEqual(['C200', 'C1', 'C201']);
		expect(result[0]?.probability).toBeCloseTo(0.665);
		expect(result[1]?.probability).toBeCloseTo(0.2);
		expect(result[2]?.probability).toBeCloseTo(0.19);
	});

	it('ignores options whose probability is zero or missing', () => {
		const groups = buildQuestions('Which?', options(3));
		const answers = {
			q0: { choice: 'C0', confidence: 1, probabilities: { C0: 1, C1: 0, [OTHER_KEY]: 0 } },
		};
		expect(rankOptions(groups, answers).map((c) => c.code)).toEqual(['C0']);
	});

	it('throws when an answer is missing', () => {
		const groups = buildQuestions('Which?', options(3));
		expect(() => rankOptions(groups, {})).toThrow('missing');
	});
});
