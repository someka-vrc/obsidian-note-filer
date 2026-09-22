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
					{ code: 'AC', label: 'Painting', children: [{ code: 'ACA', label: 'Oil' }, { code: 'ACB', label: 'Water' }] },
				],
			},
			{
				code: 'C',
				label: 'Computing',
				children: [
					{ code: 'CD', label: 'Databases', children: [{ code: 'CDA', label: 'SQL' }] },
					{ code: 'CE', label: 'Editors' },
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

/** Answers by the code of the first option that is listed in the question, so parallel requests stay independent. */
function routedClient(routes: Record<string, Record<string, number>>) {
	const asked: Array<Record<string, JevChoiceQuestion>> = [];
	const client: JevAsker = {
		ask(_state, questions) {
			asked.push(questions);
			const answers: Record<string, JevChoiceAnswer> = {};
			for (const [id, question] of Object.entries(questions)) {
				const route = Object.entries(routes).find(([key]) => key in question.criteria);
				const all: Record<string, number> = {};
				for (const key of Object.keys(question.criteria)) {
					all[key] = route?.[1][key] ?? 0;
				}
				answers[id] = { choice: 'x', probabilities: all, confidence: 1 };
			}
			return Promise.resolve(answers);
		},
	};
	return { client, asked };
}

describe('categorizeNote, depth 1', () => {
	it('returns the top-level candidates from one question', async () => {
		const { client, asked } = fakeClient([{ A: 0.6, C: 0.3, other: 0.1 }]);
		const result = await categorizeNote(input, { method: 'thema', taxonomy, depth: 1 }, client);

		expect(result.candidates.map((c) => [c.code, c.parents, c.probability])).toEqual([
			['A', [], 0.6],
			['C', [], 0.3],
		]);
		expect(asked).toHaveLength(1);
		expect(asked[0]?.['q0']?.instructions).toContain('top-level');
	});

	it('fails when only Other has probability', async () => {
		const { client } = fakeClient([{ other: 1 }]);
		await expect(categorizeNote(input, { method: 'thema', taxonomy, depth: 1 }, client)).rejects.toThrow(
			'No category fits',
		);
	});
});

describe('categorizeNote, depth 2 (flat)', () => {
	it('offers every second-level category in one question, with paths, and ranks across parents', async () => {
		const { client, asked } = fakeClient([{ AC: 0.5, CD: 0.3, AB: 0.1, B: 0.05, other: 0.05 }]);
		const result = await categorizeNote(input, { method: 'thema', taxonomy, depth: 2 }, client);

		expect(asked).toHaveLength(1);
		expect(asked[0]?.['q0']?.criteria).toEqual({
			AB: 'Arts > Theory',
			AC: 'Arts > Painting',
			CD: 'Computing > Databases',
			CE: 'Computing > Editors',
			B: 'Business',
			other: expect.any(String) as string,
		});
		expect(result.candidates.map((c) => c.code)).toEqual(['AC', 'CD', 'AB']);
		expect(result.candidates[1]?.parents).toEqual([{ code: 'C', label: 'Computing' }]);
		expect(result.candidates[1]?.probability).toBe(0.3);
	});

	it('keeps a top-level leaf as a candidate with no parents', async () => {
		const { client } = fakeClient([{ B: 0.9, AB: 0.05, other: 0.05 }]);
		const result = await categorizeNote(input, { method: 'thema', taxonomy, depth: 2 }, client);
		expect(result.candidates[0]).toMatchObject({ code: 'B', parents: [] });
	});
});

describe('categorizeNote, deeper than the flat level', () => {
	it('follows each of the best candidates down and ranks them by the geometric mean', async () => {
		const { client, asked } = routedClient({
			// flat step
			AB: { AB: 0.3, AC: 0.5, CD: 0.16, CE: 0.02, B: 0.01, other: 0.01 },
			// children of AC, then of CD
			ACA: { ACA: 0.9, ACB: 0.1 },
			CDA: { CDA: 1 },
		});
		const result = await categorizeNote(input, { method: 'thema', taxonomy, depth: 3 }, client);

		// AB has no children, so its path ends at the flat step: flat + AC + CD = 3 requests.
		expect(asked).toHaveLength(3);
		const byCode = Object.fromEntries(result.candidates.map((c) => [c.code, c]));
		expect(result.candidates.map((c) => c.code)).toEqual(['ACA', 'CDA', 'AB']);
		expect(byCode['ACA']?.parents).toEqual([
			{ code: 'A', label: 'Arts' },
			{ code: 'AC', label: 'Painting' },
		]);
		expect(byCode['ACA']?.probability).toBeCloseTo(Math.sqrt(0.5 * 0.9));
		expect(byCode['CDA']?.probability).toBeCloseTo(Math.sqrt(0.16 * 1));
		expect(byCode['AB']?.probability).toBe(0.3);
	});

	it.each([0, -1])('goes down to the deepest level when depth is %i (no limit)', async (depth) => {
		const { client } = routedClient({
			AB: { AB: 0.1, AC: 0.8, CD: 0.05, other: 0.05 },
			ACA: { ACA: 0.7, ACB: 0.2, other: 0.1 },
			CDA: { CDA: 1 },
		});
		const result = await categorizeNote(input, { method: 'thema', taxonomy, depth }, client);
		expect(result.candidates.map((c) => c.code)).toContain('ACA');
		expect(result.candidates.find((c) => c.code === 'ACA')?.parents.map((p) => p.code)).toEqual(['A', 'AC']);
	});

	it('stops a path at its current category when the model answers only Other', async () => {
		const { client } = routedClient({
			AB: { AC: 0.9, CD: 0.05, other: 0.05 },
			ACA: { other: 1 },
		});
		const result = await categorizeNote(input, { method: 'thema', taxonomy, depth: 3 }, client);
		expect(result.candidates[0]).toMatchObject({ code: 'AC', probability: 0.9 });
	});

	it('asks the children of a category with the parent named', async () => {
		const { client, asked } = routedClient({ AB: { AC: 1 }, ACA: { ACA: 1 } });
		await categorizeNote(input, { method: 'thema', taxonomy, depth: 3 }, client);
		expect(asked[1]?.['q0']?.instructions).toContain('"Painting" (AC)');
		expect(Object.keys(asked[1]?.['q0']?.criteria ?? {})).toEqual(['ACA', 'ACB', 'other']);
	});
});
