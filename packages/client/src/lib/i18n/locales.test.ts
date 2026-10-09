/**
 * Locale-file validation (BUILD-3): the CI completeness gate.
 *
 * Every locale file that ships must (a) carry every key the canonical
 * en.json carries -- no missing keys, no extras -- and (b) be a
 * well-formed message tree: every leaf a non-empty string, every
 * plural node carrying only plural categories. en.json is typed at
 * compile time (locales.ts), so this test guards the files to come.
 */

import { describe, expect, it } from 'bun:test';
import type { LocaleMessages } from '@erledigen/shared';
import { DEFAULT_LOCALE, LOCALE_FILES } from './locales';

/**
 * Flatten a message tree into dotted leaf key -> template. A plural
 * node's children flatten under their category names ('tasks.one'), so
 * parity between locales covers each variant; a MIXED node (a category
 * sibling to a plain key) falls through as ordinary nesting and fails
 * key parity against the canonical file.
 */
function flatten(messages: LocaleMessages, prefix: string, out: Map<string, string>): void {
    for (const [key, value] of Object.entries(messages)) {
        const path = prefix === '' ? key : `${prefix}.${key}`;
        if (typeof value === 'string') {
            out.set(path, value);
        } else if (value !== null && typeof value === 'object') {
            flatten(value, path, out);
        } else {
            throw new Error(`locale file: "${path}" is not a string or a message node`);
        }
    }
}

/** Flattened dotted key -> template for one locale file. */
function flatKeys(locale: string): Map<string, string> {
    const out = new Map<string, string>();
    flatten(LOCALE_FILES[locale] ?? {}, '', out);
    return out;
}

describe('locale files', () => {
    it('ships the canonical locale with messages', () => {
        expect(LOCALE_FILES[DEFAULT_LOCALE]).toBeDefined();
        expect(flatKeys(DEFAULT_LOCALE).size).toBeGreaterThan(0);
    });

    it('declares every available locale with a non-empty file', () => {
        // The Settings language list and the adapter both derive from the
        // same map, so an entry without a file (or vice versa) cannot ship.
        for (const locale of Object.keys(LOCALE_FILES)) {
            expect(flatKeys(locale).size).toBeGreaterThan(0);
        }
    });

    it('keeps every locale at full key parity with the canonical file', () => {
        const canonical = [...flatKeys(DEFAULT_LOCALE).keys()].sort();

        for (const locale of Object.keys(LOCALE_FILES)) {
            const keys = [...flatKeys(locale).keys()].sort();
            expect(keys).toEqual(canonical);
        }
    });

    it('carries only non-empty leaf templates', () => {
        for (const locale of Object.keys(LOCALE_FILES)) {
            for (const [path, template] of flatKeys(locale)) {
                if (template.length === 0) {
                    throw new Error(`locale file: "${locale}:${path}" is empty`);
                }
            }
        }
    });
});
