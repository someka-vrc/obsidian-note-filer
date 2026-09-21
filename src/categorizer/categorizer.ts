import { rankCandidates } from './candidates';
import type { JevAsker } from './jevClient';
import { buildQuestions } from './questions';
import type { CategoryRef, Categorization, NoteInput } from './types';
import type { CategorizationMethod, Taxonomy, TaxonomyNode } from '../taxonomy/types';

export interface CategorizeOptions {
	method: CategorizationMethod;
	taxonomy: Taxonomy;
	/** How many levels to descend. Zero or less means no limit: descend until a category has no children. */
	depth: number;
}

/**
 * Categorizes a note one level at a time. The best answer of a level (without `Other`)
 * decides which categories are offered at the next level. The candidates are the best
 * categories of the last level that was asked.
 */
export async function categorizeNote(
	input: NoteInput,
	options: CategorizeOptions,
	client: JevAsker,
	signal?: AbortSignal,
): Promise<Categorization> {
	const depth = options.depth >= 1 ? Math.floor(options.depth) : Infinity;
	const parents: CategoryRef[] = [];
	let parent: TaxonomyNode | null = null;

	for (let level = 1; ; level++) {
		const choices: TaxonomyNode[] = parent ? (parent.children ?? []) : options.taxonomy.root.children;
		const groups = buildQuestions(options.method, parent, choices);
		const questions = Object.fromEntries(groups.map((group) => [group.id, group.question]));
		const answers = await client.ask(input, questions, signal);

		const candidates = rankCandidates(groups, answers);
		const best = candidates[0];
		if (!best) {
			throw new Error('No category fits this note.');
		}

		const chosen = choices.find((node) => node.code === best.code);
		if (level >= depth || !chosen?.children?.length) {
			return { parents, candidates };
		}
		parents.push({ code: chosen.code, label: chosen.label });
		parent = chosen;
	}
}
