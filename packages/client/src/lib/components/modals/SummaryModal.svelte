<script lang="ts">
    import Modal from '$lib/components/Modal.svelte';
    import { holidayStore, recurringTaskStore, taskStore } from '$lib/stores';
    import { container } from '$lib/container';
    import {
        findActiveStreaks,
        findOverdueTasks,
        findUpcomingDeadlineTasks,
        findUpcomingHolidays,
    } from '$lib/summary';
    import { onMount } from 'svelte';
    import { i18nStore } from '$lib/i18n/i18nStore.svelte';

    let { onclose = () => {} }: { onclose?: () => void } = $props();

    const todayStr = container.dateProvider.today();

    let allTasks = $derived(taskStore.tasks);
    let todayTasks = $derived(allTasks.filter(t => t.date === todayStr));
    let completedToday = $derived(todayTasks.filter(t => t.completed).length);
    let totalToday = $derived(todayTasks.length);
    let completionPct = $derived(totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0);

    let overdue = $derived(findOverdueTasks(allTasks, todayStr));
    let upcomingDeadlines = $derived(findUpcomingDeadlineTasks(allTasks, todayStr));
    let upcomingHolidays = $derived(findUpcomingHolidays(holidayStore.holidays, todayStr));
    let streaks = $derived(findActiveStreaks(recurringTaskStore.habits, recurringTaskStore.stats));

    // Stats are fetched on demand (the store keys them by habit id);
    // habits first so the id list is complete, then their stats.
    onMount(() => {
        void recurringTaskStore.fetchAll().then(() => {
            void recurringTaskStore.fetchStats(recurringTaskStore.habits.map(h => h.id));
        });
    });

    function daysLateLabel(days: number): string {
        return i18nStore.t('summary.daysLate', { count: days });
    }

    function streakLabel(days: number): string {
        return i18nStore.t('summary.days', { count: days });
    }
</script>

<Modal title={i18nStore.t('modal.summary')} onclose={onclose}>
    <div class="summary" role="region" aria-label={i18nStore.t('summary.regionAria')}>
        <section class="section" aria-labelledby="summary-today-heading">
            <h3 id="summary-today-heading" class="modal-section-heading">{i18nStore.t('summary.today')}</h3>
            <div class="stat-grid">
                <div class="stat">
                    <span class="stat-value">{completionPct}%</span>
                    <span class="stat-label">{i18nStore.t('summary.complete')}</span>
                </div>
                <div class="stat">
                    <span class="stat-value">{completedToday}/{totalToday}</span>
                    <span class="stat-label">{i18nStore.t('summary.tasks')}</span>
                </div>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: {completionPct}%"></div>
            </div>
        </section>

        {#if overdue.length > 0}
            <section class="section" aria-labelledby="summary-overdue-heading">
                <h3 id="summary-overdue-heading" class="modal-section-heading">
                    {i18nStore.t('summary.overdue', { count: overdue.length })}
                </h3>
                <ul class="list">
                    {#each overdue as { task, daysLate } (task.id)}
                        <li class="list-item">
                            <span class="task-text">{task.text}</span>
                            <span class="badge overdue-badge">{daysLateLabel(daysLate)}</span>
                        </li>
                    {/each}
                </ul>
            </section>
        {/if}

        {#if streaks.length > 0}
            <section class="section" aria-labelledby="summary-streaks-heading">
                <h3 id="summary-streaks-heading" class="modal-section-heading">{i18nStore.t('summary.streaks')}</h3>
                <ul class="list">
                    {#each streaks as { habit, currentStreak } (habit.id)}
                        <li class="list-item">
                            <span class="task-text">{habit.text}</span>
                            <span class="badge streak-badge">{streakLabel(currentStreak)}</span>
                        </li>
                    {/each}
                </ul>
            </section>
        {/if}

        {#if upcomingDeadlines.length > 0 || upcomingHolidays.length > 0}
            <section class="section" aria-labelledby="summary-upcoming-heading">
                <h3 id="summary-upcoming-heading" class="modal-section-heading">{i18nStore.t('summary.next')}</h3>
                <ul class="list">
                    {#each upcomingDeadlines as task (task.id)}
                        <li class="list-item">
                            <span class="task-text">{task.text}</span>
                            <span class="badge">{task.date}</span>
                        </li>
                    {/each}
                    {#each upcomingHolidays as holiday (holiday.id)}
                        <li class="list-item">
                            <span class="task-text">{holiday.name}</span>
                            <span class="badge holiday-badge">{holiday.date}</span>
                        </li>
                    {/each}
                </ul>
            </section>
        {/if}
    </div>
</Modal>

<style>
    .summary {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .stat-grid {
        display: flex;
        gap: 24px;
        margin-bottom: 8px;
    }

    .stat {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .stat-value {
        font-size: 28px;
        font-weight: 700;
        color: var(--color-text);
    }

    .stat-label {
        font-size: 12px;
        color: var(--color-text-secondary);
    }

    .progress-bar {
        height: 6px;
        background: var(--color-border);
        border-radius: 3px;
        overflow: hidden;
    }

    .progress-fill {
        height: 100%;
        background: var(--color-success);
        border-radius: 3px;
        transition: width 0.3s ease;
    }

    .list {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .list-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 0;
        border-bottom: 1px solid var(--color-border);
    }

    .task-text {
        font-size: 14px;
    }

    .badge {
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 10px;
        background: var(--color-surface-hover);
        color: var(--color-text-secondary);
    }

    .overdue-badge {
        color: var(--color-danger);
        background: color-mix(in oklab, var(--color-danger) 12%, transparent);
        font-variant-numeric: tabular-nums;
    }

    .streak-badge {
        color: var(--color-success);
        background: color-mix(in oklab, var(--color-success) 12%, transparent);
        font-variant-numeric: tabular-nums;
    }

    .holiday-badge {
        color: var(--color-accent);
        background: color-mix(in oklab, var(--color-accent) 10%, transparent);
        font-variant-numeric: tabular-nums;
    }
</style>