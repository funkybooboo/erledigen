<script lang="ts">
    import Modal from '$lib/components/Modal.svelte';
    import { notificationStore, taskStore } from '$lib/stores';
    import type { Task } from '@erledigen/shared';
    import { PURGE_RETENTION_DAYS } from '@erledigen/shared';
    import { container } from '$lib/container';
    import { i18nStore } from '$lib/i18n/i18nStore.svelte';
    import { onMount } from 'svelte';

    let { onclose = () => {} }: { onclose?: () => void } = $props();

    let deletedTasks = $state<Task[]>([]);
    let loading = $state(true);

    onMount(async () => {
        try {
            deletedTasks = await taskStore.getTrash();
        } catch {
            deletedTasks = [];
            // An error shown as an empty trash list would read as "nothing
            // was ever deleted" -- say what actually happened.
            notificationStore.push(i18nStore.t('trash.loadFailed'), { kind: 'error' });
        } finally {
            loading = false;
        }
    });

    async function handleRestore(id: string) {
        // restoreFromTrash reports failure by returning null (it logs and
        // sets store.error internally), so branch on the result instead of
        // catching -- a silent no-op here left restore looking like a
        // no-op button with no explanation.
        const restored = await taskStore.restoreFromTrash(id);
        if (restored) {
            deletedTasks = deletedTasks.filter(t => t.id !== id);
            notificationStore.push(i18nStore.t('trash.restored'), { kind: 'success' });
        } else {
            notificationStore.push(i18nStore.t('trash.restoreFailed'), { kind: 'error' });
        }
    }

    function daysUntilPurge(deletedAt: string | null): number {
        if (deletedAt === null) return 0;
        const deleted = new Date(deletedAt);
        const now = new Date();
        const diff = PURGE_RETENTION_DAYS - Math.floor((now.getTime() - deleted.getTime()) / (1000 * 60 * 60 * 24));
        return Math.max(0, diff);
    }

    function formatDate(dateStr: string | null): string {
        if (!dateStr) return i18nStore.t('trash.someday');
        // Stored date keys format through the provider (UTC-anchored
        // label), not local Date parsing.
        return container.dateProvider.formatDate(dateStr, 'short');
    }
</script>

<Modal title={i18nStore.t('modal.trash')} onclose={onclose}>
    <div class="trash">
        {#if loading}
            <p class="hint">{i18nStore.t('trash.loading')}</p>
        {:else if deletedTasks.length === 0}
            <p class="empty">{i18nStore.t('trash.empty')}</p>
            <p class="hint">{i18nStore.t('trash.purgeHint', { days: PURGE_RETENTION_DAYS })}</p>
        {:else}
            <ul class="list">
                {#each deletedTasks as task (task.id)}
                    <li class="list-item">
                        <div class="task-info">
                            <span class="task-text">{task.text}</span>
                            <span class="task-date">{formatDate(task.date)}</span>
                        </div>
                        <span class="days-left">{i18nStore.t('trash.daysLeft', { count: daysUntilPurge(task.deletedAt) })}</span>
                        <button class="restore-btn" onclick={() => handleRestore(task.id)} aria-label={i18nStore.t('trash.restoreAria')}>
                            {i18nStore.t('trash.restore')}
                        </button>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
</Modal>

<style>
    .trash {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .list {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .list-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 0;
        border-bottom: 1px solid var(--color-border);
    }

    .task-text {
        font-size: 14px;
        color: var(--color-text-secondary);
        text-decoration: line-through;
    }

    .task-date {
        font-size: 11px;
        color: var(--color-text-secondary);
    }

    .task-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }

    .days-left {
        font-size: 11px;
        color: var(--color-text-secondary);
    }

    .restore-btn {
        background: none;
        border: 1px solid var(--color-accent);
        border-radius: 4px;
        color: var(--color-accent);
        padding: 4px 10px;
        font-size: 12px;
        cursor: pointer;
        transition: background-color 0.15s;
    }

    .restore-btn:hover {
        background: var(--color-accent-light);
    }

    .empty {
        font-size: 14px;
        color: var(--color-text-secondary);
        text-align: center;
    }

    .hint {
        font-size: 12px;
        color: var(--color-text-secondary);
        text-align: center;
    }
</style>