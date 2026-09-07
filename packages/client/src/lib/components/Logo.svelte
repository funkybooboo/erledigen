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
     use live theme tokens -- the favicon hardcodes the light palette because
     a browser tab can't see this app's CSS, and here the badge/spine invert
     with the theme (ink/surface inversion, the app.css tooltip pattern).
     The light-theme token values are exactly the favicon's hex colors. -->
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