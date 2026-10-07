<script lang="ts">
    import Modal from '$lib/components/Modal.svelte';
    import { preferencesStore } from '$lib/stores';
    import { ACCENT_SCHEMES } from '@erledigen/shared';

    let { onclose = () => {} }: { onclose?: () => void } = $props();

    let themeSelection = $state(preferencesStore.theme);
    let accentSelection = $state(preferencesStore.accent);

    $effect(() => {
        themeSelection = preferencesStore.theme;
        accentSelection = preferencesStore.accent;
    });

    function handleThemeChange(e: Event) {
        const value = (e.target as HTMLSelectElement).value as 'light' | 'dark' | 'system';
        preferencesStore.setTheme(value);
    }

    function handleAccentChange(e: Event) {
        const value = (e.target as HTMLInputElement).value as (typeof ACCENT_SCHEMES)[number]['id'];
        preferencesStore.setAccent(value);
    }

    /** Each swatch shows its own scheme's accent (fixed light-mode values,
     *  like the favicon files -- a swatch cannot ride the active scheme's
     *  CSS tokens). */
    const SWATCH_COLORS: Record<(typeof ACCENT_SCHEMES)[number]['id'], string> = {
        blue: 'oklch(57% 0.1895 260.46)',
        coral: 'oklch(56% 0.181 40)',
        amber: 'oklch(52% 0.128 70)',
    };
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

        <fieldset class="section">
            <legend class="section-heading">Accent</legend>
            <div class="accent-options" role="radiogroup" aria-label="Accent scheme">
                {#each ACCENT_SCHEMES as scheme (scheme.id)}
                    <label class="accent-option">
                        <input
                            type="radio"
                            name="accent-scheme"
                            value={scheme.id}
                            checked={accentSelection === scheme.id}
                            onchange={handleAccentChange}
                        />
                        <span
                            class="swatch"
                            style="background: {SWATCH_COLORS[scheme.id]}"
                            aria-hidden="true"
                        ></span>
                        {scheme.label}
                    </label>
                {/each}
            </div>
            <p class="hint">Accent palettes drawn from the logo's colors.</p>
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

    .accent-options {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .accent-option {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 14px;
        border: 1px solid var(--color-border);
        border-radius: 999px;
        cursor: pointer;
        font-size: 13px;
        color: var(--color-text);
        transition: border-color 0.15s;
    }

    .accent-option:has(input:checked) {
        border-color: var(--color-accent);
        background: var(--color-accent-light);
        font-weight: 600;
    }

    .accent-option input {
        /* The colored swatch is the visual; keep the radio operable but
           out of the layout (a11y: still focusable and checked-announced). */
        position: absolute;
        opacity: 0;
        width: 16px;
        height: 16px;
        margin: 0;
    }

    .accent-option input:focus-visible {
        opacity: 1;
    }

    /* Fixed dots: each swatch always shows ITS scheme's own accent
       (see SWATCH_COLORS in the script) -- readable on both themes'
       surfaces. */
    .swatch {
        width: 16px;
        height: 16px;
        border-radius: 999px;
        border: 1px solid oklch(0% 0 0 / 10%);
    }
</style>