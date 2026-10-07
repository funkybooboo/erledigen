<script lang="ts">
    import Modal from '$lib/components/Modal.svelte';
    import { preferencesStore } from '$lib/stores';

    let { onclose = () => {} }: { onclose?: () => void } = $props();

    let themeSelection = $state(preferencesStore.theme);

    $effect(() => {
        themeSelection = preferencesStore.theme;
    });

    function handleThemeChange(e: Event) {
        const value = (e.target as HTMLSelectElement).value as 'light' | 'dark' | 'system';
        preferencesStore.setTheme(value);
    }
</script>

<Modal title="Theme" onclose={onclose}>
    <div class="theme">
        <fieldset class="section">
            <legend class="section-heading">Color scheme</legend>
            <label class="field">
                <span class="label" id="theme-label">Theme</span>
                <select
                    class="select"
                    value={themeSelection}
                    onchange={handleThemeChange}
                    aria-labelledby="theme-label"
                    id="theme-select"
                >
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                </select>
            </label>
            <p class="hint">
                System follows your device's light/dark setting. The choice
                syncs to every open window and persists with your settings.
            </p>
        </fieldset>
    </div>
</Modal>

<style>
    .theme {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    fieldset.section {
        border: none;
        padding: 0;
        margin: 0;
    }

    .section-heading {
        font-size: 13px;
        font-weight: 600;
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0 0 12px;
    }

    .field {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    .label {
        font-size: 14px;
        color: var(--color-text);
    }

    .select {
        padding: 6px 12px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-surface-dim);
        color: var(--color-text);
        font-size: 14px;
    }

    .select:focus {
        outline: 2px solid var(--color-accent);
        outline-offset: 2px;
    }

    .hint {
        font-size: 13px;
        color: var(--color-text-muted);
        margin: 8px 0 0;
    }
</style>