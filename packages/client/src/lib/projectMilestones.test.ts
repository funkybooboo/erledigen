import { describe, expect, test } from 'bun:test';
import type { Project } from '@erledigen/shared';
import { dueNagOn, milestonesOn } from './projectMilestones';

const today = '2026-03-10';

const project = (overrides: Partial<Project> & Pick<Project, 'id' | 'name'>): Project => ({
    tag: 'project:x',
    description: null,
    startDate: null,
    dueDate: null,
    hillPosition: 0,
    createdAt: '2026-01-01T00:00:00Z',
    completedAt: null,
    ...overrides,
});

describe('milestonesOn', () => {
    test('draws a note on each of the project dates', () => {
        const p = project({
            id: 'p1',
            name: 'House',
            startDate: '2026-03-01',
            dueDate: '2026-03-20',
            completedAt: '2026-03-22T10:00:00.000Z',
        });
        expect(milestonesOn([p], '2026-03-01')).toEqual([{ project: p, kind: 'starts' }]);
        expect(milestonesOn([p], '2026-03-20')).toEqual([{ project: p, kind: 'due' }]);
        // completedAt is a timestamp; the note lands on its date part.
        expect(milestonesOn([p], '2026-03-22')).toEqual([{ project: p, kind: 'completed' }]);
        expect(milestonesOn([p], '2026-03-10')).toEqual([]);
    });

    test('a project can draw more than one note on the same day', () => {
        const p = project({
            id: 'p2',
            name: 'Same day',
            startDate: '2026-03-05',
            dueDate: '2026-03-05',
        });
        const kinds = milestonesOn([p], '2026-03-05').map(m => m.kind);
        expect(kinds).toEqual(['starts', 'due']);
    });

    test('projects without dates draw nothing', () => {
        const p = project({ id: 'p3', name: 'Bare' });
        expect(milestonesOn([p], today)).toEqual([]);
    });
});

describe('dueNagOn', () => {
    test('nags on today for uncompleted projects whose due date passed', () => {
        const overdue = project({ id: 'p4', name: 'Overdue', dueDate: '2026-03-01' });
        expect(dueNagOn([overdue], today, today)).toEqual([{ project: overdue, kind: 'due' }]);
        // Other days never nag, even for the same project.
        expect(dueNagOn([overdue], '2026-03-11', today)).toEqual([]);
    });

    test('never nags a completed project', () => {
        const done = project({
            id: 'p5',
            name: 'Done',
            dueDate: '2026-03-01',
            completedAt: '2026-03-02T00:00:00.000Z',
        });
        expect(dueNagOn([done], today, today)).toEqual([]);
    });

    test('never nags the due date itself -- that day has the real banner', () => {
        const dueToday = project({ id: 'p6', name: 'Due today', dueDate: today });
        expect(dueNagOn([dueToday], today, today)).toEqual([]);
        expect(milestonesOn([dueToday], today)).toEqual([{ project: dueToday, kind: 'due' }]);
    });
});
