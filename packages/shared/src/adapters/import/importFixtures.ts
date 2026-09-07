/**
 * Test fixtures for the import adapters.
 *
 * Test-only helpers -- NOT exported from the package index. The
 * foreign-format documents follow the REAL export shapes of their
 * source apps (Todoist's CSV export, things.py/things-cli JSON, and
 * RFC 5545 calendars from Google/Apple/Outlook) so the adapters are
 * tested against files the way the apps actually write them.
 */

import type { ImportedTask, ParsedTasks } from '../../types/import';

/** A minimal valid ImportedTask with every field overridable. */
export function makeImportedTask(
    overrides: Partial<ImportedTask> & Pick<ImportedTask, 'text'>,
): ImportedTask {
    return {
        notes: null,
        date: null,
        startTime: null,
        endTime: null,
        tags: [],
        completed: false,
        canceled: false,
        subtasks: [],
        ...overrides,
    };
}

/** A minimal valid ParsedTasks. */
export function makeParsedTasks(overrides: Partial<ParsedTasks> = {}): ParsedTasks {
    return { tasks: [], warnings: [], ...overrides };
}

/**
 * A REAL Todoist CSV project export (bboc/todoist-converter test data,
 * itself exported from Todoist): TYPE/CONTENT/PRIORITY/INDENT/AUTHOR/
 * RESPONSIBLE/DATE/DATE_LANG/TIMEZONE header, blank separator rows,
 * note rows attaching upward, `@label` tokens, relative dates, quoted
 * multi-line cells (with embedded commas).
 */
export const TODOIST_CSV_EXPORT = [
    'TYPE,CONTENT,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE',
    'task,@errands test project task with deadline and all the other stuff,1,1,Bernhard (1846598),,in 5 days,en,Europe/Berlin',
    'note,first comment blah blah,,,Bernhard (1846598),,,,',
    'note,second comment,,,Bernhard (1846598),,,,',
    ',,,,,,,,',
    'task,test project subtask,4,2,Bernhard (1846598),,,en,Europe/Berlin',
    ',,,,,,,,',
    'task,task level one,4,1,Bernhard (1846598),,,en,Europe/Berlin',
    'note,"note for level one task\n\nwith a few linebreaks, \nof course",,,Bernhard (1846598),,,,',
    ',,,,,,,,',
    'task,task level two,4,2,Bernhard (1846598),,,en,Europe/Berlin',
    'note,"note for level two task\n\nwith a few linebreaks",,,Bernhard (1846598),,,,',
    ',,,,,,,,',
].join('\r\n');

/** A Todoist export shaped like the CURRENT CSV template: DESCRIPTION,
 *  absolute due date with time, and a canceled-attachment-free note. */
export const TODOIST_CSV_TEMPLATE_STYLE = [
    'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE',
    'task,Water the plants @home @weekend,Check the soil first,2,1,,,2026-03-14 17:00,en,Europe/Berlin',
    'task,Quarterly taxes,File both federal and state,1,1,,,2026-03-15,en,Europe/Berlin',
    'note,Remember the extension form,,,Bernhard (1846598),,,,',
    'task,Dinner reservation,Call the restaurant,4,1,,,,',
    'task,Every Monday standup,Team sync,3,1,,,every Monday,en,Europe/Berlin',
].join('\r\n');

/**
 * A things-cli --json style export (thingsapi/things.py schema):
 * to-dos with tags, checklist items, reminders, Someday/Anytime/Inbox
 * start buckets, completed and canceled items, a skipped project.
 */
