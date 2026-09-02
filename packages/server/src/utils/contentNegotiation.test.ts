import { describe, expect, it } from 'bun:test';
import { negotiate } from './contentNegotiation';

describe('negotiate', () => {
    it('returns json when accept is undefined', () => {
        expect(negotiate(undefined)).toBe('json');
    });

    it('returns json for application/json', () => {
        expect(negotiate('application/json')).toBe('json');
    });

    it('returns json for */* (browser default)', () => {
        expect(negotiate('*/*')).toBe('json');
    });

    it('returns json for absent accept header (empty string)', () => {
        expect(negotiate('')).toBe('json');
    });

    it('returns text for text/plain', () => {
        expect(negotiate('text/plain')).toBe('text');
    });

    it('returns text for text/plain; charset=utf-8', () => {
        expect(negotiate('text/plain; charset=utf-8')).toBe('text');
    });

    it('returns text when text/plain is listed first at equal q', () => {
        expect(negotiate('text/plain, application/json')).toBe('text');
    });

    it('returns json for the axios/bruno default accept header', () => {
        // The regression this rewrite exists for: axios-based clients send
        // "application/json, text/plain, */*" and used to receive plain
        // text from every list endpoint via a naive substring match.
        expect(negotiate('application/json, text/plain, */*')).toBe('json');
        expect(negotiate('application/json, text/plain')).toBe('json');
    });

    it('honors q-values: text/plain at lower quality stays json', () => {
        expect(negotiate('text/plain;q=0.1, application/json')).toBe('json');
        expect(negotiate('application/json;q=0.5, text/plain;q=0.9')).toBe('text');
    });

    it('treats q=0 as excluded', () => {
        expect(negotiate('text/plain;q=0, application/json')).toBe('json');
        expect(negotiate('application/json;q=0, text/plain')).toBe('text');
    });

    it('matches type wildcards', () => {
        expect(negotiate('text/*')).toBe('text');
        // Wildcard-only headers match both formats equally; json is the
        // safe default on ties.
        expect(negotiate('*/*, text/plain')).toBe('json');
    });
});
