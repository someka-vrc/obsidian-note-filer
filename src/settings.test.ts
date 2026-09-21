import { describe, expect, it } from 'vitest';
import { parseDepthSetting } from './settings';

describe('parseDepthSetting', () => {
	it('keeps a whole number of 1 or more', () => {
		expect(parseDepthSetting('1')).toBe(1);
		expect(parseDepthSetting(' 3 ')).toBe(3);
	});

	it('saves an empty text, zero and negative numbers as 0, which means no limit', () => {
		expect(parseDepthSetting('')).toBe(0);
		expect(parseDepthSetting('   ')).toBe(0);
		expect(parseDepthSetting('0')).toBe(0);
		expect(parseDepthSetting('-2')).toBe(0);
	});

	it('rejects text that is not a whole number', () => {
		expect(parseDepthSetting('abc')).toBeNull();
		expect(parseDepthSetting('1.5')).toBeNull();
		expect(parseDepthSetting('2 levels')).toBeNull();
	});
});
