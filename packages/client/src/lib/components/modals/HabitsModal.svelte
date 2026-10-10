<script lang="ts">
    import Modal from '$lib/components/Modal.svelte';
    import HabitHeatmap from '$lib/components/HabitHeatmap.svelte';
    import RecurrenceHint from '$lib/components/RecurrenceHint.svelte';
    import HabitScheduleForm from '$lib/components/HabitScheduleForm.svelte';
    import {
        GENERATE_HORIZON_DAYS,
        notificationStore,
        recurringTaskStore,
        taskStore,
        preferencesStore,
        uiStore,
    } from '$lib/stores';
    import { Icon } from 'svelte-icons-pack';
    import {
        LuArrowLeft,
        LuFlame,
        LuPencil,
        LuPlus,
        LuTrash2,
    } from 'svelte-icons-pack/lu';
    import {
        addDays,
        describeRecurrence,
        parseRecurrence,
        type RecurringFrequency,
        type RecurringTask,
    } from '@erledigen/shared';
    import { container } from '$lib/container';
    import { i18nStore } from '$lib/i18n/i18nStore.svelte';
    import { recurrencePhrases } from '$lib/i18n/recurrencePhrases';
    import { onMount } from 'svelte';

    /** Localized recurrence descriptions (schedule sentences from the
     *  locale file, weekday names via Intl). */
    function describe(habit: RecurringTask): string {
        return describeRecurrence(
            {
                frequency: habit.frequency,
                interval: habit.interval,
                daysOfWeek: habit.daysOfWeek,
                dayOfMonth: habit.dayOfMonth,
                startTime: habit.startTime,
            },
            recurrencePhrases(),
        );
    }

    let { onclose = () => {} }: { onclose?: () => void } = $props();

    onMount(() => {
        recurringTaskStore.fetchAll().then(() => {
            recurringTaskStore.fetchStats(recurringTaskStore.habits.map(h => h.id));
        });
    });

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
        closeDetail();
        form = emptyForm();
        editingHabitId = null;
        showForm = true;
    }

    function startEdit(habit: RecurringTask) {
        closeDetail();
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
        // Pure key math: a local-midnight Date read back through
        // toISOString() lands the horizon a day early in positive UTC
        // offsets (see shared utils/dateKeys).
        return addDays(container.dateProvider.today(), GENERATE_HORIZON_DAYS);
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
        if (!result) {
            // The form stays open with its contents; say why (USE-12:
            // errors are announced, not just silently dropped).
            notificationStore.push(i18nStore.t('habits.saveFailed'), { kind: 'error' });
            return;
        }

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
            if (!(await uiStore.confirm(i18nStore.t('habits.deleteConfirm', { name: habit.text })))) return;
        }
        await recurringTaskStore.remove(habit.id);
        // If the deleted habit is open in the detail view, fall back to
        // the list (the derived selectedHabit already went null).
        if (habit.id === selectedHabitId) closeDetail();
        notificationStore.push(i18nStore.t('habits.deleted'), {
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

    // ------------------------------------------------------------------
    // Habit detail: clicking a habit's name swaps the list for a
    // read-only detail view (stats bar + heatmap). Editing and deleting
    // stay on the list rows.
    // ------------------------------------------------------------------

    let selectedHabitId = $state<string | null>(null);

    const selectedHabit = $derived(
        selectedHabitId === null
            ? null
            : (recurringTaskStore.habits.find(h => h.id === selectedHabitId) ?? null),
    );

    function openDetail(habit: RecurringTask): void {
        closeForm();
        selectedHabitId = habit.id;
        // Refresh this habit's stats so the heatmap history is current.
        void recurringTaskStore.fetchStats([habit.id]);
    }

    function closeDetail(): void {
        selectedHabitId = null;
    }

    /** Stats for the habit being viewed, once loaded. */
    const selectedStats = $derived(
        selectedHabitId === null
            ? null
            : (recurringTaskStore.stats.get(selectedHabitId) ?? null),
    );
</script>

<Modal title={i18nStore.t('modal.habits')} onclose={onclose}>
    <div class="habits">
        <div class="list-header">
            <h3>{i18nStore.t('habits.recurringTasks')}</h3>
            <button class="icon-btn" onclick={startNew} aria-label={i18nStore.t('habits.new')}>
                <Icon src={LuPlus} />
            </button>
        </div>

        {#if selectedHabit === null}
        {#if showForm}
            <div class="inline-form">
                <div class="form-row name-row">
                    <input
                        type="text"
                        bind:value={form.text}
                        placeholder={i18nStore.t('habits.namePlaceholder')}
                        onkeydown={handleFormKeydown}
                        aria-label={i18nStore.t('habits.nameAria')}
                    />
                    {#if parsed}
                        <RecurrenceHint {parsed} />
                    {/if}
                </div>
                <HabitScheduleForm
                    bind:frequency={form.frequency}
                    bind:interval={form.interval}
                    bind:daysOfWeek={form.daysOfWeek}
                    bind:dayOfMonth={form.dayOfMonth}
                    bind:startTime={form.startTime}
                />
                <div class="form-row">
                    <label for="habit-start">{i18nStore.t('habits.startDate')}</label>
                    <input type="date" id="habit-start" bind:value={form.startDate} />
                    <label for="habit-end" class="inline-label">{i18nStore.t('habits.endDate')}</label>
                    <input type="date" id="habit-end" bind:value={form.endDate} />
                </div>
                <div class="form-row">
                    <label class="checkbox-label" for="habit-rollover">
                        <input type="checkbox" id="habit-rollover" bind:checked={form.rolloverEnabled} />
                        {i18nStore.t('habits.rolloverInstances')}
                    </label>
                </div>
                <div class="form-actions">
                    <button class="btn btn-primary" onclick={saveHabit} disabled={!form.text.trim() || saving}>
                        {saving ? i18nStore.t('habits.saving') : (editingHabitId ? i18nStore.t('habits.save') : i18nStore.t('habits.create'))}
                    </button>
                    <button class="btn btn-secondary" onclick={closeForm}>{i18nStore.t('common.cancel')}</button>
                </div>
            </div>
        {/if}

        {#if recurringTaskStore.habits.length > 0}
            {#each recurringTaskStore.habits as habit (habit.id)}
                <div class="habit-card" aria-label={i18nStore.t('habits.cardAria', { name: habit.text, schedule: describe(habit) })}>
                    <div class="card-top">
                        <button
                            class="habit-name"
                            onclick={() => openDetail(habit)}
                            aria-label={i18nStore.t('habits.viewDetail', { name: habit.text })}
                        >
                            {habit.text}
                            <span class="habit-freq">{describe(habit)}</span>
                        </button>
                        <div class="card-actions">
                            <button class="icon-btn small" onclick={() => startEdit(habit)} aria-label={i18nStore.t('habits.edit')}>
                                <Icon src={LuPencil} />
                            </button>
                            <button class="icon-btn small danger" onclick={() => deleteHabit(habit)} aria-label={i18nStore.t('habits.delete')}>
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
                        <span>{i18nStore.t('habits.starts', { date: habit.startDate })}</span>
                        {#if habit.endDate}
                            <span>{i18nStore.t('habits.ends', { date: habit.endDate })}</span>
                        {/if}
                        {#if habit.rolloverEnabled}
                            <span>{i18nStore.t('habits.rollover')}</span>
                        {/if}
                    </div>
                    <div class="habit-streak">
                        {#if getInstanceCount(habit.id) > 0}
                            <span class="streak-badge" data-testid="habit-streak">
                                <Icon src={LuFlame} />
                                {streakLabel(habit.id)}
                            </span>
                            <span class="meta-stat">{i18nStore.t('habits.instances', { count: getInstanceCount(habit.id) })}</span>
                            {@const stats = recurringTaskStore.stats.get(habit.id)}
                            {#if stats}
                                <span class="meta-stat">{i18nStore.t('habits.best', { count: stats.longestStreak })}</span>
                                <span class="meta-stat">{i18nStore.t('habits.doneCount', { count: stats.totalCompletions })}</span>
                                {#if stats.lastCompletedDate}
                                    <span class="meta-stat">{i18nStore.t('habits.lastDone', { date: stats.lastCompletedDate })}</span>
                                {/if}
                            {/if}
                        {:else}
                            <span class="streak-badge empty">{i18nStore.t('habits.noInstances')}</span>
                        {/if}
                    </div>
                </div>
            {/each}
        {:else if !showForm}
            <p class="empty">{i18nStore.t('habits.empty')}</p>
        {/if}
        {:else if selectedHabit}
            <div class="habit-detail" data-testid="habit-detail">
                <div class="detail-top">
                    <button
                        class="icon-btn small"
                        onclick={closeDetail}
                        aria-label={i18nStore.t('habits.backToList')}
                    >
                        <Icon src={LuArrowLeft} />
                    </button>
                    <span class="detail-title">{selectedHabit.text}</span>
                    <span class="habit-freq">{describe(selectedHabit)}</span>
                </div>

                <div class="detail-stats">
                    <span class="streak-badge" data-testid="habit-streak">
                        <Icon src={LuFlame} />
                        {streakLabel(selectedHabit.id)}
                    </span>
                    {#if selectedStats}
                        <span class="meta-stat">{i18nStore.t('habits.best', { count: selectedStats.longestStreak })}</span>
                        <span class="meta-stat">{i18nStore.t('habits.doneCount', { count: selectedStats.totalCompletions })}</span>
                        {#if selectedStats.lastCompletedDate}
                            <span class="meta-stat">{i18nStore.t('habits.lastDone', { date: selectedStats.lastCompletedDate })}</span>
                        {/if}
                    {/if}
                </div>

                {#if selectedStats}
                    <HabitHeatmap
                        completedDates={selectedStats.completedDates}
                        today={container.dateProvider.today()}
                    />
                {:else}
                    <p class="empty">{i18nStore.t('habits.loadingStats')}</p>
                {/if}
            </div>
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
        background: none;
        border: none;
        padding: 0;
        color: inherit;
        font: inherit;
        text-align: start;
        cursor: pointer;
    }

    .habit-name:hover {
        color: var(--color-accent);
    }

    .habit-detail {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .detail-top {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }

    .detail-title {
        font-weight: 600;
        font-size: 14px;
    }

    .detail-stats {
        display: flex;
        align-items: center;
        gap: 8px;
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
        color: var(--color-text-secondary);
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
        color: var(--color-text-secondary);
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
        color: var(--color-text-secondary);
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

    .form-row input[type='date'] {
        padding: 6px 10px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background: var(--color-surface);
        color: var(--color-text);
        font-size: 13px;
        outline: none;
    }

    .form-row input:focus {
        border-color: var(--color-accent);
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

    .icon-btn :global(svg) {
        width: 16px;
        height: 16px;
    }

    .icon-btn.small :global(svg) {
        width: 14px;
        height: 14px;
    }
</style>
