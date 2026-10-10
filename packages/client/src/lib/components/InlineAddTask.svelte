<script lang="ts">
    import { tick } from 'svelte';
    import { notificationStore } from '$lib/stores';
    import { TASK_CONSTRAINTS, parseRecurrence } from '@erledigen/shared';
    import { createFromText } from '$lib/createFromText';
    import RecurrenceHint from './RecurrenceHint.svelte';
    import { Icon } from 'svelte-icons-pack';
    import { LuCircle } from 'svelte-icons-pack/lu';
    import { tooltip } from '$lib/tooltip';
    import { i18nStore } from '$lib/i18n/i18nStore.svelte';
    import { describeRecurrence } from '@erledigen/shared';
    import { recurrencePhrases } from '$lib/i18n/recurrencePhrases';

    let {
        date,
        someDayGroupId = null,
        oncreated,
    }: { date: string; someDayGroupId?: string | null; oncreated?: (id: string) => void } = $props();

    let text = $state('');
    let inputEl: HTMLInputElement;

    /** Focus this input from outside -- the global add-task binding (n/a)
     *  routes here through uiStore.requestAddInputFocus instead of reaching
     *  into section DOM from the layout. */
    export function focusInput(): void {
        inputEl?.focus();
    }

    // Live TeuxDeux-style detection: a trailing recurrence phrase turns the
    // input into a habit. Parsed reactively so the hint updates as you type.
    let parsed = $derived(text.trim() ? parseRecurrence(text.trim()) : null);

    async function handleSubmit() {
        // Capture the text before awaiting: `text = ''` below would otherwise
        // re-derive `parsed` to null while suspended.
        const value = text.trim();
        if (!value) return;

        const result = await createFromText(value, { date, someDayGroupId });
        if (!result) {
            // Creation failed (network/server). The text is kept so the
            // user can retry; the toast says what happened.
            notificationStore.push(i18nStore.t('inlineAddTask.createFailed'), { kind: 'error' });
            return;
        }
        text = '';

        if (result.kind === 'habit') {
            notificationStore.push(
                i18nStore.t('inlineAddTask.habitCreated', {
                    schedule: describeRecurrence(result.schedule, recurrencePhrases()),
                }),
                {
                    kind: 'success',
                },
            );
            // Flash the instance on this day, matching the plain-task path.
            const instanceHere = result.tasks.find(t => t.date === date);
            if (instanceHere && oncreated) oncreated(instanceHere.id);
        } else if (oncreated) {
            oncreated(result.task.id);
        }

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
    <span class="add-checkbox"><Icon src={LuCircle} /></span>
    <input
        bind:this={inputEl}
        bind:value={text}
        class="add-input"
        placeholder={i18nStore.t('inlineAddTask.placeholder')}
        onkeydown={handleKeydown}
        use:tooltip={{ label: i18nStore.t('inlineAddTask.tooltip'), shortcut: 'addTask' }}
        maxlength={TASK_CONSTRAINTS.MAX_TEXT_LENGTH}
        aria-label={i18nStore.t('inlineAddTask.ariaLabel')}
    />
    <span class="add-actions-spacer" aria-hidden="true"></span>
    {#if parsed}
        <RecurrenceHint {parsed} />
    {/if}
</div>

<style>
    .add-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: var(--row-pad-y) 4px;
        min-height: var(--row-min-h);
        border-radius: 4px;
        transition: background-color 0.1s;
    }

    .add-row:hover {
        background: var(--color-surface-hover);
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
        font-size: var(--fs-body);
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
</style>