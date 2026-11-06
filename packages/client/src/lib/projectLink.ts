/**
 * Project cross-links (USE-17, ADR-011).
 *
 * Anything wearing a project's tag -- day tasks, habits, someday lists
 * -- shows the project chip, and the chip hops to the project's home.
 * The tag is the join key: no id indirection, just a lookup against
 * the projects the store holds.
 */

import type { Project } from '@erledigen/shared';
import { projectStore, uiStore } from '#lib/stores/index.ts';

/** The project a tag belongs to, when it is a project tag. */
export function projectByTag(tag: string): Project | null {
    return projectStore.projects.find(p => p.tag === tag) ?? null;
}

/** Open the project home of the project owning this tag. Returns false
 *  when the tag is not a project tag (the chip should not have
 *  rendered as a link in that case). */
export function openProjectHomeByTag(tag: string): boolean {
    const project = projectByTag(tag);
    if (!project) return false;
    uiStore.openModal('projects', { projectId: project.id });
    return true;
}
