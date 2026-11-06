/**
 * SomedayTab -- one tab of the Someday panel (USE-16, ADR-011).
 *
 * Tabs hold lists; lists hold the parked, undated tasks. A tab tied to
 * a project carries the project's tag (the tag is the join key --
 * ADR-011); a plain tab carries none.
 */

export interface SomedayTab {
    id: string;
    name: string;
    position: number;
    /** The project tag this tab belongs to (null = a plain tab). The
     *  tab's lists inherit it: tasks created there wear the tag. */
    projectTag: string | null;
    createdAt: string;
}

export type CreateSomedayTabInput = {
    name: string;
    position: number;
    projectTag?: string | null;
};

export type UpdateSomedayTabInput = Partial<{
    name: string;
    position: number;
    projectTag: string | null;
}>;
