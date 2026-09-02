<script lang="ts">
    import Modal from '$lib/components/Modal.svelte';
    import {
        GENERATE_HORIZON_DAYS,
        notificationStore,
        recurringTaskStore,
        taskStore,
        preferencesStore,
    } from '$lib/stores';
    import { Icon } from 'svelte-icons-pack';
    import { LuFlame, LuPencil, LuPlus, LuRepeat, LuTrash2 } from 'svelte-icons-pack/lu';
    import {
        WEEKDAY_ABBREVIATIONS,
        describeRecurrence,
        parseRecurrence,
        type RecurringFrequency,
        type RecurringTask,
    } from '@erledigen/shared';
    import { container } from '$lib/container';
    import { onMount } from 'svelte';

    let { onclose = () => {} }: { onclose?: () => void } = $props();

    onMount(() => {
        recurringTaskStore.fetchAll().then(() => {
            recurringTaskStore.fetchStats(recurringTaskStore.tasks.map(h => h.id));
        });
    });

    const DAY_NAMES = WEEKDAY_ABBREVIATIONS;

    // ------------------------------------------------------------------
    // Shared form state (used by either the "new" form or an edit form --
    // only one is visible at a time).
    // ------------------------------------------------------------------

    interface HabitForm {
        text: string;
        frequency: RecurringFrequency;
        interval: number;
        daysOfWeek: number[];
        dayOfMonth: number | null;
        startDate: string;
        endDate: string;
        startTime: string;
        rolloverEnabled: boolean;
    }

    function emptyForm(): HabitForm {
        return {
            text: '',
            frequency: 'daily',
            interval: 1,
            daysOfWeek: [],
            dayOfMonth: null,
            startDate: container.dateProvider.today(),
            endDate: '',
            startTime: '',
            rolloverEnabled: false,
        };
    }

    let form = $state<HabitForm>(emptyForm());
    let editingHabitId = $state<string | null>(null);
    let showForm = $state(false);
    let saving = $state(false);

    /** Day chips apply to daily and weekly schedules. */
    const usesDaysOfWeek = $derived(form.frequency === 'daily' || form.frequency === 'weekly');

    function toggleDay(day: number): void {
        const days = form.daysOfWeek;
        form.daysOfWeek = days.includes(day)
            ? days.filter(d => d !== day)
            : [...days, day].sort((a, b) => a - b);
    }

    // Live TeuxDeux-style parsing: typing "Water plants every friday at
    // 9am" prefills the schedule fields and shows a hint.
    let parsed = $derived(form.text.trim() ? parseRecurrence(form.text.trim()) : null);

    $effect(() => {
        if (parsed) {
            form.frequency = parsed.schedule.frequency;
            form.interval = parsed.schedule.interval;
            form.daysOfWeek = parsed.schedule.daysOfWeek ?? [];
            form.dayOfMonth = parsed.schedule.dayOfMonth;
            form.startTime = parsed.schedule.startTime ?? '';
        }
    });

    function startNew() {
        form = emptyForm();
        editingHabitId = null;
        showForm = true;
    }

    function startEdit(habit: RecurringTask) {
        form = {
            text: habit.text,
            frequency: habit.frequency,
            interval: habit.interval,
            daysOfWeek: habit.daysOfWeek ?? [],
            dayOfMonth: habit.dayOfMonth,
            startDate: habit.startDate,
            endDate: habit.endDate ?? '',
            startTime: habit.startTime ?? '',
            rolloverEnabled: habit.rolloverEnabled,
        };
        editingHabitId = habit.id;
        showForm = true;
    }

    function closeForm() {
        showForm = false;
        editingHabitId = null;
        form = emptyForm();
    }

    function handleFormKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveHabit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeForm();
        }
    }

    function horizonEnd(): string {
        const d = new Date(`${container.dateProvider.today()}T00:00:00`);
        d.setDate(d.getDate() + GENERATE_HORIZON_DAYS);
        return d.toISOString().split('T')[0] ?? container.dateProvider.today();
    }

    async function saveHabit() {
        // A trailing recurrence phrase wins: its clean text becomes the
        // habit name and its schedule is already prefilled into the form.
        const name = parsed ? parsed.cleanText : form.text.trim();
        if (!name || saving) return;
        saving = true;

        const input = {
            text: name,
            frequency: form.frequency,
            interval: Math.max(1, Number(form.interval) || 1),
            daysOfWeek: usesDaysOfWeek && form.daysOfWeek.length > 0 ? form.daysOfWeek : null,
            dayOfMonth:
                form.frequency === 'monthly' && form.dayOfMonth !== null
                    ? Math.min(31, Math.max(1, Number(form.dayOfMonth) || 1))
                    : null,
            startDate: form.startDate,
            endDate: form.endDate || null,
            startTime: form.startTime || null,
            rolloverEnabled: form.rolloverEnabled,
        };

        const result = editingHabitId
            ? await recurringTaskStore.update(editingHabitId, input)
            : await recurringTaskStore.create(input);

        saving = false;
        if (!result) return;

        // Materialize instances for the new/changed schedule right away.
        // Generation is idempotent, so existing instances are untouched.
        const tasks = await recurringTaskStore.ensureInstances(
            input.startDate,
            horizonEnd(),
        );
        if (tasks.length > 0) taskStore.ingest(tasks);

        closeForm();
    }

    async function deleteHabit(habit: RecurringTask) {
        if (preferencesStore.deleteConfirmation === 'confirm') {
            if (!window.confirm(`Delete habit "${habit.text}"?`)) return;
        }
        await recurringTaskStore.remove(habit.id);
        notificationStore.push('Habit deleted -- existing instances are kept', {
            kind: 'info',
        });
    }

    function getInstanceCount(habitId: string): number {
        return taskStore.tasks.filter(t => t.recurringTaskId === habitId).length;
    }

    /** Current streak count for the badge next to the flame icon. */
    function streakLabel(habitId: string): string {
        return String(recurringTaskStore.stats.get(habitId)?.currentStreak ?? 0);
    }
