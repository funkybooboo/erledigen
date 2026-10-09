<script lang="ts">
    import type { Snippet } from 'svelte';
    import { onMount, onDestroy } from 'svelte';
    import { fade, fly, scale } from 'svelte/transition';
    import { Icon } from 'svelte-icons-pack';
    import { LuX } from 'svelte-icons-pack/lu';
    import { tooltip } from '$lib/tooltip';
    import { motionMs } from '$lib/motion';

    let { title = '', onclose = () => {}, children }: { title?: string; onclose?: () => void; children?: Snippet } = $props();

    let modalEl: HTMLElement;
    let previousFocusEl: HTMLElement | null = null;

    /** Unique per-instance title id: dialogs stack (Settings opens a
     *  Confirm on top), so a static id would duplicate across the DOM
     *  and break aria-labelledby + getElementById. */
    const titleId = `modal-title-${Math.random().toString(36).slice(2, 8)}`;

    /** Mobile docks the dialog as a bottom sheet, where sliding up from
     *  the edge is the platform idiom; desktop dialogs scale in (the
     *  Fizzy dialog motion). Both share the params object -- fly ignores
     *  `start`, scale ignores `y`. Modals only ever mount client-side
     *  (ModalHost renders nothing under SSR), so the width probe is
     *  safe; the window guard keeps the module SSR-importable. */
    const dialogTransitionFn =
        typeof window !== 'undefined' && window.innerWidth < 768 ? fly : scale;
    const dialogMotion = { duration: motionMs(150), start: 0.97, y: 24 };

    onMount(() => {
        previousFocusEl = document.activeElement as HTMLElement;
        modalEl?.focus();
    });

    onDestroy(() => {
        if (previousFocusEl) {
            previousFocusEl.focus();
        }
    });

    function handleBackdropClick() {
        onclose();
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            e.stopPropagation();
            onclose();
        }
    }

    function handleTabTrap(e: KeyboardEvent) {
        if (e.key !== 'Tab') return;

        const focusable = modalEl.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- The backdrop is a visual dimming layer + click-to-close target. It must
     NOT carry aria-hidden: that would hide the dialog subtree from screen
     readers (and from Playwright's accessibility-based locators). The
     dialog's aria-modal="true" is what tells assistive tech the background
     is inert; the backdrop staying visible to AT is correct. -->
<div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    role="presentation"
    transition:fade={{ duration: motionMs(120) }}
>
    <div
        class="modal"
        bind:this={modalEl}
        onclick={(e) => { e.stopPropagation(); }}
        onkeydown={(e) => { if (e.key === 'Tab') e.stopPropagation(); handleTabTrap(e); }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabindex="-1"
        transition:dialogTransitionFn={dialogMotion}
    >
        <div class="modal-header">
            <h2 class="modal-title" id={titleId}>{title}</h2>
            <button class="close-btn" onclick={() => onclose()} use:tooltip={'closeModal'} aria-label="Close modal"><Icon src={LuX} /></button>
        </div>
        <!-- The body is a scrollable region: axe's scrollable-region-
             focusable REQUIRES tabindex="0" so keyboard users can scroll it
             (svelte's static rule cannot see the overflow, hence the
             targeted ignore). -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div class="modal-body" role="document" tabindex="0">
            {@render children?.()}
        </div>
    </div>
</div>

<style>
    .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex !important;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .modal {
        background: var(--color-surface);
        border-radius: 12px;
        box-shadow: var(--shadow-panel);
        max-width: 1400px;
        width: 96vw;
        height: calc(100vh - 32px);
        max-height: calc(100vh - 32px);
        display: flex;
        flex-direction: column;
        outline: none;
    }

    .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid var(--color-border);
    }

    .modal-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--color-text);
        margin: 0;
    }

    .close-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--color-text-secondary);
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        transition: background-color 0.15s, color 0.15s;
    }

    .close-btn :global(svg) {
        width: 18px;
        height: 18px;
    }

    .close-btn:hover {
        background: var(--color-surface-hover);
        color: var(--color-text);
    }

    .close-btn:focus-visible {
        outline: 2px solid var(--color-accent);
        outline-offset: 2px;
    }

    .modal-body {
        padding: 20px;
        overflow-y: auto;
        flex: 1;
    }

    /* Mobile (v0.6.0): the dialog docks as a bottom sheet -- full width,
       rounded top corners only, capped at 85vh with internal scroll.
       Every modal inherits this from the one shared component. The
       sheet's rise-from-the-edge motion comes from the shared fly/scale
       transition directive above (JS-driven), so no per-breakpoint
       keyframes live here. */
    @media (max-width: 767px) {
        .modal-backdrop {
            align-items: flex-end;
        }

        .modal {
            width: 100vw;
            max-width: 100vw;
            height: auto;
            max-height: 85vh;
            border-radius: 12px 12px 0 0;
        }

        .modal-body {
            padding: 16px;
        }
    }
</style>