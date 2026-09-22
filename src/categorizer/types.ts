import type { CategoryRef } from '../taxonomy/types';

export type { CategoryRef };

export interface Candidate extends CategoryRef {
	/** The categories above this one, top level first. The folder is these labels and then this label, nested. */
	parents: CategoryRef[];
	/** How likely this category is, from 0.0 to 1.0. */
	probability: number;
}

/** The result of categorizing one note. */
export interface Categorization {
	/** Up to three candidates, best first. Never contains `Other`. */
	candidates: Candidate[];
}

/** Text that is sent to Typesafe for one note. */
export interface NoteInput {
	title: string;
	body: string;
}
