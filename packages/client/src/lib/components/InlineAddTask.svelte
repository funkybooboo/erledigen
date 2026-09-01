<script lang="ts">
    import { tick } from 'svelte';
    import {
        GENERATE_HORIZON_DAYS,
        notificationStore,
        recurringTaskStore,
        taskStore,
    } from '$lib/stores';
    import {
        TASK_CONSTRAINTS,
        describeRecurrence,
        parseRecurrence,
    } from '@erledigen/shared';
    import { container } from '$lib/container';
    import { Icon } from 'svelte-icons-pack';
    import { LuCircle, LuRepeat } from 'svelte-icons-pack/lu';
    import { tooltip } from '$lib/tooltip';

    let {
        date,
        someDayGroupId = null,
        oncreated,
    }: { date: string; someDayGroupId?: string | null; oncreated?: (id: string) => void } = $props();

    let text = $state('');
    let inputEl: HTMLInputElement;

    // Live TeuxDeux-style detection: a trailing recurrence phrase turns the
    // input into a habit. Parsed reactively so the hint updates as you type.
    let parsed = $derived(text.trim() ? parseRecurrence(text.trim()) : null);

    function horizonEnd(from: string): string {
        const d = new Date(`${from}T00:00:00`);
        d.setDate(d.getDate() + GENERATE_HORIZON_DAYS);
        return d.toISOString().split('T')[0] ?? from;
    }

    async function submitHabit(): Promise<boolean> {
        if (!parsed) return false;

        // Capture before any await: `text` is cleared below, which would
        // re-derive `parsed` to null while this function is suspended.
        const { cleanText, schedule } = parsed;

        const startDate = date || container.dateProvider.today();
        const result = await recurringTaskStore.createAndGenerate(
            {
                text: cleanText,
                frequency: schedule.frequency,
                interval: schedule.interval,
                dayOfWeek: schedule.dayOfWeek,
                dayOfMonth: schedule.dayOfMonth,
                startTime: schedule.startTime,
                startDate,
            },
            horizonEnd(startDate),
        );
        text = '';

        if (result) {
            taskStore.ingest(result.tasks);
            notificationStore.push(`Habit created — ${describeRecurrence(schedule)}`, {
                kind: 'success',
            });
            // Flash the instance on this day, matching the plain-task path.
            const instanceHere = result.tasks.find(t => t.date === date);
            if (instanceHere && oncreated) oncreated(instanceHere.id);
        }
        return true;
    }

    async function handleSubmit() {
        if (!text.trim()) return;
        if (await submitHabit()) {
            await tick();
            inputEl?.focus();
            return;
        }
        const input: Record<string, unknown> = {
            text: text.trim(),
            date: date || null,
        };
        if (someDayGroupId) input.someDayGroupId = someDayGroupId;
        text = '';
        const task = await taskStore.create(input as Parameters<typeof taskStore.create>[0]);
        if (task && oncreated) oncreated(task.id);
        await tick();
        inputEl?.focus();
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            text = '';
            inputEl?.blur();
        }
    }
</script>

<div class="add-row">
    <span class="drag-spacer" aria-hidden="true"></span>
    <span class="add-checkbox"><Icon src={LuCircle} /></span>
    <input
        bind:this={inputEl}
        bind:value={text}
        class="add-input"
        placeholder="Add a task..."
        onkeydown={handleKeydown}
        use:tooltip={{ label: 'New task — Enter to add, Esc to cancel', shortcut: 'addTask' }}
        maxlength={TASK_CONSTRAINTS.MAX_TEXT_LENGTH}
        aria-label="New task text"
    />
    <span class="add-actions-spacer" aria-hidden="true"></span>
    {#if parsed}
        <span class="recur-hint" title="This will repeat: {parsed.phrase}">
            <Icon src={LuRepeat} />
            <span>{describeRecurrence(parsed.schedule)}</span>
        </span>
    {/if}
</div>

<style>
    .add-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 4px;
        min-height: 36px;
        border-radius: 4px;
        transition: background-color 0.1s;
    }

    .add-row:hover {
        background: var(--color-surface-hover);
    }

    .drag-spacer {
        color: var(--color-text-muted);
        font-size: 12px;
        opacity: 0;
        user-select: none;
        width: 12px;
        text-align: center;
        flex-shrink: 0;
    }

    .add-checkbox {
        flex-shrink: 0;
        color: var(--color-text-muted);
        padding: 2px;
        line-height: 1;
    }

    .add-checkbox :global(svg) {
        width: 16px;
        height: 16px;
    }

    .add-input {
        flex: 1;
        font-size: 14px;
        padding: 2px 4px;
        border: 1px solid transparent;
        border-radius: 4px;
        outline: none;
        background: transparent;
        color: var(--color-text);
        transition: border-color 0.15s, background-color 0.15s;
        min-width: 0;
    }

    .add-input::placeholder {
        color: var(--color-text-muted);
        opacity: 0.6;
    }

    .add-input:focus {
        border-color: var(--color-border-focus);
        background: var(--color-surface);
    }

    .add-actions-spacer {
        flex-shrink: 0;
        width: 36px;
    }

    .recur-hint {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
        margin-left: 8px;
        padding: 1px 8px;
        border-radius: 999px;
        background: var(--color-accent-light);
        color: var(--color-accent);
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
        pointer-events: none;
        animation: hint-in 150ms ease-out;
    }

    .recur-hint :global(svg) {
        width: 12px;
        height: 12px;
    }

    @keyframes hint-in {
        from {
            opacity: 0;
            transform: scale(0.9);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
</style>