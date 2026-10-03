/**
 * Holiday -- a named calendar date the user wants surfaced in the app
 * (v0.9.0). Holidays are date-specific rows, not recurring rules: one
 * row per named date (importing next year's calendar adds new rows).
 * They render as banners above day-section headers and feed the
 * Summary modal's "next 14 days" section.
 */

export interface Holiday {
    id: string;
    name: string;
    /** Local `yyyy-MM-dd` key string, same convention as Task.date. */
    date: string;
    createdAt: string;
}

export type CreateHolidayInput = {
    name: string;
    date: string;
};

export type UpdateHolidayInput = Partial<{
    name: string;
    date: string;
}>;
