import { describe, expect, test } from 'bun:test';
import { ImportValidationError } from './ImportValidationError';
import { TODOIST_CSV_EXPORT, TODOIST_CSV_TEMPLATE_STYLE } from './importFixtures';
import { TodoistCsvImportAdapter } from './TodoistCsvImportAdapter';

describe('TodoistCsvImportAdapter (real export shape)', () => {
    test('extracts @labels as tags and strips them from the text', () => {
        const { tasks } = new TodoistCsvImportAdapter().import(TODOIST_CSV_TEMPLATE_STYLE);
        const water = tasks.find(t => t.text === 'Water the plants');
        expect(water?.tags).toEqual(['home', 'weekend', 'p2']); // PRIORITY=2 -> p2
    });

    test('maps PRIORITY 1-4 to p1/p2/p3/none (1 = highest)', () => {
        const { tasks } = new TodoistCsvImportAdapter().import(TODOIST_CSV_TEMPLATE_STYLE);
        expect(tasks.find(t => t.text === 'Water the plants')?.tags).toContain('p2');
        expect(tasks.find(t => t.text === 'Quarterly taxes')?.tags).toContain('p1');
        expect(tasks.find(t => t.text === 'Dinner reservation')?.tags).toEqual([]);
        expect(tasks.find(t => t.text === 'Every Monday standup')?.tags).toContain('p3');
    });

    test('imports absolute due dates with times', () => {
        const { tasks } = new TodoistCsvImportAdapter().import(TODOIST_CSV_TEMPLATE_STYLE);
        const taxes = tasks.find(t => t.text === 'Quarterly taxes');
        expect(taxes?.date).toBe('2026-03-15');
        expect(taxes?.startTime).toBeNull();
        const water = tasks.find(t => t.text === 'Water the plants');
        expect(water?.date).toBe('2026-03-14');
        expect(water?.startTime).toBe('17:00');
    });

    test('imports recurring/relative dates undated with a warning', () => {
        const { tasks, warnings } = new TodoistCsvImportAdapter().import(
            TODOIST_CSV_TEMPLATE_STYLE,
        );
        const standup = tasks.find(t => t.text === 'Every Monday standup');
        expect(standup?.date).toBeNull();
        expect(warnings.some(w => w.message.includes('every Monday'))).toBe(true);
    });

    test('reads DESCRIPTION into notes', () => {
        const { tasks } = new TodoistCsvImportAdapter().import(TODOIST_CSV_TEMPLATE_STYLE);
        expect(tasks.find(t => t.text === 'Water the plants')?.notes).toBe('Check the soil first');
    });

    test('attaches note rows to the preceding task (after DESCRIPTION)', () => {
        const { tasks } = new TodoistCsvImportAdapter().import(TODOIST_CSV_TEMPLATE_STYLE);
        expect(tasks.find(t => t.text === 'Quarterly taxes')?.notes).toBe(
            'File both federal and state\nRemember the extension form',
        );
    });

    test('handles the older export shape: INDENT nesting and note rows', () => {
        const { tasks, warnings } = new TodoistCsvImportAdapter().import(TODOIST_CSV_EXPORT);
        // Top-level tasks: errands task, subtask is nested under "task level one"?
        // Export order: errands task (indent 1), subtask (indent 2, child of
        // the last indent-1 task = errands task), then level one/level two.
        const errands = tasks.find(
            t => t.text === 'test project task with deadline and all the other stuff',
        );
        expect(errands).toBeDefined();
        expect(errands?.tags).toEqual(['errands', 'p1']); // PRIORITY=1 -> p1
        expect(errands?.subtasks[0]?.text).toBe('test project subtask');
        expect(errands?.notes).toBe('first comment blah blah\nsecond comment');
        // 'in 5 days' relative date -> undated with warning
        expect(errands?.date).toBeNull();
        expect(warnings.some(w => w.message.includes('in 5 days'))).toBe(true);

        const levelOne = tasks.find(t => t.text === 'task level one');
        expect(levelOne?.notes).toContain('with a few linebreaks,');
        const levelTwo = levelOne?.subtasks[0];
        expect(levelTwo?.text).toBe('task level two');
    });

    test('blank separator rows are ignored', () => {
        const { tasks } = new TodoistCsvImportAdapter().import(TODOIST_CSV_EXPORT);
        expect(tasks.some(t => t.text === '')).toBe(false);
    });

    test('throws when TYPE/CONTENT columns are missing', () => {
        expect(() => new TodoistCsvImportAdapter().import('a,b\n1,2')).toThrow(
            ImportValidationError,
        );
    });
});
