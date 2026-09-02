<script lang="ts">
    import '../app.css';
    import { onMount } from 'svelte';
    import {
        connectionStore,
        preferencesStore,
        projectStore,
        someDayGroupStore,
        tagStore,
        taskStore,
    } from '$lib/stores';
    import { container } from '$lib/container';
    import { handleGlobalKeydown } from '$lib/keybindingActions';
    import IconRail from '$lib/components/IconRail.svelte';
    import DateMinimap from '$lib/components/DateMinimap.svelte';
    import SomedayPanel from '$lib/components/SomedayPanel.svelte';
    import BottomBar from '$lib/components/BottomBar.svelte';
    import ModalHost from '$lib/components/ModalHost.svelte';
    import NotificationContainer from '$lib/components/NotificationContainer.svelte';

    let { children } = $props();

    function applyTheme(theme: 'light' | 'dark' | 'system') {
        let resolved: 'light' | 'dark';
        if (theme === 'system') {
            resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        } else {
            resolved = theme;
        }
        document.documentElement.setAttribute('data-theme', resolved);
    }

    onMount(() => {
        preferencesStore.load().then(() => {
            applyTheme(preferencesStore.theme);
        });
        tagStore.fetchAll();
        projectStore.fetchAll();
        document.querySelector('.app-shell')?.setAttribute('data-hydrated', 'true');

        connectionStore.init();
        taskStore.initWebSocket();
        tagStore.initWebSocket();
        projectStore.initWebSocket();

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
        };
    });

    $effect(() => {
        applyTheme(preferencesStore.theme);
    });
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<div class="app-shell" role="application" aria-label="Erledigen Task App">
    <a href="#main-content" class="skip-link">Skip to content</a>
    <div class="main-area">
        <IconRail />
        <DateMinimap />
        <main id="main-content" class="day-list-area">
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
        left: 0;
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