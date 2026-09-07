<script lang="ts">
    interface Props {
        /** Rendered size in pixels (the mark is square). */
        size?: number;
        /** Accessible label. Omit to hide the mark from screen readers, for
         * use inside an already-labelled parent (e.g. the bottom bar's home
         * button). */
        label?: string;
    }

    let { size = 16, label }: Props = $props();
</script>

<!-- The Erledigen mark: a Bauhaus "E" built from pills (the app's button
     shape language). Geometry mirrors static/favicon.svg 1:1, but the fills
     use live theme tokens, so this mark follows the in-app theme setting;
     the favicon's embedded prefers-color-scheme media query follows the
     browser's scheme, and both use the same token mapping (badge = ink,
     spine = on-accent, pills = p1/p2/p3 -- the ink/surface inversion of
     app.css). The token values are exactly the favicon's hardcoded hexes,
     light and dark. -->
<svg
    width={size}
    height={size}
    viewBox="0 0 512 512"
    role={label ? 'img' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : 'true'}
>
    <rect width="512" height="512" rx="112" fill="var(--color-text)" />
    <rect x="108" y="108" width="296" height="76" rx="38" fill="var(--color-p1)" />
    <rect x="108" y="218" width="246" height="76" rx="38" fill="var(--color-p2)" />
    <rect x="108" y="328" width="320" height="76" rx="38" fill="var(--color-p3)" />
    <rect x="108" y="108" width="76" height="296" rx="38" fill="var(--color-on-accent)" />
</svg>