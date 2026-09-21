import { abortableSleep, CancelledError, raceAbort, throwIfAborted } from './cancel';
import type { JevChoiceAnswer } from './candidates';
import type { JevChoiceQuestion } from './questions';

const MODEL = 'jev-latest';
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504, 529]);

export interface HttpRequest {
	url: string;
	method: 'POST';
	headers: Record<string, string>;
	body: string;
}

export interface HttpResponse {
	status: number;
	text: string;
}

/** Sends a request. Resolves for any HTTP status; rejects only when the request itself fails. */
export type Transport = (request: HttpRequest) => Promise<HttpResponse>;

export interface JevClientOptions {
	url: string;
	apiKey: string;
	transport: Transport;
	/** Retries after the first attempt. */
	maxRetries?: number;
	baseDelayMs?: number;
	sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export class JevApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = 'JevApiError';
	}
}

/** Sends questions about one piece of state and returns the answers by question id. */
export interface JevAsker {
	ask(
		state: unknown,
		questions: Record<string, JevChoiceQuestion>,
		signal?: AbortSignal,
	): Promise<Record<string, JevChoiceAnswer>>;
}

export class JevClient implements JevAsker {
	private readonly maxRetries: number;
	private readonly baseDelayMs: number;
	private readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>;

	constructor(private readonly options: JevClientOptions) {
		this.maxRetries = options.maxRetries ?? 5;
		this.baseDelayMs = options.baseDelayMs ?? 1000;
		this.sleep = options.sleep ?? abortableSleep;
	}

	async ask(
		state: unknown,
		questions: Record<string, JevChoiceQuestion>,
		signal?: AbortSignal,
	): Promise<Record<string, JevChoiceAnswer>> {
		const request: HttpRequest = {
			url: this.options.url,
			method: 'POST',
			headers: {
				Authorization: `Bearer ${this.options.apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ state, model: MODEL, questions }),
		};

		let delay = this.baseDelayMs;
		for (let attempt = 0; ; attempt++) {
			throwIfAborted(signal);
			let response: HttpResponse | undefined;
			let failure: Error | undefined;
			try {
				response = await raceAbort(this.options.transport(request), signal);
			} catch (error) {
				if (error instanceof CancelledError) {
					throw error;
				}
				failure = new Error(
					`Network error: ${error instanceof Error ? error.message : String(error)}`,
				);
			}

			if (response && response.status < 400) {
				return parseAnswers(response.text, Object.keys(questions));
			}
			const retryable = response === undefined || RETRYABLE_STATUSES.has(response.status);
			if (!retryable || attempt >= this.maxRetries) {
				throw response ? errorForResponse(response) : (failure ?? new Error('The request failed.'));
			}
			await this.sleep(delay, signal);
			delay *= 2;
		}
	}
}

function errorForResponse(response: HttpResponse): JevApiError {
	if (response.status === 401) {
		return new JevApiError('The Typesafe API key is missing or invalid (HTTP 401).', 401);
	}
	return new JevApiError(`HTTP ${response.status}: ${response.text.slice(0, 200)}`, response.status);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function parseAnswers(text: string, questionIds: string[]): Record<string, JevChoiceAnswer> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error('The Typesafe API returned a response that is not JSON.');
	}
	const answers = isRecord(parsed) ? parsed['answers'] : undefined;
	if (!isRecord(answers)) {
		throw new Error('The Typesafe API response has no answers.');
	}

	const result: Record<string, JevChoiceAnswer> = {};
	for (const id of questionIds) {
		const answer = answers[id];
		if (
			!isRecord(answer) ||
			typeof answer['choice'] !== 'string' ||
			!isRecord(answer['probabilities'])
		) {
			throw new Error(`The Typesafe API response has no valid answer to question ${id}.`);
		}
		result[id] = {
			choice: answer['choice'],
			probabilities: answer['probabilities'] as Record<string, number>,
			confidence: typeof answer['confidence'] === 'number' ? answer['confidence'] : 0,
		};
	}
	return result;
}
