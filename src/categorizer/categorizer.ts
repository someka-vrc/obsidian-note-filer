import { MAX_CANDIDATES, rankOptions } from './candidates';
import type { JevAsker } from './jevClient';
import {
	buildQuestions,
	childInstructions,
	flatInstructions,
	rootInstructions,
	type QuestionGroup,
	type QuestionOption,
} from './questions';
import type { Candidate, Categorization, NoteInput } from './types';
import { nodesAtDepth, pathLabel, type LevelEntry } from '../taxonomy/levels';
import type { CategorizationMethod, Taxonomy, TaxonomyNode } from '../taxonomy/types';

/**
 * The deepest level that is asked as one flat question. Deeper levels have too many categories
 * (Thema has 1,162 at level 3): the flat candidates are followed down one level at a time instead.
 */
export const FLAT_MAX_DEPTH = 2;

export interface CategorizeOptions {
	method: CategorizationMethod;
	taxonomy: Taxonomy;
	/** How many levels to descend. Zero or less means no limit: descend until a category has no children. */
	depth: number;
}

/**
 * Categorizes a note. The categories of the level `min(depth, FLAT_MAX_DEPTH)` are all offered in one
 * step, so the candidates can come from different branches. When `depth` is larger, each of the best
 * candidates is followed down, level by level, to its best category at `depth`. The candidates are
 * then ranked by the geometric mean of the probabilities along their path.
 */
export async function categorizeNote(
	input: NoteInput,
	options: CategorizeOptions,
	client: JevAsker,
	signal?: AbortSignal,
): Promise<Categorization> {
	const depth = options.depth >= 1 ? Math.floor(options.depth) : Infinity;
	const flatDepth = Math.min(depth, FLAT_MAX_DEPTH);

	const entries = nodesAtDepth(options.taxonomy, flatDepth);
	const byCode = new Map(entries.map((entry) => [entry.node.code, entry]));
	const instructions =
		flatDepth === 1 ? rootInstructions(options.method) : flatInstructions(options.method);
	const groups = buildQuestions(
		instructions,
		entries.map((entry) => ({ code: entry.node.code, text: pathLabel(entry) })),
	);
	const start = await askBest(input, groups, client, signal, MAX_CANDIDATES);

	const followed = start.flatMap(({ code, probability }) => {
		const entry = byCode.get(code);
		return entry ? [{ entry, probability }] : [];
	});
	if (followed.length === 0) {
		throw new Error('No category fits this note.');
	}

	const candidates = await Promise.all(
		followed.map(({ entry, probability }) =>
			descend(input, options.method, entry, probability, flatDepth, depth, client, signal),
		),
	);
	// Array.prototype.sort is stable, so equal scores keep the order of the flat step.
	return { candidates: candidates.sort((a, b) => b.probability - a.probability) };
}

/** Asks the questions in one request and returns the best options without `Other`. */
async function askBest(
	input: NoteInput,
	groups: QuestionGroup[],
	client: JevAsker,
	signal: AbortSignal | undefined,
	limit: number,
) {
	const questions = Object.fromEntries(groups.map((group) => [group.id, group.question]));
	const answers = await client.ask(input, questions, signal);
	return rankOptions(groups, answers, limit);
}

/**
 * Follows a category down to `depth`, taking the best child at each level. The probability of the
 * result is the geometric mean of the probabilities of the steps, so paths of different lengths compare fairly.
 * The path ends early at a category without children, or when the model answers only `Other`.
 */
async function descend(
	input: NoteInput,
	method: CategorizationMethod,
	entry: LevelEntry,
	probability: number,
	level: number,
	depth: number,
	client: JevAsker,
	signal?: AbortSignal,
): Promise<Candidate> {
	let node: TaxonomyNode = entry.node;
	let parents = entry.parents;
	const steps = [probability];

	for (; level < depth && node.children?.length; level++) {
		const choices: TaxonomyNode[] = node.children;
		const options: QuestionOption[] = choices.map((child) => ({ code: child.code, text: child.label }));
		const groups = buildQuestions(childInstructions(method, node), options);
		const [best] = await askBest(input, groups, client, signal, 1);
		const chosen = choices.find((child) => child.code === best?.code);
		if (!best || !chosen) {
			break;
		}
		parents = [...parents, { code: node.code, label: node.label }];
		node = chosen;
		steps.push(best.probability);
	}

	return {
		code: node.code,
		label: node.label,
		parents,
		probability: geometricMean(steps),
	};
}

function geometricMean(values: number[]): number {
	if (values.length === 1) {
		return values[0] ?? 0;
	}
	const sumOfLogs = values.reduce((sum, value) => sum + Math.log(value), 0);
	return Math.exp(sumOfLogs / values.length);
}
