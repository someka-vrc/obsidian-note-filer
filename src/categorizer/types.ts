export interface CategoryRef {
	code: string;
	label: string;
}

export interface Candidate extends CategoryRef {
	/** Probability of this category in the last question that was asked, from 0.0 to 1.0. */
	probability: number;
}

/**
 * The result of categorizing one note.
 * A candidate's folder is `parents` followed by the candidate itself, each level nested by label.
 */
export interface Categorization {
	parents: CategoryRef[];
	/** Up to three candidates, best first. Never contains `Other`. */
	candidates: Candidate[];
}

/** Text that is sent to Typesafe for one note. */
export interface NoteInput {
	title: string;
	body: string;
}
