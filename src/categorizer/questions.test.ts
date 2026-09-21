import { describe, expect, it } from 'vitest';
import type { TaxonomyNode } from '../taxonomy/types';
import { rankCandidates } from './candidates';
import { buildQuestions, OTHER_KEY, splitOptions } from './questions';

function nodes(count: number): TaxonomyNode[] {
	return Array.from({ length: count }, (_, i) => ({ code: `C${i}`, label: `Label ${i}` }));
}

describe('splitOptions', () => {
	it('keeps fewer than 100 options in one group', () => {
		expect(splitOptions(nodes(99))).toHaveLength(1);
	});

	it('splits 100 or more options into evenly sized groups below 100', () => {
		const groups = splitOptions(nodes(100));
		expect(groups.map((g) => g.length)).toEqual([50, 50]);

		const many = splitOptions(nodes(325));
		expect(many.every((g) => g.length < 100)).toBe(true);
		expect(many.flat()).toHaveLength(325);
		expect(many.flat().map((n) => n.code)).toEqual(nodes(325).map((n) => n.code));
	});
});

describe('buildQuestions', () => {
	it('adds Other to every question and uses codes as keys and labels as values', () => {
		const groups = buildQuestions('thema', null, nodes(3));
		expect(groups).toHaveLength(1);
		expect(groups[0]?.question.criteria).toMatchObject({
			C0: 'Label 0',
			C2: 'Label 2',
		});
		expect(OTHER_KEY in (groups[0]?.question.criteria ?? {})).toBe(true);
	});

	it('gives each split question its own options and Other, in one request id space', () => {
		const groups = buildQuestions('iab', null, nodes(150));
		expect(groups.map((g) => g.id)).toEqual(['q0', 'q1']);
		for (const group of groups) {
			expect(Object.keys(group.question.criteria)).toHaveLength(group.options.length + 1);
			expect(OTHER_KEY in group.question.criteria).toBe(true);
		}
	});

	it('mentions the parent below the top level', () => {
		const parent: TaxonomyNode = { code: 'A', label: 'The Arts' };
		const [group] = buildQuestions('thema', parent, nodes(2));
		expect(group?.question.instructions).toContain('"The Arts" (A)');
	});
});

describe('rankCandidates', () => {
	it('merges probabilities across split questions, drops Other and keeps the top three', () => {
		const groups = buildQuestions('thema', null, nodes(150));
		const answers = {
			q0: {
				choice: 'C1',
				confidence: 0.5,
				probabilities: { C1: 0.4, C2: 0.1, [OTHER_KEY]: 0.5 },
			},
			q1: {
				choice: 'C100',
				confidence: 0.5,
				probabilities: { C100: 0.3, C101: 0.2, C102: 0.05, [OTHER_KEY]: 0.45 },
			},
		};
		const result = rankCandidates(groups, answers);
		expect(result.map((c) => c.code)).toEqual(['C1', 'C100', 'C101']);
		expect(result.every((c) => c.code !== OTHER_KEY)).toBe(true);
	});

	it('ignores options whose probability is zero', () => {
		const groups = buildQuestions('thema', null, nodes(3));
		const answers = {
			q0: { choice: 'C0', confidence: 1, probabilities: { C0: 1, C1: 0, C2: 0, [OTHER_KEY]: 0 } },
		};
		expect(rankCandidates(groups, answers).map((c) => c.code)).toEqual(['C0']);
	});

	it('throws when an answer is missing', () => {
		const groups = buildQuestions('thema', null, nodes(3));
		expect(() => rankCandidates(groups, {})).toThrow('missing');
	});
});
