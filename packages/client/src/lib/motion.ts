/**
 * Motion helpers (USE-6): every purposeful animation routes through
 * here so `prefers-reduced-motion` is respected EVERYWHERE from one
 * place.
 *
 * - CSS-side motion (transitions, keyframes) is killed globally by the
 *   `@media (prefers-reduced-motion: reduce)` block in app.css.
 * - Svelte transition directives need JS-side gating (a CSS rule cannot
 *   stop them): call sites pass durations through these helpers and get
 *   0 back when the user asked for no motion -- Svelte treats a 0ms
 *   transition as instant, so the element still mounts/unmounts
 *   correctly, just without motion.
 *
 * The query is read fresh on every call (not cached at module load) so
 * an OS setting toggled mid-session takes effect on the next gesture;
 * SSR renders with motion-safe defaults and matches on hydration.
 */

/** True when the OS asks for reduced motion (guards to false on SSR). */
export function prefersReducedMotion(): boolean {
    return (
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}

/** A motion duration: `ms` normally, 0 under prefers-reduced-motion. */
export function motionMs(ms: number): number {
    return prefersReducedMotion() ? 0 : ms;
}
