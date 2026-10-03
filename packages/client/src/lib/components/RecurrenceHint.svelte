<script lang="ts">
    import { describeRecurrence, type ParsedRecurrence } from '@erledigen/shared';
    import { Icon } from 'svelte-icons-pack';
    import { LuRepeat } from 'svelte-icons-pack/lu';

    let { parsed }: { parsed: ParsedRecurrence } = $props();
</script>

<span class="recur-hint" title="This will repeat: {parsed.phrase}">
    <Icon src={LuRepeat} />
    <span>{describeRecurrence(parsed.schedule)}</span>
</span>

<style>
    .recur-hint {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
        padding: 1px 8px;
        border-radius: 999px;
        background: var(--color-accent-light);
        color: var(--color-accent);
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
        pointer-events: none;
        animation: hint-in 150ms ease-out;
    }

    .recur-hint :global(svg) {
        width: 12px;
        height: 12px;
    }

    @keyframes hint-in {
        from {
            opacity: 0;
            transform: scale(0.9);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
</style>