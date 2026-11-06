import { describe, expect, it } from 'bun:test';
import { extractInlineTags, parseTags } from './parseTags';

describe('parseTags', () => {
    it('splits on commas and trims whitespace', () => {
        expect(parseTags('work, home , errands')).toEqual(['work', 'home', 'errands']);
    });

    it('drops empty segments', () => {
        expect(parseTags('work,, ,')).toEqual(['work']);
        expect(parseTags('')).toEqual([]);
    });
});

describe('extractInlineTags', () => {
    it('extracts hashtags from text and strips them', () => {
        expect(extractInlineTags('buy milk tomorrow #work #p1')).toEqual({
            text: 'buy milk tomorrow',
            tags: ['work', 'p1'],
        });
    });

    it('lowercases, de-duplicates, and keeps first-seen order', () => {
        expect(extractInlineTags('ship it #Work #work #p2')).toEqual({
            text: 'ship it',
            tags: ['work', 'p2'],
        });
    });

    it('keeps inner-word hashes and requires a word start', () => {
        expect(extractInlineTags('fix the a#1 issue')).toEqual({
            text: 'fix the a#1 issue',
            tags: [],
        });
        expect(extractInlineTags('file #2026-taxes today')).toEqual({
            text: 'file today',
            tags: ['2026-taxes'],
        });
    });

    it('leaves text with a leading standalone hash alone', () => {
        expect(extractInlineTags('#p1')).toEqual({ text: '#p1', tags: [] });
    });

    it('reads project-kind tags (interior colons) as one tag', () => {
        // The `project:` prefix is first-class in the one grammar
        // (rule 3): tasks created in a project's surfaces wear the
        // project tag through the same inline parse as every tag.
        expect(extractInlineTags('Test from home #project:build-house')).toEqual({
            text: 'Test from home',
            tags: ['project:build-house'],
        });
        // A trailing colon is punctuation, not part of the tag.
        expect(extractInlineTags('call #work: urgent')).toEqual({
            text: 'call : urgent',
            tags: ['work'],
        });
    });

    it('keeps the tags literal when nothing would remain', () => {
        expect(extractInlineTags('   #work   ')).toEqual({ text: '#work', tags: [] });
    });

    it('returns no tags for plain text', () => {
        expect(extractInlineTags('just some text')).toEqual({
            text: 'just some text',
            tags: [],
        });
    });
});
