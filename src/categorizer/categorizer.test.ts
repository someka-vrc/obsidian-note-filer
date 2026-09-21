import { describe, expect, it } from 'vitest';
import type { Taxonomy } from '../taxonomy/types';
import type { JevChoiceAnswer } from './candidates';
import { categorizeNote } from './categorizer';
import type { JevAsker } from './jevClient';
import type { JevChoiceQuestion } from './questions';

const taxonomy: Taxonomy = {
	root: {
		children: [
			{
				code: 'A',
				label: 'Arts',
				children: [
					{ code: 'AB', label: 'Theory' },
					{ code: 'AC', label: 'Painting', children: [{ code: 'ACA', label: 'Oil' }] },
				],
			},
			{ code: 'B', label: 'Business' },
		],
	},
};

const input = { title: 'note', body: 'text' };

/** Answers each question with the given probabilities per option code (unlisted options get 0). */
function fakeClient(script: Array<Record<string, number>>) {
	const asked: Array<Record<string, JevChoiceQuestion>> = [];
	const client: JevAsker = {
		ask(_state, questions) {
			const probabilities = script[asked.length];
			if (!probabilities) {
				throw new Error('unexpected request');
			}
			asked.push(questions);
			const answers: Record<string, JevChoiceAnswer> = {};
			for (const [id, question] of Object.entries(questions)) {
				const all: Record<string, number> = {};
				for (const key of Object.keys(question.criteria)) {
					all[key] = probabilities[key] ?? 0;
				}
				answers[id] = { choice: 'x', probabilities: all, confidence: 1 };
			}
			return Promise.resolve(answers);
		},
	};
	return { client, asked };
}

describe('categorizeNote', () => {
	it('returns the top-level candidates when depth is 1', async () => {
		const { client, asked } = fakeClient([{ A: 0.6, B: 0.3, other: 0.1 }]);
		const result = await categorizeNote(input, { method: 'thema', taxonomy, depth: 1 }, client);

		expect(result.parents).toEqual([]);
		expect(result.candidates.map((c) => [c.code, c.probability])).toEqual([
			['A', 0.6],
			['B', 0.3],
		]);
		expect(asked).toHaveLength(1);
	});

	it('asks the children of the best answer at the next level', async () => {
		const { client, asked } = fakeClient([
			{ A: 0.7, B: 0.2, other: 0.1 },
			{ AB: 0.2, AC: 0.7, other: 0.1 },
		]);
		const result = await categorizeNote(input, { method: 'thema', taxonomy, depth: 2 }, client);

		expect(Object.keys(asked[1]?.['q0']?.criteria ?? {})).toEqual(['AB', 'AC', 'other']);
		expect(asked[1]?.['q0']?.instructions).toContain('"Arts" (A)');
		expect(result.parents).toEqual([{ code: 'A', label: 'Arts' }]);
		expect(result.candidates.map((c) => c.code)).toEqual(['AC', 'AB']);
	});

	it('stops at a level without children even if depth is larger', async () => {
		const { client, asked } = fakeClient([{ A: 0.1, B: 0.8, other: 0.1 }]);
		const result = await categorizeNote(input, { method: 'thema', taxonomy, depth: 3 }, client);

		expect(asked).toHaveLength(1);
		expect(result.parents).toEqual([]);
		expect(result.candidates[0]?.code).toBe('B');
	});

	it('descends with the best answer that is not Other', async () => {
		const { client } = fakeClient([
			{ A: 0.3, B: 0.1, other: 0.6 },
			{ AB: 0.5, AC: 0.4, other: 0.1 },
		]);
		const result = await categorizeNote(input, { method: 'thema', taxonomy, depth: 2 }, client);

		expect(result.parents).toEqual([{ code: 'A', label: 'Arts' }]);
	});

	it('fails when only Other has probability', async () => {
		const { client } = fakeClient([{ other: 1 }]);
		await expect(
			categorizeNote(input, { method: 'thema', taxonomy, depth: 1 }, client),
		).rejects.toThrow('No category fits');
	});
});
