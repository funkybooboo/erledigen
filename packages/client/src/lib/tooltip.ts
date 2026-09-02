import type { Action } from 'svelte/action';
import { formatBinding, SHORTCUTS, type ShortcutId } from '$lib/keybindings';

/**
 * Hover tooltip action. Shows the action's label plus its keyboard
 * binding (from the shared registry) when the pointer hovers the element,
 * or when it receives keyboard focus.
 *
 * Usage:
 *   <button use:tooltip={'deleteTask'}>...</button>
 *   <button use:tooltip={{ label: 'Rename group' }}>...</button>
 *   <button use:tooltip={{ label: 'Mark complete', shortcut: 'toggleComplete' }}>...</button>
 *
 * The tooltip element is appended to <body> (position: fixed) so it escapes
 * every overflow/transform clipping context, and is styled by the global
 * `.ui-tooltip` rules in app.css.
 *
 * Accessibility: the trigger is linked to the tooltip via
 * aria-describedby while it is visible (the ARIA tooltip pattern), and
 * Escape dismisses every visible tooltip.
 *
 * Cost: one action per element that carries a tooltip, but only ONE set
 * of document/window listeners for the whole page (reference-counted
 * below) -- a day list can mount hundreds of tooltip-carrying buttons,
 * and per-instance listeners would put an O(rows) callback on every
 * scroll event.
 */

export type TooltipParam = ShortcutId | { label: string; shortcut?: ShortcutId };

interface TooltipContent {
    label: string;
    bindings: string[];
}

const SHOW_DELAY_MS = 300;

function resolveParam(param: TooltipParam): TooltipContent | null {
    if (typeof param === 'string') {
        const shortcut = SHORTCUTS[param];
        return shortcut ? { label: shortcut.label, bindings: shortcut.bindings } : null;
    }
    const shortcut = param.shortcut ? SHORTCUTS[param.shortcut] : undefined;
    return { label: param.label, bindings: shortcut?.bindings ?? [] };
}

function position(node: HTMLElement, el: HTMLElement) {
    const rect = node.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const margin = 8;

    // Centered above the element, clamped to the viewport; falls back to
    // below when there is not enough room on top (e.g. bottom bar).
    let x = rect.left + rect.width / 2 - w / 2;
    x = Math.max(margin, Math.min(x, window.innerWidth - w - margin));
    const above = rect.top - h - margin >= 0;
    const y = above ? rect.top - h - margin : rect.bottom + margin;

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
}

// --- shared listeners ----------------------------------------------------
// Hides every visible tooltip at once; attached while at least one
// tooltip action is mounted.

const hideAll = new Set<() => void>();
let sharedRefs = 0;
let tooltipUid = 0;

function hideEveryTooltip(): void {
    for (const hide of [...hideAll]) hide();
}

function onSharedKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') hideEveryTooltip();
}

function attachSharedListeners(): void {
    if (sharedRefs++ > 0) return;
    document.addEventListener('scroll', hideEveryTooltip, { capture: true, passive: true });
    window.addEventListener('resize', hideEveryTooltip);
    // Capture phase: tooltips dismiss on Escape even when a focused modal
    // stops the event's propagation to the window handlers.
    document.addEventListener('keydown', onSharedKeydown, { capture: true });
}

function detachSharedListeners(): void {
    if (--sharedRefs > 0) return;
    document.removeEventListener('scroll', hideEveryTooltip, { capture: true });
    window.removeEventListener('resize', hideEveryTooltip);
    document.removeEventListener('keydown', onSharedKeydown, { capture: true });
}

export const tooltip: Action<HTMLElement, TooltipParam> = (node, param) => {
    let content = resolveParam(param);
    let tooltipEl: HTMLElement | null = null;
    /** The trigger's prior aria-describedby, restored on hide. */
    let describedBy: string | null = null;
    let showTimer: ReturnType<typeof setTimeout> | null = null;

    attachSharedListeners();

    function hide() {
        if (showTimer) {
            clearTimeout(showTimer);
            showTimer = null;
        }
        if (tooltipEl) {
            hideAll.delete(hide);
            tooltipEl.remove();
            tooltipEl = null;
            if (describedBy === null) {
                node.removeAttribute('aria-describedby');
            } else {
                node.setAttribute('aria-describedby', describedBy);
            }
        }
    }

    function render() {
        if (!content) return;
        const el = document.createElement('div');
        el.className = 'ui-tooltip';
        el.setAttribute('role', 'tooltip');
        el.id = `ui-tooltip-${++tooltipUid}`;

        const label = document.createElement('span');
        label.className = 'ui-tooltip-label';
        label.textContent = content.label;
        el.appendChild(label);

        if (content.bindings.length > 0) {
            const keys = document.createElement('span');
            keys.className = 'ui-tooltip-keys';
            content.bindings.forEach((binding, i) => {
                if (i > 0) {
                    const sep = document.createElement('span');
                    sep.className = 'ui-tooltip-sep';
                    sep.textContent = '/';
                    keys.appendChild(sep);
                }
                for (const key of formatBinding(binding).split(' ')) {
                    const kbd = document.createElement('kbd');
                    kbd.textContent = key;
                    keys.appendChild(kbd);
                }
            });
            el.appendChild(keys);
        }

        document.body.appendChild(el);
        position(node, el);
        requestAnimationFrame(() => el.classList.add('ui-tooltip-visible'));
        tooltipEl = el;
        hideAll.add(hide);

        // Link the trigger to the tooltip for assistive tech while visible.
        describedBy = node.getAttribute('aria-describedby');
        node.setAttribute('aria-describedby', el.id);
    }

    function scheduleShow() {
        hide();
        showTimer = setTimeout(() => {
            showTimer = null;
            render();
        }, SHOW_DELAY_MS);
    }

    function onPointerEnter(e: PointerEvent) {
        // Touch taps shouldn't flash a tooltip.
        if (e.pointerType === 'touch') return;
        scheduleShow();
    }

    function onPointerLeave() {
        hide();
    }

    function onFocus() {
        if (!node.matches(':focus-visible')) return;
        hide();
        render();
    }

    function onPointerDown() {
        // Clicking usually opens something (modal, edit) -- never let the
        // tooltip linger over it.
        hide();
    }

    node.addEventListener('pointerenter', onPointerEnter);
    node.addEventListener('pointerleave', onPointerLeave);
    node.addEventListener('focus', onFocus);
    node.addEventListener('blur', onPointerLeave);
    node.addEventListener('pointerdown', onPointerDown);

    return {
        update(next: TooltipParam) {
            content = resolveParam(next);
            if (tooltipEl) {
                hide();
                render();
            }
        },
        destroy() {
            hide();
            detachSharedListeners();
            node.removeEventListener('pointerenter', onPointerEnter);
            node.removeEventListener('pointerleave', onPointerLeave);
            node.removeEventListener('focus', onFocus);
            node.removeEventListener('blur', onPointerLeave);
            node.removeEventListener('pointerdown', onPointerDown);
        },
    };
};
