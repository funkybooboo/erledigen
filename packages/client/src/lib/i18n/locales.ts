/**
 * The app's locale files (BUILD-3, v0.13.0).
 *
 * Each locale is one nested JSON map in `locales/`; this module is the
 * static import map the container's I18nAdapter loads. Adding a language
 * is a new locale file plus ONE import line here -- the completeness
 * test (locales.test.ts) then enforces key parity against en.json, and
 * the Settings language list picks it up automatically. See
 * docs/build/standards/i18n.md.
 *
 * This module stays plain TS + static JSON imports on purpose: the Bun
 * test runner cannot resolve `import.meta.glob`, and the completeness
 * test imports this file directly.
 */

import type { LocaleMessages } from '@erledigen/shared';
import en from './locales/en.json';

/** The canonical locale -- the fallback for missing keys everywhere and
 *  the completeness baseline for every other file. */
export const DEFAULT_LOCALE = 'en';

/** Every shipped locale file. */
export const LOCALE_FILES: Record<string, LocaleMessages> = {
    en,
};

/**
 * Every valid t() key: a dotted path to a leaf string, or to a plural
 * node (one child per plural category, picked by a numeric `count`).
 * Derived from en.json at compile time, so a typo'd key fails the build.
 */
type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

type Paths<T> = {
    [K in keyof T & string]: T[K] extends string
        ? K
        : keyof T[K] extends PluralCategory
          ? K
          : T[K] extends object
            ? `${K}.${Paths<T[K]>}`
            : never;
}[keyof T & string];

export type TranslationKey = Paths<typeof en>;