export const THINGS_JSON_EXPORT = JSON.stringify(
    [
        {
            uuid: '5pUx6PESj3ctFYbgth1PXY',
            type: 'to-do',
            title: 'To-Do in Today',
            subtitle: '',
            notes: 'With\nNotes',
            status: 'incomplete',
            start: 'Anytime',
            start_date: '2026-03-28',
            deadline: null,
            stop_date: null,
            created: '2026-03-28 21:11:22',
            modified: '2026-03-28 21:11:30',
            reminder_time: '08:30',
            tags: ['home', 'errands'],
            checklist: [
                {
                    uuid: 'i1',
                    type: 'checklist-item',
                    title: 'Buy screws',
                    status: 'incomplete',
                    stop_date: null,
                    created: '2026-03-28 21:11:22',
                    modified: '2026-03-28 21:11:22',
                },
                {
                    uuid: 'i2',
                    type: 'checklist-item',
                    title: 'Buy nails',
                    status: 'completed',
                    stop_date: '2026-03-29 10:00:00',
                    created: '2026-03-28 21:11:22',
                    modified: '2026-03-29 10:00:00',
                },
            ],
        },
        {
            uuid: 'q1w2e3',
            type: 'to-do',
            title: 'Read Ulysses',
            subtitle: '',
            notes: '',
            status: 'incomplete',
            start: 'Someday',
            start_date: null,
            deadline: '2026-12-31',
            stop_date: null,
            created: '2025-01-01 08:00:00',
            modified: '2025-01-01 08:00:00',
        },
        {
            uuid: 'c4nC3',
            type: 'to-do',
            title: 'Inbox zero',
            subtitle: '',
            notes: '',
            status: 'completed',
            start: 'Anytime',
            start_date: '2026-03-01',
            deadline: null,
            stop_date: '2026-03-02 09:00:00',
            created: '2026-02-01 09:00:00',
            modified: '2026-03-02 09:00:00',
        },
        {
            uuid: 'x0x0x0',
            type: 'to-do',
            title: 'Give up on RSS',
            subtitle: '',
            notes: '',
            status: 'canceled',
            start: 'Someday',
            start_date: null,
            deadline: null,
            stop_date: '2026-01-15 12:00:00',
            created: '2026-01-10 12:00:00',
            modified: '2026-01-15 12:00:00',
        },
        {
            uuid: 'pR0j3cT',
            type: 'project',
            title: 'Home Renovation',
            subtitle: '',
            notes: '',
            status: 'incomplete',
            start: 'Anytime',
            start_date: null,
            deadline: null,
            stop_date: null,
            created: '2026-01-01 00:00:00',
            modified: '2026-01-01 00:00:00',
        },
    ],
    null,
    2,
);

/**
 * A Google-Calendar-style .ics: folded summary lines, TZID times,
 * all-day VALUE=DATE event, a recurring event, a canceled event.
 */
export const ICAL_GOOGLE_EXPORT = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VTIMEZONE',
    'TZID:America/Denver',
    'BEGIN:DAYLIGHT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
    'TZOFFSETFROM:-0700',
    'TZOFFSETTO:-0600',
    'TZNAME:MDT',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
    'TZOFFSETFROM:-0600',
    'TZOFFSETTO:-0700',
    'TZNAME:MST',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    'DTSTART;TZID=America/Denver:20260314T090000',
    'DTEND;TZID=America/Denver:20260314T100000',
    'SUMMARY:Dentist appointment',
    'DESCRIPTION:Cleaning\\, and bring the referral',
    'CATEGORIES:health,appointments',
    'UID:evt-1',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20260316',
    'SUMMARY:Trip to the mountains',
    'UID:evt-2',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'DTSTART;TZID=America/Denver:20260317T180000',
    'SUMMARY:Weekly review',
    'RRULE:FREQ=WEEKLY;BYDAY=MO',
    'UID:evt-3',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20260310',
    'SUMMARY:Canceled picnic',
    'STATUS:CANCELLED',
    'UID:evt-4',
    'END:VEVENT',
    'END:VCALENDAR',
].join('\r\n');

/** Our own .ics export shape (floating local DATE-TIME, per ADR-008). */
export const ICAL_ERLEDIGEN_EXPORT = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Erledigen//Task Export//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    'UID:task-1',
    'DTSTART:20260115T090000',
    'DTEND:20260115T100000',
    'SUMMARY:Plan the weekend',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:task-2',
    'DTSTART;VALUE=DATE:20260116',
    'SUMMARY:All-day outing',
    'END:VEVENT',
    'END:VCALENDAR',
].join('\r\n');

/** A generic CSV with recognizable header names and mixed values. */
export const GENERIC_CSV = [
    'Title,Due Date,Notes,Tags,Done,Start Time,End Time',
    'Write the report,2026-03-20,Final draft due,work writing,true,09:00,11:00',
    'Call the dentist,2026-03-18,,,false,,',
    'Someday idea,,,reading someday,false,,',
    'Bad date row,03/18/2026,,,false,,,',
].join('\r\n');
