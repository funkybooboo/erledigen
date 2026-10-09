<script lang="ts">
    import Modal from '$lib/components/Modal.svelte';
    import { uiStore } from '$lib/stores';
    import { i18nStore } from '$lib/i18n/i18nStore.svelte';

    /**
     * Non-blocking confirmation for destructive actions (the replacement
     * for window.confirm). The pending request lives in uiStore
     * (uiStore.confirm returns a Promise); Cancel, the X button, the
     * backdrop, and Escape all resolve false through Modal's onclose.
     *
     * Both props arrive already localized by the caller (the message) or
     * fall back to the locale file here (the button labels -- uiStore's
     * confirm() takes no label unless a caller needs a specific verb).
     */
    let {
        message,
        confirmLabel,
    }: { message?: string; confirmLabel?: string } = $props();

    let resolvedMessage = $derived(message ?? i18nStore.t('common.confirmMessage'));
    let resolvedConfirmLabel = $derived(confirmLabel ?? i18nStore.t('common.delete'));

    function answer(ok: boolean): void {
        uiStore.resolveConfirm(ok);
    }
</script>

<Modal title={i18nStore.t('common.confirm')} onclose={() => answer(false)}>
    <p class="confirm-message">{resolvedMessage}</p>
    <div class="confirm-actions">
        <button class="btn btn-secondary" onclick={() => answer(false)}>{i18nStore.t('common.cancel')}</button>
        <button class="btn btn-danger" onclick={() => answer(true)}>{resolvedConfirmLabel}</button>
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