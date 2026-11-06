/**
 * SomedayList -- one list inside a Someday tab (USE-16, ADR-011).
 *
 * Lists are not tied to a date; tasks parked in them are undated
 * backlog. Plain lists carry no tag of their own -- a list under a
 * project tab inherits the project's tag (the tab carries it).
 */

export interface SomedayList {
    id: string;
    tabId: string;
    name: string;
    position: number;
    createdAt: string;
}

export type CreateSomedayListInput = {
    tabId: string;
    name: string;
    position: number;
};

export type UpdateSomedayListInput = Partial<{
    tabId: string;
    name: string;
    position: number;
}>;
