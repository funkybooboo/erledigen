<script lang="ts">
    import Modal from '$lib/components/Modal.svelte';
    import { SHORTCUTS, SHORTCUT_SECTIONS, formatBinding } from '$lib/keybindings';
    let { onclose = () => {} }: { onclose?: () => void } = $props();
</script>

<Modal title="Keyboard Shortcuts" onclose={onclose}>
    <div class="help">
        {#each SHORTCUT_SECTIONS as section (section.title)}
            <section class="section">
                <h3>{section.title}</h3>
                <table class="shortcut-table">
                    <tbody>
                        {#each section.ids as id (id)}
                            <tr>
                                <td>
                                    <span class="keys">
                                        {#each SHORTCUTS[id].bindings as binding, i (binding)}
                                            {#if i > 0}<span class="alt">/</span>{/if}
                                            {#each formatBinding(binding).split(' ') as key (key)}
                                                <kbd>{key}</kbd>
                                            {/each}
                                        {/each}
                                    </span>
                                </td>
                                <td>{SHORTCUTS[id].label}</td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </section>
        {/each}
    </div>
</Modal>

<style>
    .help {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .section h3 {
        font-size: 13px;
        font-weight: 600;
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0 0 8px;
    }

    .shortcut-table {
        width: 100%;
        border-collapse: collapse;
    }

    .shortcut-table td {
        padding: 6px 0;
        font-size: 14px;
        border-bottom: 1px solid var(--color-border);
    }

    .shortcut-table td:first-child {
        width: 160px;
        white-space: nowrap;
    }

    .alt {
        color: var(--color-text-muted);
        margin: 0 2px;
    }

    /* Flex gap (not whitespace) separates the kbd chips: Svelte strips
       whitespace-only text nodes, so template spacing is unreliable. */
    .keys {
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }

    kbd {
        background: var(--color-surface-dim);
        border: 1px solid var(--color-border);
        border-radius: 4px;
        padding: 2px 6px;
        font-family: monospace;
        font-size: 12px;
    }
</style>
