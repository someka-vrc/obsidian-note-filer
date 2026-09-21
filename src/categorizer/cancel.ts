/** Thrown when the user cancels; it is not a failure of the categorization itself. */
export class CancelledError extends Error {
	constructor() {
		super('Cancelled');
		this.name = 'CancelledError';
	}
}

export function throwIfAborted(signal?: AbortSignal): void {
	if (signal?.aborted) {
		throw new CancelledError();
	}
}

/** Settles as soon as the signal aborts, without waiting for `promise`. */
export function raceAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
	if (!signal) {
		return promise;
	}
	throwIfAborted(signal);
	return new Promise<T>((resolve, reject) => {
		const onAbort = () => reject(new CancelledError());
		signal.addEventListener('abort', onAbort, { once: true });
		promise.then(
			(value) => {
				signal.removeEventListener('abort', onAbort);
				resolve(value);
			},
			(error: unknown) => {
				signal.removeEventListener('abort', onAbort);
				reject(error instanceof Error ? error : new Error(String(error)));
			},
		);
	});
}

export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		if (signal?.aborted) {
			reject(new CancelledError());
			return;
		}
		const onAbort = () => {
			window.clearTimeout(timer);
			reject(new CancelledError());
		};
		const timer = window.setTimeout(() => {
			signal?.removeEventListener('abort', onAbort);
			resolve();
		}, ms);
		signal?.addEventListener('abort', onAbort, { once: true });
	});
}
