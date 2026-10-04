/**
 * DayNote -- one note per calendar day, the paper calendar's margin
 * (v0.10.0). A day note is part of its day: it renders in the day
 * section below the header, never a task, never reorderable, and it
 * rides the export backup like every other entity.
 *
 * One row per date (UNIQUE): the id is internal bookkeeping -- the
 * client addresses notes by DATE (upsert/delete by date), and rows are
 * created lazily the first time a day's note is written and deleted
 * when the note is emptied out.
 */

export interface DayNote {
    id: string;
    /** Local `yyyy-MM-dd` key string, same convention as Task.date. */
    date: string;
    /** Markdown text (rendered client-side, ADR-015). */
    notes: string;
    createdAt: string;
    updatedAt: string;
}

/** PUT /api/day-notes/:date -- create-or-replace the day's note. */
export type UpsertDayNoteInput = {
    notes: string;
};

/** What an upsert hands back: the stored row plus whether this call
 *  created it (routes broadcast dayNote:created vs dayNote:updated). */
export interface DayNoteUpsertResult {
    dayNote: DayNote;
    created: boolean;
}
