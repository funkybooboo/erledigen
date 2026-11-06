/**
 * Project milestones on their days (USE-19, ADR-011).
 *
 * A project's start, due, and completed dates draw notes on the day
 * list -- the same banner family the holidays shipped with. Pure
 * derivation; the DaySection renders what these produce.
 */

import type { Project } from '@erledigen/shared';

export type MilestoneKind = 'starts' | 'due' | 'completed';

export interface ProjectMilestone {
    project: Project;
    kind: MilestoneKind;
}

/** The milestone banners one day draws: every project whose start,
 *  due, or completed date falls on it. */
export function milestonesOn(projects: Project[], date: string): ProjectMilestone[] {
    const milestones: ProjectMilestone[] = [];
    for (const project of projects) {
        if (project.startDate === date) milestones.push({ project, kind: 'starts' });
        if (project.dueDate === date) milestones.push({ project, kind: 'due' });
        if (project.completedAt?.slice(0, 10) === date)
            milestones.push({ project, kind: 'completed' });
    }
    return milestones;
}

/**
 * The nag on today (USE-19): an uncompleted project whose due date
 * has passed keeps drawing its due note on today until it is marked
 * complete -- the calendar does not let the deadline fall out of
 * view. Only TODAY draws nags, and never alongside the due date
 * itself (that day already carries the real banner).
 */
export function dueNagOn(projects: Project[], date: string, today: string): ProjectMilestone[] {
    if (date !== today) return [];
    const nagged: ProjectMilestone[] = [];
    for (const project of projects) {
        if (project.completedAt !== null) continue;
        if (project.dueDate !== null && project.dueDate < today) {
            nagged.push({ project, kind: 'due' });
        }
    }
    return nagged;
}
