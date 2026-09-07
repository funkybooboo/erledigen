import { describe, expect, test } from 'bun:test';
import { ImportValidationError } from './ImportValidationError';
import { THINGS_JSON_EXPORT } from './importFixtures';
import { ThingsJsonImportAdapter } from './ThingsJsonImportAdapter';

describe('ThingsJsonImportAdapter', () => {
    test('imports to-dos with date, reminder, tags, and notes', () => {
        const { tasks, warnings } = new ThingsJsonImportAdapter().import(THINGS_JSON_EXPORT);
        expect(warnings.some(w => w.message.includes('Home Renovation'))).toBe(true);

        const today = tasks.find(t => t.text === 'To-Do in Today');
        expect(today?.date).toBe('2026-03-28');
        expect(today?.startTime).toBe('08:30');
        expect(today?.tags).toEqual(['home', 'errands']);
        expect(today?.notes).toBe('With\nNotes');
        expect(today?.completed).toBe(false);
    });

    test('checklist items become sub-tasks with status kept', () => {
        const { tasks } = new ThingsJsonImportAdapter().import(THINGS_JSON_EXPORT);
        const today = tasks.find(t => t.text === 'To-Do in Today');
        expect(today?.subtasks.length).toBe(2);
        expect(today?.subtasks[0]?.text).toBe('Buy screws');
        expect(today?.subtasks[0]?.completed).toBe(false);
        expect(today?.subtasks[1]?.text).toBe('Buy nails');
        expect(today?.subtasks[1]?.completed).toBe(true);
    });

    test('Someday to-dos import undated; deadlines are kept in the notes', () => {
        const { tasks } = new ThingsJsonImportAdapter().import(THINGS_JSON_EXPORT);
        const ulysses = tasks.find(t => t.text === 'Read Ulysses');
        expect(ulysses?.date).toBeNull();
        expect(ulysses?.notes).toBe('Deadline: 2026-12-31');
    });

    test('completed to-dos import as completed', () => {
        const { tasks } = new ThingsJsonImportAdapter().import(THINGS_JSON_EXPORT);
        const inboxZero = tasks.find(t => t.text === 'Inbox zero');
        expect(inboxZero?.completed).toBe(true);
        expect(inboxZero?.canceled).toBe(false);
    });

    test('canceled to-dos import as canceled (they land in the trash)', () => {
        const { tasks } = new ThingsJsonImportAdapter().import(THINGS_JSON_EXPORT);
        const rss = tasks.find(t => t.text === 'Give up on RSS');
        expect(rss?.canceled).toBe(true);
        expect(rss?.completed).toBe(false);
        expect(rss?.date).toBeNull();
    });

    test('projects and headings are skipped with a warning', () => {
        const { tasks, warnings } = new ThingsJsonImportAdapter().import(THINGS_JSON_EXPORT);
        expect(tasks.some(t => t.text === 'Home Renovation')).toBe(false);
        expect(warnings.some(w => w.message.includes('project "Home Renovation"'))).toBe(true);
    });

    test('throws for non-JSON input', () => {
        expect(() => new ThingsJsonImportAdapter().import('nope')).toThrow(ImportValidationError);
    });

    test('throws for a non-array top level', () => {
        expect(() => new ThingsJsonImportAdapter().import(JSON.stringify({ todos: [] }))).toThrow(
            /top-level array/,
        );
    });

    test('skips to-dos without a title with a warning', () => {
        const { tasks, warnings } = new ThingsJsonImportAdapter().import(
            JSON.stringify([{ type: 'to-do', title: '  ', status: 'incomplete' }]),
        );
        expect(tasks).toEqual([]);
        expect(warnings[0]?.message).toContain('without a title');
    });
});
