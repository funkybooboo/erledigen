<script lang="ts">
    import Modal from '$lib/components/Modal.svelte';
    import { uiStore, dateViewStore } from '$lib/stores';
    import { container } from '$lib/container';
    import { i18nStore } from '$lib/i18n/i18nStore.svelte';
    import type { TranslationKey } from '$lib/i18n/locales';

    /** Locale keys for the two-letter weekday headers (index 0=Sunday --
     *  kept as compile-checked keys; Intl's narrow/short widths do not
     *  match the compact two-letter style). */
    const WEEKDAY_HEADER_KEYS: readonly TranslationKey[] = [
        'calendar.weekdayHeaders.su',
        'calendar.weekdayHeaders.mo',
        'calendar.weekdayHeaders.tu',
        'calendar.weekdayHeaders.we',
        'calendar.weekdayHeaders.th',
        'calendar.weekdayHeaders.fr',
        'calendar.weekdayHeaders.sa',
    ] as const;

    let { onclose = () => {} }: { onclose?: () => void } = $props();

    let selectedDate = $state('');

    function handleDateSelect() {
        if (!selectedDate) return;
        // Route through the shared date-view store so DayList slides its
        // window when the date is outside the loaded range and the minimap
        // centers on the target month -- same path as the Today button.
        dateViewStore.requestScroll(selectedDate, true);
        uiStore.closeModal();
    }

    function goToToday() {
        selectedDate = container.dateProvider.today();
        // Full reset: also re-center the calendar grid itself on the
        // current month.
        const [y, m] = todayParts();
        viewYear = y;
        viewMonth = m;
        handleDateSelect();
    }

    // [year, monthIndex] of "today" per the date provider (timezone-aware).
    function todayParts(): [number, number] {
        const [y, m] = container.dateProvider.today().split('-').map(Number);
        return [y, m - 1];
    }

    const [initYear, initMonth] = todayParts();
    let viewYear = $state(initYear);
    let viewMonth = $state(initMonth);

    let monthName = $derived(
        new Intl.DateTimeFormat(container.i18n.locale, {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
        }).format(new Date(Date.UTC(viewYear, viewMonth, 15))),
    );
    let daysInMonth = $derived(new Date(viewYear, viewMonth + 1, 0).getDate());
    let firstDayOfWeek = $derived(new Date(viewYear, viewMonth, 1).getDay());
    let calendarDays = $derived(generateCalendarDays());

    function generateCalendarDays() {
        const days: (number | null)[] = [];
        for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
        for (let d = 1; d <= daysInMonth; d++) days.push(d);
        return days;
    }

    function prevMonth() {
        viewMonth--;
        if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    }

    function nextMonth() {
        viewMonth++;
        if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    }

    function dateStr(day: number): string {
        return `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    /** Accessible name for a day cell: the full date, not the bare day
     *  number (a screen reader hears "October 15, 2026" without needing
     *  the month header's context, USE-9). */
    function dayLabel(day: number): string {
        const month = new Intl.DateTimeFormat(container.i18n.locale, {
            month: 'long',
            timeZone: 'UTC',
        }).format(new Date(Date.UTC(viewYear, viewMonth, 15)));
        return `${month} ${day}, ${viewYear}`;
    }
</script>

<Modal title={i18nStore.t('modal.calendar')} onclose={onclose}>
    <div class="calendar">
        <button class="today-btn" onclick={goToToday}>{i18nStore.t('calendar.today')}</button>

        <div class="month-nav">
            <button onclick={prevMonth} aria-label={i18nStore.t('calendar.prevMonth')}>&#8249;</button>
            <span class="month-name">{monthName}</span>
            <button onclick={nextMonth} aria-label={i18nStore.t('calendar.nextMonth')}>&#8250;</button>
        </div>

        <div class="weekday-headers">
            {#each WEEKDAY_HEADER_KEYS as key}
                <span class="weekday">{i18nStore.t(key)}</span>
            {/each}
        </div>

        <div class="days-grid">
            {#each calendarDays as day}
                {#if day === null}
                    <span class="day-cell empty"></span>
                {:else}
                    <button
                        class="day-cell"
                        class:selected={selectedDate === dateStr(day)}
                        class:today={dateStr(day) === container.dateProvider.today()}
                        onclick={() => { selectedDate = dateStr(day); handleDateSelect(); }}
                        aria-label={i18nStore.t(
                            dateStr(day) === container.dateProvider.today()
                                ? 'calendar.dayAriaToday'
                                : 'calendar.dayAria',
                            { date: dayLabel(day) },
                        )}
                        aria-current={dateStr(day) === container.dateProvider.today() ? 'date' : undefined}
                    >
                        {day}
                    </button>
                {/if}
            {/each}
        </div>
    </div>
</Modal>

<style>
    .calendar {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .today-btn {
        align-self: flex-start;
        background: var(--color-accent);
        color: var(--color-on-accent);
        border: none;
        border-radius: 999px;
        padding: 6px 12px;
        font-size: 13px;
        cursor: pointer;
    }

    .today-btn:hover {
        background: var(--color-accent-hover);
    }

    .month-nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 15px;
        font-weight: 600;
    }

    .month-nav button {
        background: none;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        width: 28px;
        height: 28px;
        cursor: pointer;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .month-nav button:hover {
        background: var(--color-surface-hover);
    }

    .weekday-headers {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        text-align: center;
    }

    .weekday {
        font-size: 12px;
        font-weight: 600;
        color: var(--color-text-secondary);
        padding: 4px;
    }

    .days-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
    }

    .day-cell {
        width: 100%;
        aspect-ratio: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        background: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        color: var(--color-text);
        transition: background-color 0.1s;
    }

    .day-cell:hover {
        background: var(--color-surface-hover);
    }

    .day-cell.today {
        font-weight: 700;
        color: var(--color-accent);
    }

    .day-cell.selected {
        background: var(--color-accent);
        color: var(--color-on-accent);
    }

    .day-cell.empty {
        cursor: default;
    }
</style>