import { describe, expect, it } from 'bun:test';
import type { LocaleMessages } from './I18nAdapter';
import { JsonI18nAdapter } from './JsonI18nAdapter';

/** Fixture locale files: en is complete and canonical; xx ships a subset
 *  so the fallback path is exercised. */
const FILES: Record<string, LocaleMessages> = {
    en: {
        app: {
            greeting: 'Hello {name}',
            count: 'Count: {count}',
            tasks: {
                one: '{count} task',
                other: '{count} tasks',
            },
        },
        common: {
            save: 'Save',
        },
    },
    xx: {
        common: {
            save: 'Xxsave',
        },
    },
};

describe('JsonI18nAdapter', () => {
    const adapter = new JsonI18nAdapter(FILES, { defaultLocale: 'en' });

    describe('locale switching', () => {
        it('starts on the default locale', () => {
            expect(adapter.locale).toBe('en');
            expect(adapter.t('common.save')).toBe('Save');
        });

        it('switches to a locale with a message file', () => {
            adapter.setLocale('xx');
            expect(adapter.locale).toBe('xx');
            expect(adapter.t('common.save')).toBe('Xxsave');
        });

        it('falls back to the default locale for an unknown id', () => {
            adapter.setLocale('does-not-exist');
            expect(adapter.locale).toBe('en');
        });

        it('lists every locale it carries files for', () => {
            expect([...adapter.availableLocales]).toEqual(['en', 'xx']);
        });
    });

    describe('t', () => {
        it('resolves dotted keys into nested files', () => {
            expect(adapter.t('app.greeting', { name: 'Ada' })).toBe('Hello Ada');
        });

        it('interpolates numeric params through Intl.NumberFormat', () => {
            expect(adapter.t('app.count', { count: 1 })).toBe('Count: 1');
        });

        it('leaves unknown placeholders verbatim (developer-visible)', () => {
            expect(adapter.t('app.greeting')).toBe('Hello {name}');
        });

        it('falls back to the default locale for keys the active locale misses', () => {
            adapter.setLocale('xx');
            expect(adapter.t('app.greeting', { name: 'Ada' })).toBe('Hello Ada');
            adapter.setLocale('en');
        });

        it('returns the raw key when no locale has it', () => {
            expect(adapter.t('app.nothing')).toBe('app.nothing');
        });

        it('rejects prototype-polluting keys', () => {
            expect(adapter.t('__proto__.constructor')).toBe('__proto__.constructor');
        });
    });

    describe('plurals', () => {
        it('selects the plural category of the active locale for {count}', () => {
            expect(adapter.t('app.tasks', { count: 1 })).toBe('1 task');
            expect(adapter.t('app.tasks', { count: 2 })).toBe('2 tasks');
            expect(adapter.t('app.tasks', { count: 0 })).toBe('0 tasks');
        });

        it('formats the count for the locale, not as a raw string', () => {
            expect(adapter.t('app.tasks', { count: 1234 })).toBe('1,234 tasks');
        });

        it('uses the plain key when no plural variants exist', () => {
            expect(adapter.t('app.count', { count: 3 })).toBe('Count: 3');
        });
    });

    describe('formatNumber', () => {
        it('formats in the active locale', () => {
            expect(adapter.formatNumber(1234.5)).toBe('1,234.5');
        });

        it('honors Intl.NumberFormat options', () => {
            expect(adapter.formatNumber(0.42, { style: 'percent' })).toBe('42%');
        });
    });
});
