import { describe, expect, it, vi } from 'vitest';
import { CancelledError } from './cancel';
import { JevApiError, JevClient, type HttpRequest, type HttpResponse } from './jevClient';
import type { JevChoiceQuestion } from './questions';

const questions: Record<string, JevChoiceQuestion> = {
	q0: { type: 'choice', instructions: 'which?', criteria: { A: 'a', other: 'other' } },
};

const okBody = JSON.stringify({
	answers: { q0: { type: 'choice', choice: 'A', probabilities: { A: 0.9, other: 0.1 }, confidence: 0.8 } },
});

function response(status: number, text = okBody): HttpResponse {
	return { status, text };
}

function client(transport: (request: HttpRequest) => Promise<HttpResponse>, maxRetries = 3) {
	const sleep = vi.fn(() => Promise.resolve());
	return {
		sleep,
		client: new JevClient({ url: 'https://example.test/v1', apiKey: 'secret', transport, maxRetries, sleep }),
	};
}

describe('JevClient', () => {
	it('sends the state, model and questions with the API key and parses the answers', async () => {
		const transport = vi.fn((_request: HttpRequest) => Promise.resolve(response(200)));
		const { client: jev } = client(transport);

		const answers = await jev.ask({ title: 't', body: 'b' }, questions);

		expect(answers['q0']?.probabilities).toEqual({ A: 0.9, other: 0.1 });
		const request = transport.mock.calls[0]?.[0];
		expect(request?.url).toBe('https://example.test/v1');
		expect(request?.headers['Authorization']).toBe('Bearer secret');
		expect(JSON.parse(request?.body ?? '{}')).toEqual({
			state: { title: 't', body: 'b' },
			model: 'jev-latest',
			questions,
		});
	});

	it('retries 429 and 5xx with doubling delays and then succeeds', async () => {
		const statuses = [429, 529, 200];
		const transport = vi.fn(() => Promise.resolve(response(statuses.shift() ?? 200)));
		const { client: jev, sleep } = client(transport);

		await jev.ask({}, questions);

		expect(transport).toHaveBeenCalledTimes(3);
		expect(sleep.mock.calls.map((call) => (call as unknown[])[0])).toEqual([1000, 2000]);
	});

	it('retries network failures', async () => {
		let calls = 0;
		const transport = vi.fn(() => {
			calls++;
			return calls === 1 ? Promise.reject(new Error('offline')) : Promise.resolve(response(200));
		});
		const { client: jev } = client(transport);

		await expect(jev.ask({}, questions)).resolves.toBeDefined();
		expect(transport).toHaveBeenCalledTimes(2);
	});

	it('gives up after the retries and reports the status', async () => {
		const transport = vi.fn(() => Promise.resolve(response(503, 'busy')));
		const { client: jev } = client(transport, 2);

		await expect(jev.ask({}, questions)).rejects.toThrow('HTTP 503: busy');
		expect(transport).toHaveBeenCalledTimes(3);
	});

	it('does not retry a 401 and reports the key problem', async () => {
		const transport = vi.fn(() => Promise.resolve(response(401, 'no')));
		const { client: jev } = client(transport);

		const error: unknown = await jev.ask({}, questions).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(JevApiError);
		expect((error as JevApiError).status).toBe(401);
		expect(transport).toHaveBeenCalledTimes(1);
	});

	it('does not retry a 422', async () => {
		const transport = vi.fn(() => Promise.resolve(response(422, 'bad')));
		const { client: jev } = client(transport);

		await expect(jev.ask({}, questions)).rejects.toThrow('HTTP 422');
		expect(transport).toHaveBeenCalledTimes(1);
	});

	it('rejects a response without the expected answers', async () => {
		const transport = vi.fn(() => Promise.resolve(response(200, JSON.stringify({ answers: {} }))));
		const { client: jev } = client(transport);

		await expect(jev.ask({}, questions)).rejects.toThrow('no valid answer to question q0');
	});

	it('stops waiting for a request when it is aborted', async () => {
		const transport = vi.fn(() => new Promise<HttpResponse>(() => undefined));
		const { client: jev } = client(transport);
		const controller = new AbortController();

		const pending = jev.ask({}, questions, controller.signal);
		controller.abort();

		await expect(pending).rejects.toBeInstanceOf(CancelledError);
	});

	it('does not start a request when already aborted', async () => {
		const transport = vi.fn(() => Promise.resolve(response(200)));
		const { client: jev } = client(transport);
		const controller = new AbortController();
		controller.abort();

		await expect(jev.ask({}, questions, controller.signal)).rejects.toBeInstanceOf(CancelledError);
		expect(transport).not.toHaveBeenCalled();
	});
});
