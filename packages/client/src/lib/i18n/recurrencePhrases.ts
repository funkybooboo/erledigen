/**
 * The locale-backed RecurrencePhrases (USE-14): every sentence shape
 * describeRecurrence builds comes from the locale file (recurrence.* in
 * en.json), and the weekday names come from Intl against the active
 * locale -- English output stays byte-identical to the shipped wording.
 *
 * The ' at <time>' clause keeps its composition order (schedule, then
 * time); see docs/build/standards/i18n.md for the documented compromise.
 */

import { ENGLISH_RECURRENCE_PHRASES, type RecurrencePhrases } from '@erledigen/shared';
import { i18nStore } from './i18nStore.svelte';

/** 2024-01-01..2024-01-07 (UTC) is Monday..Sunday: weekday index -> date
 *  with that weekday, for Intl-based weekday naming. */
const WEEKDAY_ANCHORS = [
    '2024-01-07',
    '2024-01-01',
    '2024-01-02',
    '2024-01-03',
    '2024-01-04',
    '2024-01-05',
    '2024-01-06',
] as const;

function weekdayName(index: number, weekday: Intl.DateTimeFormatOptions['weekday']): string {
    const dateKey = WEEKDAY_ANCHORS[index];
    if (dateKey === undefined) return 'day';
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Intl.DateTimeFormat(i18nStore.locale, {
        weekday,
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(y, (m ?? 1) - 1, d)));
}

/** The recurrence phrases for the active locale. */
export function recurrencePhrases(): RecurrencePhrases {
    const t = i18nStore.t.bind(i18nStore);
    return {
        weekday: index => weekdayName(index, 'long'),
        weekdayShort: index => weekdayName(index, 'short'),
        weekdays: t('recurrence.weekdays'),
        weekends: t('recurrence.weekends'),
        everyDay: t('recurrence.everyDay'),
        everyOtherDay: t('recurrence.everyOtherDay'),
        everyNDays: interval => t('recurrence.everyNDays', { interval }),
        everyDayName: day => t('recurrence.everyDayName', { day }),
        everyNDaysOnDayName: (interval, day) =>
            t('recurrence.everyNDaysOnDayName', { interval, day }),
        everyNDaysOnDays: (interval, days) => t('recurrence.everyNDaysOnDays', { interval, days }),
        everyWeek: t('recurrence.everyWeek'),
        everyNWeeks: interval => t('recurrence.everyNWeeks', { interval }),
        everyWeekOnDays: days => t('recurrence.everyWeekOnDays', { days }),
        everyNWeeksOnDays: (interval, days) =>
            t('recurrence.everyNWeeksOnDays', { interval, days }),
        everyNWeeksOnDayName: (interval, day) =>
            t('recurrence.everyNWeeksOnDayName', { interval, day }),
        monthly: t('recurrence.monthly'),
        monthlyOnDay: day => t('recurrence.monthlyOnDay', { day }),
        everyNMonths: interval => t('recurrence.everyNMonths', { interval }),
        everyNMonthsOnDay: (interval, day) => t('recurrence.everyNMonthsOnDay', { interval, day }),
        everyYear: t('recurrence.everyYear'),
        everyNYears: interval => t('recurrence.everyNYears', { interval }),
        atTime: time => t('recurrence.atTime', { time }),
        // The friendly lowercase 'h:MMam/pm' label is the shipped English
        // wording; a locale whose clock reads differently replaces it in
        // its own phrases (the en file carries the ' at {time}' clause).
        timeLabel: ENGLISH_RECURRENCE_PHRASES.timeLabel,
    };
}
