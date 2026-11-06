/**
 * Project -- a named collection of tasks linked by tag.
 * The `tag` field holds the project's tag (e.g. "project:build-erledigen").
 * Tasks belong to this project when their tags array includes `tag`.
 */
export interface Project {
    id: string;
    name: string;
    tag: string;
    description: string | null;
    startDate: string | null;
    dueDate: string | null;
    /** The hill progress marker (USE-17, ADR-011): one user-dragged
     *  position 0-100 -- uphill = figuring it out, top = scope settled,
     *  downhill = executing. No percentages are ever displayed, and
     *  nothing moves it but the user. */
    hillPosition: number;
    createdAt: string;
    completedAt: string | null;
}

/**
 * Input for creating a new project.
 * `tag` is auto-generated from name if not provided.
 */
export type CreateProjectInput = {
    name: string;
    tag?: string;
    description?: string | null;
    startDate?: string | null;
    dueDate?: string | null;
    hillPosition?: number;
};

/**
 * Input for updating an existing project
 */
export type UpdateProjectInput = Partial<{
    name: string;
    tag: string;
    description: string | null;
    startDate: string | null;
    dueDate: string | null;
    hillPosition: number;
    completedAt: string | null;
}>;
