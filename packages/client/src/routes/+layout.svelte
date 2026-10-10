<script lang="ts">
    import '../app.css';
    import { onMount } from 'svelte';
    import {
        connectionStore,
        dayNoteStore,
        holidayStore,
        preferencesStore,
        projectStore,
        recurringTaskStore,
        someDayGroupStore,
        tagStore,
        taskStore,
    } from '$lib/stores';
    import { container } from '$lib/container';
    import { handleGlobalKeydown } from '$lib/keybindingActions';
    import { refreshKeybindings } from '$lib/keybindingActions';
    import IconRail from '$lib/components/IconRail.svelte';
    import DateMinimap from '$lib/components/DateMinimap.svelte';
    import SomedayPanel from '$lib/components/SomedayPanel.svelte';
    import BottomBar from '$lib/components/BottomBar.svelte';
    import ModalHost from '$lib/components/ModalHost.svelte';
    import NotificationContainer from '$lib/components/NotificationContainer.svelte';
    import { i18nStore } from '$lib/i18n/i18nStore.svelte';

    let { children } = $props();

    function applyTheme(theme: 'light' | 'dark' | 'system') {
        let resolved: 'light' | 'dark';
        if (theme === 'system') {
            resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        } else {
            resolved = theme;
        }
        document.documentElement.setAttribute('data-theme', resolved);

        // A favicon is fetched before the app knows its theme setting, so
        // the tab starts on the light favicon.svg. Once the theme is
        // resolved, point the tab at the matching variant (href derived
        // from the existing link so any asset base survives) so the mark
        // always agrees with the in-app Logo.
        const iconLink = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
        const iconHref = iconLink?.getAttribute('href');
        if (iconLink && iconHref) {
            const variant = resolved === 'dark' ? 'favicon-dark.svg' : 'favicon.svg';
            iconLink.setAttribute('href', iconHref.replace(/favicon(?:-dark)?\.svg$/, variant));
        }
    }

    onMount(() => {
        preferencesStore.load().then(() => {
            applyTheme(preferencesStore.theme);
            // Tags fetch AFTER the preferences land: color auto-assignment
            // (USE-4) reads the persisted tagColors map, and assigning
            // from the defaults would race the user's saved colors.
            tagStore.fetchAll();
        });
        projectStore.fetchAll();
        someDayGroupStore.fetchAll();
        holidayStore.fetchAll();
        dayNoteStore.fetchAll();
        taskStore.fetchAll();
        document.querySelector('.app-shell')?.setAttribute('data-hydrated', 'true');

        connectionStore.init();
        taskStore.initWebSocket();
        tagStore.initWebSocket();
        projectStore.initWebSocket();
        someDayGroupStore.initWebSocket();
        holidayStore.initWebSocket();
        dayNoteStore.initWebSocket();
        recurringTaskStore.initWebSocket();

        // Route uncaught errors through the shared logger so client-side
        // failures are visible in the console alongside server logs.
        const onError = (event: ErrorEvent) => {
            container.logger.error('Uncaught error', event.error ?? event.message);
        };
        const onRejection = (event: PromiseRejectionEvent) => {
            container.logger.error('Unhandled promise rejection', event.reason);
        };
        window.addEventListener('error', onError);
        window.addEventListener('unhandledrejection', onRejection);

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (preferencesStore.theme === 'system') {
                applyTheme('system');
            }
        });

        return () => {
            window.removeEventListener('error', onError);
            window.removeEventListener('unhandledrejection', onRejection);
            connectionStore.destroy();
            taskStore.destroyWebSocket();
            tagStore.destroyWebSocket();
            projectStore.destroyWebSocket();
            someDayGroupStore.destroyWebSocket();
            holidayStore.destroyWebSocket();
            dayNoteStore.destroyWebSocket();
            recurringTaskStore.destroyWebSocket();
        };
    });

    $effect(() => {
        applyTheme(preferencesStore.theme);
    });

    // The accent scheme reskins the accent token family (USE-3); it is
    // independent of light/dark, so it rides its own attribute + effect.
    $effect(() => {
        document.documentElement.setAttribute('data-accent', preferencesStore.accent);
    });

    // Reading size and row spacing (USE-7) drive the --fs-*/--row-* token
    // families in app.css through root attributes.
    $effect(() => {
        document.documentElement.setAttribute('data-font-size', preferencesStore.fontSize);
    });

    $effect(() => {
        document.documentElement.setAttribute('data-row-density', preferencesStore.rowDensity);
    });

    // Shortcut remapping (USE-7): the matcher, help modal, and tooltips
    // all read the live registry; this is the single refresh point for
    // load and every change.
    $effect(() => {
        refreshKeybindings();
    });
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<div class="app-shell">
    <!-- No role="application": it would push screen readers out of browse
         mode for the whole page. The app is ordinary widgets (buttons,
         inputs, lists) that browse mode reads fine; single-key shortcuts
         still work for keyboard users because every control is a real
         focusable element (USE-9/USE-10). -->
    <a href="#main-content" class="skip-link">{i18nStore.t('app.skipToContent')}</a>
    <div class="main-area">
        <IconRail />
        <DateMinimap />
        <!-- tabindex="-1": the canonical skip-link pattern -- the
             fragment target must be programmatically focusable so the
             browser ALWAYS lands document focus on it after the skip
             link, regardless of engine timing (CI caught headless
             Chromium intermittently skipping the fragment focus when
             preferences land mid-navigation). -->
        <main id="main-content" class="day-list-area" tabindex="-1">
            {@render children()}
        </main>
        <SomedayPanel />
    </div>
    <BottomBar />
</div>

<ModalHost />
<NotificationContainer />

<style>
    .app-shell {
        display: flex;
        flex-direction: column;
        height: 100vh;
        overflow: hidden;
    }

    .skip-link {
        position: absolute;
        top: -40px;
        inset-inline-start: 0;
        background: var(--color-accent);
        color: var(--color-on-accent);
        padding: 8px 16px;
        z-index: 200;
        font-size: 14px;
        text-decoration: none;
        border-radius: 0 0 4px 0;
    }

    .skip-link:focus {
        top: 0;
    }

    .main-area {
        display: flex;
        flex: 1;
        min-height: 0;
    }

    .day-list-area {
        flex: 1;
        min-width: 0;
        overflow-y: auto;
        transition: flex 0.2s ease;
        margin: 36px 0;
        box-sizing: border-box;
    }
</style>