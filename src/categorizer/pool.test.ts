import { describe, expect, it } from 'vitest';
import { CancelledError } from './cancel';
import { mapWithConcurrency } from './pool';

describe('mapWithConcurrency', () => {
	it('keeps the order of the items and respects the limit', async () => {
		let running = 0;
		let peak = 0;
		const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (n) => {
			running++;
			peak = Math.max(peak, running);
			for (let turn = 0; turn < 7 - n; turn++) {
				await Promise.resolve();
			}
			running--;
			return n * 10;
		});

		expect(results).toEqual([10, 20, 30, 40, 50, 60]);
		expect(peak).toBe(2);
	});

	it('handles no items', async () => {
		expect(await mapWithConcurrency([], 8, () => Promise.resolve(1))).toEqual([]);
	});

	it('stops starting items after an abort and rejects', async () => {
		const controller = new AbortController();
		const started: number[] = [];
		const pending = mapWithConcurrency(
			[1, 2, 3, 4],
			1,
			async (n) => {
				started.push(n);
				controller.abort();
				await Promise.resolve();
				return n;
			},
			controller.signal,
		);

		await expect(pending).rejects.toBeInstanceOf(CancelledError);
		expect(started).toEqual([1]);
	});
});
