import { describe, expect, it } from 'bun:test';
import { textDirection } from './localeDirection';

describe('textDirection', () => {
    it('marks Latin-script locales ltr', () => {
        expect(textDirection('en')).toBe('ltr');
        expect(textDirection('en-US')).toBe('ltr');
        expect(textDirection('de-DE')).toBe('ltr');
    });

    it('marks right-to-left locales by their script', () => {
        expect(textDirection('ar')).toBe('rtl');
        expect(textDirection('ar-EG')).toBe('rtl');
        expect(textDirection('he')).toBe('rtl');
        expect(textDirection('fa-IR')).toBe('rtl');
        expect(textDirection('ur')).toBe('rtl');
    });

    it('resolves a mixed-script language by its script', () => {
        // Kurdish is written in several scripts; ICU's likely script for
        // bare 'ku' is Latin, an explicit Arabic tag is right-to-left.
        expect(textDirection('ku')).toBe('ltr');
        expect(textDirection('ku-Arab-IQ')).toBe('rtl');
    });

    it('returns ltr for anything it cannot resolve', () => {
        expect(textDirection('not-a-locale!')).toBe('ltr');
        expect(textDirection('')).toBe('ltr');
    });
});
