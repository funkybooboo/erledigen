<script lang="ts">
    import DayList from '$lib/components/DayList.svelte';
    import { taskStore } from '$lib/stores';

    // Store bootstrap lives in +layout.svelte (single place); this page
    // only renders whatever the stores already hold.
</script>

<svelte:head>
    <title>Erledigen - Task App</title>
</svelte:head>

{#if taskStore.loading && taskStore.tasks.length === 0}
    <div class="loading">
        <p>Loading tasks...</p>
    </div>
{:else if taskStore.error}
    <div class="error">
        <p>Something went wrong: {taskStore.error}</p>
        <button onclick={() => taskStore.fetchAll()}>Retry</button>
    </div>
{:else}
    <DayList />
{/if}

<style>
    .loading, .error {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 200px;
        color: var(--color-text-muted);
    }

    .error button {
        margin-left: 12px;
        padding: 4px 12px;
        background: var(--color-accent);
        color: var(--color-on-accent);
        border: none;
        border-radius: 999px;
        cursor: pointer;
    }
</style>