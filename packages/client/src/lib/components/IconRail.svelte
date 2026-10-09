<script lang="ts">
    import { uiStore, type ModalType } from '$lib/stores';
    import { Icon } from 'svelte-icons-pack';
    import {
        LuCalendar,
        LuBarChart3,
        LuRepeat,
        LuSearch,
        LuStickyNote,
        LuTag,
        LuTrash2,
        LuPalette,
        LuSettings,
        LuCircleHelp,
        LuList,
    } from 'svelte-icons-pack/lu';
    import { tooltip } from '$lib/tooltip';
    import { i18nStore } from '$lib/i18n/i18nStore.svelte';
    import type { TranslationKey } from '$lib/i18n/locales';
    import type { ShortcutId } from '$lib/keybindings';

    const icons: { id: ModalType; icon: typeof LuCalendar; key: TranslationKey; shortcut: ShortcutId }[] = [
        { id: 'summary', icon: LuList, key: 'rail.summary', shortcut: 'openSummary' },
        { id: 'projects', icon: LuBarChart3, key: 'rail.projects', shortcut: 'openProjects' },
        { id: 'habits', icon: LuRepeat, key: 'rail.habits', shortcut: 'openHabits' },
        { id: 'calendar', icon: LuCalendar, key: 'rail.calendar', shortcut: 'openCalendar' },
        { id: 'search', icon: LuSearch, key: 'rail.search', shortcut: 'search' },
        { id: 'notes', icon: LuStickyNote, key: 'rail.notes', shortcut: 'openNotes' },
        { id: 'filter', icon: LuTag, key: 'rail.filter', shortcut: 'openFilter' },
        { id: 'trash', icon: LuTrash2, key: 'rail.trash', shortcut: 'openTrash' },
        { id: 'theme', icon: LuPalette, key: 'rail.theme', shortcut: 'openTheme' },
        { id: 'settings', icon: LuSettings, key: 'rail.settings', shortcut: 'openSettings' },
        { id: 'help', icon: LuCircleHelp, key: 'rail.help', shortcut: 'help' },
    ];

    function handleIconClick(id: ModalType) {
        if (uiStore.activeModal === id) {
            uiStore.closeModal();
        } else {
            uiStore.openModal(id);
        }
    }
</script>

<nav class="icon-rail" aria-label={i18nStore.t('app.navigation')}>
    {#each icons as item}
        <button
            class="icon-btn"
            class:active={uiStore.activeModal === item.id}
            onclick={() => handleIconClick(item.id)}
            use:tooltip={item.shortcut}
            aria-label={i18nStore.t(item.key)}
        >
            <span class="icon"><Icon src={item.icon} /></span>
            <span class="label">{i18nStore.t(item.key)}</span>
        </button>
    {/each}
</nav>

<style>
    .icon-rail {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        width: 64px;
        min-width: 64px;
        background: var(--color-surface);
        border-right: 1px solid var(--color-border);
        padding: 8px 0;
        gap: 4px;
        overflow-y: auto;
    }

    .icon-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        width: 100%;
        box-sizing: border-box;
        min-height: 56px;
        padding: 8px 4px;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: 6px;
        transition: background-color 0.15s;
        color: var(--color-text-secondary);
        text-align: center;
        border-radius: 999px;
    }

    .icon-btn:hover {
        background: var(--color-surface-hover);
        color: var(--color-text);
    }

    .icon-btn.active {
        background: var(--color-accent-light);
        color: var(--color-accent);
        font-weight: 600;
    }

    .icon :global(svg) {
        width: 22px;
        height: 22px;
        flex-shrink: 0;
    }

    .label {
        font-size: 10px;
        font-weight: 500;
        line-height: 1.2;
        white-space: nowrap;
    }

    .icon-btn:focus-visible {
        outline: 2px solid var(--color-accent);
        outline-offset: -2px;
    }
</style>