</script>

<Modal title="Habits" onclose={onclose}>
    <div class="habits">
        <div class="list-header">
            <h3>Recurring Tasks</h3>
            <button class="icon-btn" onclick={startNew} aria-label="New habit">
                <Icon src={LuPlus} />
            </button>
        </div>

        {#if showForm}
            <div class="inline-form">
                <div class="form-row name-row">
                    <input
                        type="text"
                        bind:value={form.text}
                        placeholder="Habit name (e.g. Water plants every friday at 9am)"
                        onkeydown={handleFormKeydown}
                        aria-label="Habit name"
                    />
                    {#if parsed}
                        <span class="recur-hint" title="This will repeat: {parsed.phrase}">
                            <Icon src={LuRepeat} />
                            <span>{describeRecurrence(parsed.schedule)}</span>
                        </span>
                    {/if}
                </div>
                <div class="form-row">
                    <label for="habit-frequency">Repeats</label>
                    <select id="habit-frequency" bind:value={form.frequency}>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                    </select>
                    {#if form.interval > 1 || form.frequency !== 'daily'}
                        <label for="habit-interval" class="inline-label">every</label>
                        <input
                            id="habit-interval"
                            type="number"
                            min="1"
                            max="365"
                            bind:value={form.interval}
                            aria-label="Interval"
                        />
                    {/if}
                </div>
                {#if usesDaysOfWeek}
                    <div class="form-row">
                        <span class="chip-label">On days</span>
                        <div class="day-chips" role="group" aria-label="Days of week">
                            {#each DAY_NAMES as day, i}
                                <button
                                    type="button"
                                    class="day-chip"
                                    class:active={form.daysOfWeek.includes(i)}
                                    onclick={() => toggleDay(i)}
                                    aria-pressed={form.daysOfWeek.includes(i)}
                                >
                                    {day}
                                </button>
                            {/each}
                        </div>
                        {#if form.daysOfWeek.length === 0}
                            <span class="chip-hint">any day</span>
                        {/if}
                    </div>
                {/if}
                {#if form.frequency === 'monthly'}
                    <div class="form-row">
                        <label for="habit-day-of-month">On day of month</label>
                        <input
                            id="habit-day-of-month"
                            type="number"
                            min="1"
                            max="31"
                            bind:value={form.dayOfMonth}
                        />
                    </div>
                {/if}
                <div class="form-row">
                    <label for="habit-start">Start date</label>
                    <input type="date" id="habit-start" bind:value={form.startDate} />
                    <label for="habit-end" class="inline-label">End date</label>
                    <input type="date" id="habit-end" bind:value={form.endDate} />
                </div>
                <div class="form-row">
                    <label for="habit-time">Time</label>
                    <input type="time" id="habit-time" bind:value={form.startTime} />
                    <label class="checkbox-label" for="habit-rollover">
                        <input type="checkbox" id="habit-rollover" bind:checked={form.rolloverEnabled} />
                        Rollover incomplete instances
                    </label>
                </div>
                <div class="form-actions">
                    <button class="btn btn-primary" onclick={saveHabit} disabled={!form.text.trim() || saving}>
                        {saving ? 'Saving...' : (editingHabitId ? 'Save' : 'Create')}
                    </button>
                    <button class="btn btn-secondary" onclick={closeForm}>Cancel</button>
                </div>
            </div>
        {/if}

        {#if recurringTaskStore.tasks.length > 0}
            {#each recurringTaskStore.tasks as habit (habit.id)}
                <div class="habit-card" aria-label="{habit.text}, {describeRecurrence(habit)}">
                    <div class="card-top">
                        <div class="habit-name">
                            {habit.text}
                            <span class="habit-freq">{describeRecurrence(habit)}</span>
                        </div>
                        <div class="card-actions">
                            <button class="icon-btn small" onclick={() => startEdit(habit)} aria-label="Edit habit">
                                <Icon src={LuPencil} />
                            </button>
                            <button class="icon-btn small danger" onclick={() => deleteHabit(habit)} aria-label="Delete habit">
                                <Icon src={LuTrash2} />
                            </button>
                        </div>
                    </div>
                    {#if habit.tags.length > 0}
                        <div class="habit-tags">
                            {#each habit.tags as tag}
                                <span class="tag-chip">#{tag}</span>
                            {/each}
                        </div>
                    {/if}
                    <div class="habit-meta">
                        <span>Starts: {habit.startDate}</span>
                        {#if habit.endDate}
                            <span>Ends: {habit.endDate}</span>
                        {/if}
                        {#if habit.rolloverEnabled}
                            <span>Rollover</span>
                        {/if}
                    </div>
                    <div class="habit-streak">
                        {#if getInstanceCount(habit.id) > 0}
                            <span class="streak-badge" data-testid="habit-streak">
                                <Icon src={LuFlame} />
                                {streakLabel(habit.id)}
                            </span>
                            <span class="meta-stat">{getInstanceCount(habit.id)} instance{getInstanceCount(habit.id) !== 1 ? 's' : ''}</span>
                            {@const stats = recurringTaskStore.stats.get(habit.id)}
                            {#if stats}
                                <span class="meta-stat">best {stats.longestStreak}</span>
                                <span class="meta-stat">{stats.totalCompletions} done</span>
                                {#if stats.lastCompletedDate}
                                    <span class="meta-stat">last {stats.lastCompletedDate}</span>
                                {/if}
                            {/if}
                        {:else}
                            <span class="streak-badge empty">No instances yet</span>
                        {/if}
                    </div>
                </div>
            {/each}
        {:else if !showForm}
            <p class="empty">
                No habits yet. Add a task that ends with a phrase like "every day" or "every
                friday at 9am" -- or create one above.
            </p>
        {/if}
    </div>
</Modal>

<style>
    .habits {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .habit-card {
        padding: 12px;
        background: var(--color-surface-dim);
        border: 1px solid var(--color-border);
        border-radius: 10px;
    }

    .habit-name {
        font-weight: 600;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        min-width: 0;
        flex-wrap: wrap;
    }

    .habit-freq {
        font-size: 11px;
        padding: 1px 8px;
        border-radius: 999px;
        background: var(--color-accent-light);
        color: var(--color-accent);
        font-weight: 600;
        white-space: nowrap;
    }

    .habit-tags {
        display: flex;
        gap: 4px;
        margin-top: 6px;
    }

    .tag-chip {
        font-size: 11px;
        padding: 1px 6px;
        border-radius: 999px;
        background: var(--color-surface-hover);
        color: var(--color-text-secondary);
    }

    .habit-meta {
        font-size: 12px;
        color: var(--color-text-muted);
        margin-top: 6px;
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
    }

    .habit-streak {
        margin-top: 6px;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }

    .meta-stat {
        font-size: 11px;
        color: var(--color-text-muted);
    }

    .streak-badge {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 999px;
        background: var(--color-success-light);
        color: var(--color-success);
        font-weight: 600;
    }

    .streak-badge :global(svg) {
        width: 11px;
        height: 11px;
    }

    .streak-badge.empty {
        background: var(--color-surface-hover);
        color: var(--color-text-muted);
    }

    .day-chips {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
    }

    .day-chip {
        font-size: 11px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid var(--color-border);
        background: var(--color-surface);
        color: var(--color-text-muted);
        cursor: pointer;
        transition: background-color 0.1s, color 0.1s, border-color 0.1s;
    }

    .day-chip:hover {
        background: var(--color-surface-hover);
        color: var(--color-text);
    }

    .day-chip.active {
        background: var(--color-accent);
        border-color: var(--color-accent);
        color: var(--color-on-accent);
    }

    .chip-label {
        font-size: 13px;
        color: var(--color-text-secondary);
    }

    .chip-hint {
        font-size: 11px;
        color: var(--color-text-muted);
        font-style: italic;
    }

    .form-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }

    .name-row {
        flex-wrap: nowrap;
    }

    .form-row label {
        font-size: 13px;
        color: var(--color-text-secondary);
        min-width: 70px;
    }

    .form-row .inline-label {
        min-width: 0;
    }

    .form-row select,
    .form-row input[type='date'],
    .form-row input[type='number'],
    .form-row input[type='time'] {
        padding: 6px 10px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background: var(--color-surface);
        color: var(--color-text);
        font-size: 13px;
        outline: none;
    }

    .form-row select:focus,
    .form-row input:focus {
        border-color: var(--color-accent);
    }

    .form-row input[type='number'],
    .form-row input[type='time'] {
        width: 90px;
    }

    .name-row input[type='text'] {
        flex: 1;
        min-width: 0;
    }

    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: var(--color-text-secondary);
        cursor: pointer;
        min-width: 0 !important;
    }

    .recur-hint {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
        padding: 2px 8px;
        border-radius: 999px;
        background: var(--color-accent-light);
        color: var(--color-accent);
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
        pointer-events: none;
    }

    .recur-hint :global(svg) {
        width: 12px;
        height: 12px;
    }

    .icon-btn :global(svg) {
        width: 16px;
        height: 16px;
    }

    .icon-btn.small :global(svg) {
        width: 14px;
        height: 14px;
    }
</style>
