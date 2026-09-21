import { throwIfAborted } from './cancel';

/**
 * Runs `worker` over `items` with at most `limit` running at the same time.
 * Results keep the order of `items`. Once the signal aborts no new item is started
 * and the returned promise rejects with `CancelledError`.
 */
export async function mapWithConcurrency<T, R>(
	items: T[],
	limit: number,
	worker: (item: T, index: number) => Promise<R>,
	signal?: AbortSignal,
): Promise<R[]> {
	const results = new Array<R>(items.length);
	let next = 0;

	const run = async () => {
		while (next < items.length && !signal?.aborted) {
			const index = next++;
			results[index] = await worker(items[index] as T, index);
		}
	};

	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
	throwIfAborted(signal);
	return results;
}
