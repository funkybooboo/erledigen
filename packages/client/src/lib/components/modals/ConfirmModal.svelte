<script lang="ts">
    import Modal from '$lib/components/Modal.svelte';
    import { uiStore } from '$lib/stores';

    /**
     * Non-blocking confirmation for destructive actions (the replacement
     * for window.confirm). The pending request lives in uiStore
     * (uiStore.confirm returns a Promise); Cancel, the X button, the
     * backdrop, and Escape all resolve false through Modal's onclose.
     */
    let {
        message = 'Are you sure?',
        confirmLabel = 'Delete',
    }: { message?: string; confirmLabel?: string } = $props();

    function answer(ok: boolean): void {
        uiStore.resolveConfirm(ok);
    }
</script>

<Modal title="Confirm" onclose={() => answer(false)}>
    <p class="confirm-message">{message}</p>
    <div class="confirm-actions">
        <button class="btn btn-secondary" onclick={() => answer(false)}>Cancel</button>
        <button class="btn btn-danger" onclick={() => answer(true)}>{confirmLabel}</button>
    </div>
</Modal>

<style>
    .confirm-message {
        margin: 4px 0 16px;
        color: var(--color-text);
        font-size: 14px;
    }

    .confirm-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
    }

    .btn-danger {
        background: var(--color-danger);
        color: var(--color-on-accent);
    }

    /* --color-danger is theme-aware, so one neutral hover works in both. */
    .btn-danger:hover {
        filter: brightness(1.1);
    }
</style>