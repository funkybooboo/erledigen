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
     shape language). Per the owner's spec the mark carries no badge -- the
     canvas is the theme surface itself, black in dark mode and white in
     light mode, so the mark reads as pills plus an ink spine sitting
     directly on the theme. Spine = ink (--color-text), pills = the
     p1/p2/p3 palette tokens; geometry mirrors the favicon files 1:1
     (favicon.svg = light variant, favicon-dark.svg = dark variant, same
     palettes hardcoded to their sRGB values because a favicon renders
     outside the app). The tab shows the variant matching the resolved
     theme (+layout.svelte applyTheme), so both marks always agree. -->
<svg
    width={size}
    height={size}
    viewBox="108 96 320 320"
    role={label ? 'img' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : 'true'}
>
    <rect x="108" y="108" width="296" height="76" rx="38" fill="var(--color-p1)" />
    <rect x="108" y="218" width="246" height="76" rx="38" fill="var(--color-p2)" />
    <rect x="108" y="328" width="320" height="76" rx="38" fill="var(--color-p3)" />
    <rect x="108" y="108" width="76" height="296" rx="38" fill="var(--color-text)" />
</svg>