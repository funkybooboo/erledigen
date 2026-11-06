<script lang="ts">
    import { projectStore } from '#lib/stores/index.ts';
    import { i18nStore } from '#lib/i18n/i18nStore.svelte.ts';

    let {
        projectId,
        position,
        disabled = false,
    }: {
        projectId: string;
        position: number;
        disabled?: boolean;
    } = $props();

    // The initial capture is deliberate: local edits (the drag) win
    // while the input is focused, the effect below re-syncs from the
    // store otherwise (another tab can drag the marker over the
    // WebSocket).
    // svelte-ignore state_referenced_locally
    let value = $state(position);
    let focused = $state(false);
    $effect(() => {
        if (!focused) value = position;
    });

    function commit() {
        if (value === position) return;
        void projectStore.update(projectId, { hillPosition: value });
    }

    // The marker rides the drawn hill curve (a parabola through the
    // same points the SVG path uses). No percentage is ever displayed
    // -- the phase caption is the only reading (ADR-011).
    let markerX = $derived(value);
    let markerY = $derived(10 + (36 / 2500) * (value - 50) ** 2);
    const PHASE_KEYS = {
        figuring: 'projects.hillFiguring',
        settled: 'projects.hillSettled',
        executing: 'projects.hillExecuting',
    } as const;
    let phaseKey = $derived(
        value < 45
            ? PHASE_KEYS.figuring
            : value > 55
              ? PHASE_KEYS.executing
              : PHASE_KEYS.settled,
    );
</script>

<div class="hill">
    <svg
        class="hill-curve"
        viewBox="0 0 100 56"
        preserveAspectRatio="none"
        aria-hidden="true"
    >
        <path d="M 2,54 Q 50,-14 98,54" fill="none" stroke="currentColor" stroke-width="1.6" />
        {#if !disabled}
            <circle cx={markerX} cy={markerY} r="2.6" class="hill-marker" />
        {/if}
    </svg>
    <input
        class="hill-range"
        type="range"
        min="0"
        max="100"
        step="1"
        bind:value
        oninput={commit}
        onchange={commit}
        onfocus={() => (focused = true)}
        onblur={() => {
            focused = false;
            commit();
        }}
        {disabled}
        aria-label={i18nStore.t('projects.hillAria')}
    />
    <span class="hill-phase" aria-hidden="true">{i18nStore.t(phaseKey)}</span>
</div>

<style>
    .hill {
        position: relative;
        height: 56px;
        max-width: 260px;
        color: var(--color-text-secondary);
    }

    .hill-curve {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        opacity: 0.55;
    }

    .hill-marker {
        fill: var(--color-accent);
        stroke: var(--color-surface);
        stroke-width: 1;
    }

    /* The range input IS the control: it covers the curve so the thumb
       drags the marker, and it brings the keyboard path for free
       (arrows, Home/End). The native thumb is invisible; the SVG circle
       is the visible marker. */
    .hill-range {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        opacity: 0;
        cursor: ew-resize;
    }

    .hill-phase {
        display: block;
        position: absolute;
        bottom: 0;
        left: 0;
        font-size: 12px;
        color: var(--color-text-muted);
    }
</style>
