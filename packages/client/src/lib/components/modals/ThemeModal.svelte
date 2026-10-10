<script lang="ts">
    import Modal from '$lib/components/Modal.svelte';
    import { preferencesStore } from '$lib/stores';
    import {
        ACCENT_SCHEMES,
        type CompletionAnimation,
        type FontSize,
        type RowDensity,
    } from '@erledigen/shared';
    import { i18nStore } from '$lib/i18n/i18nStore.svelte';
    import type { TranslationKey } from '$lib/i18n/locales';

    /** Locale key per accent id (compile-checked against en.json). */
    const ACCENT_LABEL_KEYS: Record<(typeof ACCENT_SCHEMES)[number]['id'], TranslationKey> = {
        blue: 'theme.accentColors.blue',
        coral: 'theme.accentColors.coral',
        amber: 'theme.accentColors.amber',
    };
    const FONT_SIZE_KEYS: Record<FontSize, TranslationKey> = {
        small: 'theme.fontSize.small',
        medium: 'theme.fontSize.medium',
        large: 'theme.fontSize.large',
    };
    const DENSITY_KEYS: Record<RowDensity, TranslationKey> = {
        compact: 'theme.density.compact',
        comfortable: 'theme.density.comfortable',
    };
    /** The completion-flash choices (value + its label key). */
    const COMPLETION_OPTIONS: [CompletionAnimation, TranslationKey][] = [
        ['flash', 'theme.on'],
        ['none', 'theme.off'],
    ];
    const FONT_SIZE_OPTIONS: readonly FontSize[] = ['small', 'medium', 'large'];
    const DENSITY_OPTIONS: readonly RowDensity[] = ['compact', 'comfortable'];

    let { onclose = () => {} }: { onclose?: () => void } = $props();

    let themeSelection = $state(preferencesStore.theme);
    let accentSelection = $state(preferencesStore.accent);
    let fontSizeSelection = $state(preferencesStore.fontSize);
    let rowDensitySelection = $state(preferencesStore.rowDensity);
    let completionAnimationSelection = $state(preferencesStore.completionAnimation);

    $effect(() => {
        themeSelection = preferencesStore.theme;
        accentSelection = preferencesStore.accent;
        fontSizeSelection = preferencesStore.fontSize;
        rowDensitySelection = preferencesStore.rowDensity;
        completionAnimationSelection = preferencesStore.completionAnimation;
    });

    function handleThemeChange(e: Event) {
        const value = (e.target as HTMLSelectElement).value as 'light' | 'dark' | 'system';
        preferencesStore.setTheme(value);
    }

    function handleAccentChange(e: Event) {
        const value = (e.target as HTMLInputElement).value as (typeof ACCENT_SCHEMES)[number]['id'];
        preferencesStore.setAccent(value);
    }

    function handleFontSizeChange(e: Event) {
        preferencesStore.setFontSize((e.target as HTMLInputElement).value as FontSize);
    }

    function handleRowDensityChange(e: Event) {
        preferencesStore.setRowDensity((e.target as HTMLInputElement).value as RowDensity);
    }

    function handleCompletionAnimationChange(e: Event) {
        preferencesStore.setCompletionAnimation(
            (e.target as HTMLInputElement).value as CompletionAnimation,
        );
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

<Modal title={i18nStore.t('modal.theme')} onclose={onclose}>
    <div class="theme">
        <fieldset class="section">
            <legend class="section-heading">{i18nStore.t('theme.colorScheme')}</legend>
            <label class="field">
                <span class="label" id="theme-label">{i18nStore.t('theme.theme')}</span>
                <select
                    class="select"
                    value={themeSelection}
                    onchange={handleThemeChange}
                    aria-labelledby="theme-label"
                    id="theme-select"
                >
                    <option value="system">{i18nStore.t('theme.themeSystem')}</option>
                    <option value="light">{i18nStore.t('theme.themeLight')}</option>
                    <option value="dark">{i18nStore.t('theme.themeDark')}</option>
                </select>
            </label>
<p class="hint">{i18nStore.t('theme.themeHint')}</p>
        </fieldset>

        <fieldset class="section">
            <legend class="section-heading">{i18nStore.t('theme.accent')}</legend>
            <div class="accent-options" role="radiogroup" aria-label={i18nStore.t('theme.accentAria')}>
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
                        {i18nStore.t(ACCENT_LABEL_KEYS[scheme.id])}
                    </label>
                {/each}
            </div>
            <p class="hint">{i18nStore.t('theme.accentHint')}</p>
        </fieldset>

        <fieldset class="section">
            <legend class="section-heading">{i18nStore.t('theme.size')}</legend>
            <div class="field">
                <span class="label" id="font-size-label">{i18nStore.t('theme.text')}</span>
                <div class="accent-options" role="radiogroup" aria-labelledby="font-size-label">
                    {#each FONT_SIZE_OPTIONS as size (size)}
                        <label class="accent-option">
                            <input
                                type="radio"
                                name="font-size"
                                value={size}
                                checked={fontSizeSelection === size}
                                onchange={handleFontSizeChange}
                            />
                            {i18nStore.t(FONT_SIZE_KEYS[size])}
                        </label>
                    {/each}
                </div>
            </div>
            <div class="field">
                <span class="label" id="row-density-label">{i18nStore.t('theme.rows')}</span>
                <div class="accent-options" role="radiogroup" aria-labelledby="row-density-label">
                    {#each DENSITY_OPTIONS as density (density)}
                        <label class="accent-option">
                            <input
                                type="radio"
                                name="row-density"
                                value={density}
                                checked={rowDensitySelection === density}
                                onchange={handleRowDensityChange}
                            />
                            {i18nStore.t(DENSITY_KEYS[density])}
                        </label>
                    {/each}
                </div>
            </div>
            <p class="hint">{i18nStore.t('theme.sizeHint')}</p>
        </fieldset>

        <fieldset class="section">
            <legend class="section-heading">{i18nStore.t('theme.motion')}</legend>
            <div class="field">
                <span class="label" id="completion-label">{i18nStore.t('theme.completionFlash')}</span>
                <div
                    class="accent-options"
                    role="radiogroup"
                    aria-labelledby="completion-label"
                >
                    {#each COMPLETION_OPTIONS as [value, labelKey] (value)}
                        <label class="accent-option">
                            <input
                                type="radio"
                                name="completion-animation"
                                value={value}
                                checked={completionAnimationSelection === value}
                                onchange={handleCompletionAnimationChange}
                            />
                            {i18nStore.t(labelKey)}
                        </label>
                    {/each}
                </div>
            </div>
<p class="hint">{i18nStore.t('theme.motionHint')}</p>
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
        color: var(--color-text-secondary);
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