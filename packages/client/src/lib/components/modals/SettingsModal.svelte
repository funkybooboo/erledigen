<script lang="ts">
    import Modal from '$lib/components/Modal.svelte';
    import { holidayStore, preferencesStore, refetchAllStores, tagStore, uiStore } from '$lib/stores';
    import { container } from '$lib/container';
    import { ExportService } from '$lib/services/exportService';
    import { HolidayService, type HolidayImportResult } from '$lib/services/holidayService';
    import { ImportService } from '$lib/services/importService';
    import { tagColorVar } from '$lib/tagColors';
    import { Icon } from 'svelte-icons-pack';
    import { LuGitMerge, LuPencil, LuTrash2 } from 'svelte-icons-pack/lu';
    import {
        autoDetectCsvMapping,
        CsvImportAdapter,
        CSV_IMPORT_FIELDS,
        HttpClientError,
        IMPORT_FORMAT_META,
        IMPORT_FORMATS,
        isValidTimeZone,
        PRIORITY_TAGS,
        TAG_COLORS,
        type CsvColumnMapping,
        type ExportFormat,
        type ImportFormat,
        type ImportResult,
        type RolloverTriggerTime,
        type TagColorId,
    } from '@erledigen/shared';
    import { onMount } from 'svelte';

    let { onclose = () => {} }: { onclose?: () => void } = $props();

    let rolloverEnabled = $state(preferencesStore.rolloverEnabled);
    let rolloverTriggerTime = $state(preferencesStore.rolloverTriggerTime);
    let showEmptyDays = $state(preferencesStore.showEmptyDays);
    let persistActiveFilters = $state(preferencesStore.persistActiveFilters);
    let deleteConfirmation = $state(preferencesStore.deleteConfirmation);
    let timeFormat = $state(preferencesStore.timeFormat);
    let timezoneInput = $state((preferencesStore.timezone ?? '').toString());
    let tzInvalid = $state(false);

    // Full IANA timezone list from the runtime; a native <datalist> does the
    // substring search so ~400 options need no shipped data.
    const tzOptions: string[] = Intl.supportedValuesOf('timeZone');

    $effect(() => {
        rolloverEnabled = preferencesStore.rolloverEnabled;
        rolloverTriggerTime = preferencesStore.rolloverTriggerTime;
        showEmptyDays = preferencesStore.showEmptyDays;
        persistActiveFilters = preferencesStore.persistActiveFilters;
        deleteConfirmation = preferencesStore.deleteConfirmation;
        timeFormat = preferencesStore.timeFormat;
        timezoneInput = (preferencesStore.timezone ?? '').toString();
        tzInvalid = false;
    });

    // Live preview of the wall-clock in the chosen zone, refreshed on a timer
    // so the user sees the offset effect while the modal is open.
    let now = $state(new Date());
    onMount(() => {
        const t = setInterval(() => {
            now = new Date();
        }, 1000);
        return () => clearInterval(t);
    });
    let tzPreview = $derived(buildTzPreview());
    function buildTzPreview(): string {
        const tz =
            preferencesStore.timezone !== null && !tzInvalid ? preferencesStore.timezone : null;
        const time = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: preferencesStore.timeFormat !== '24h',
            ...(tz ? { timeZone: tz } : {}),
        });
        const zoneLabel = (tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone) || 'system';
        return `Now: ${time} (${zoneLabel})`;
    }

    function handleRolloverChange(e: Event) {
        const value = (e.target as HTMLInputElement).checked;
        preferencesStore.save({ rolloverEnabled: value });
    }

    function handleRolloverTriggerChange(e: Event) {
        const value = (e.target as HTMLSelectElement).value as RolloverTriggerTime;
        preferencesStore.save({ rolloverTriggerTime: value });
    }

    function handleShowEmptyDaysChange(e: Event) {
        const value = (e.target as HTMLInputElement).checked;
        preferencesStore.save({ showEmptyDays: value });
    }

    function handlePersistActiveFiltersChange(e: Event) {
        const value = (e.target as HTMLInputElement).checked;
        preferencesStore.setPersistActiveFilters(value);
    }

    function handleDeleteConfirmationChange(e: Event) {
        const value = (e.target as HTMLSelectElement).value as 'instant' | 'confirm';
        preferencesStore.setDeleteConfirmation(value);
    }

    function handleTimeFormatChange(e: Event) {
        const value = (e.target as HTMLSelectElement).value as '12h' | '24h';
        preferencesStore.setTimeFormat(value);
    }

    function handleTimezoneInput(e: Event) {
        const raw = (e.target as HTMLInputElement).value.trim();
        timezoneInput = raw;
        if (raw === '') {
            tzInvalid = false;
            preferencesStore.setTimezone(null);
            return;
        }
        if (isValidTimeZone(raw)) {
            tzInvalid = false;
            preferencesStore.setTimezone(raw);
        } else {
            // Keep the previous valid zone in place; flag the input as invalid.
            tzInvalid = true;
        }
    }

    // -- Holidays (v0.9.0) --------------------------------------------------------

    const holidayService = new HolidayService(container.httpClient);
    let newHolidayName = $state('');
    let newHolidayDate = $state('');
    let holidayError = $state<string | null>(null);
    let holidayImportUrlInput = $state('');
    let holidayImporting = $state(false);
    let holidayImportResult = $state<HolidayImportResult | null>(null);

    /** Summary line for a finished .ics import. */
    let holidayImportSummary = $derived.by(() => {
        const result = holidayImportResult;
        if (result === null) return null;
        const skipped =
            result.skipped > 0 ? ` (${result.skipped} skipped as duplicates)` : '';
        const n = result.holidays.length;
        return `Imported ${n} holiday${n !== 1 ? 's' : ''}${skipped}.`;
    });

    async function addHoliday(): Promise<void> {
        const name = newHolidayName.trim();
        if (name === '' || newHolidayDate === '') return;
        holidayError = null;
        const created = await holidayStore.create({ name, date: newHolidayDate });
        if (created) {
            newHolidayName = '';
            newHolidayDate = '';
        } else {
            // The store swallows the failure (logged); surface it here.
            holidayError = 'Could not add the holiday -- check the name and date.';
        }
    }

    function handleHolidayKeydown(e: KeyboardEvent): void {
        if (e.key === 'Enter') void addHoliday();
    }

    async function importHolidayUrl(): Promise<void> {
        const url = holidayImportUrlInput.trim();
        if (url === '') return;
        await runHolidayImport(() => holidayService.importUrl(url));
    }

    async function importHolidayFile(e: Event): Promise<void> {
        const input = e.currentTarget as HTMLInputElement;
        const file = input.files?.[0] ?? null;
        if (file === null) return;
        const source = await file.text();
        await runHolidayImport(() => holidayService.importIcs(source));
        input.value = '';
    }

    async function runHolidayImport(fn: () => Promise<HolidayImportResult>): Promise<void> {
        holidayImporting = true;
        holidayError = null;
        holidayImportResult = null;
        try {
            holidayImportResult = await fn();
        } catch (error) {
            holidayError =
                error instanceof HttpClientError
                    ? parseHolidayImportError(error)
                    : 'Holiday import failed -- check that the server is reachable.';
        } finally {
            holidayImporting = false;
        }
    }

    function parseHolidayImportError(error: HttpClientError): string {
        try {
            const body = JSON.parse(String(error.body ?? '')) as { error?: string };
            if (body.error) return `Import rejected: ${body.error}`;
        } catch {
            // fall through to the generic message
        }
        return 'Holiday import failed -- the document could not be processed.';
    }

    // -- Tags management (USE-5) -------------------------------------------------

    /** Fixed swatch colors: each picker dot shows its own palette entry
     *  (light-mode values, readable on both themes) -- same idea as the
     *  Theme modal's accent swatches. */
    const TAG_SWATCH_COLORS: Record<TagColorId, string> = {
        coral: 'oklch(56% 0.17 30)',
        amber: 'oklch(52% 0.11 70)',
        lime: 'oklch(50% 0.12 125)',
        sage: 'oklch(46% 0.08 150)',
        sky: 'oklch(52% 0.12 245)',
        violet: 'oklch(48% 0.16 295)',
        rose: 'oklch(55% 0.15 350)',
        slate: 'oklch(45% 0.03 250)',
    };

    /** Which row's inline editor is open (one at a time). */
    let tagEditor = $state<{ name: string; kind: 'rename' | 'merge' | 'color' } | null>(null);
    let renameValue = $state('');
    let mergeTarget = $state('');
    let tagError = $state<string | null>(null);

    /** All tags with counts, sorted by name (server order), plus the
     *  resolved color for each row's dot. */
    let tagRows = $derived(
        tagStore.tagInfo.map(info => ({ ...info, color: tagColorVar(info.name) })),
    );

    $effect(() => {
        // The list is live in the open modal: tag:* broadcasts (another
        // tab's changes) and the local store ops both land here.
        tagStore.tagInfo;
        tagStore.tags;
    });

    onMount(() => {
        void tagStore.fetchAll();
        void tagStore.fetchInfo();
    });

    function openTagEditor(name: string, kind: 'rename' | 'merge' | 'color') {
        tagError = null;
        if (tagEditor?.name === name && tagEditor.kind === kind) {
            tagEditor = null;
            return;
        }
        if (kind === 'rename') {
            renameValue = name;
            mergeTarget = '';
        } else if (kind === 'merge') {
            mergeTarget = tagStore.tags.find(other => other !== name) ?? '';
            renameValue = '';
        }
        tagEditor = { name, kind };
    }

    /** Commit a rename (Enter or blur). Empty or unchanged cancels. */
    async function commitTagRename(from: string) {
        const to = renameValue.trim().toLowerCase();
        tagEditor = null;
        if (to === '' || to === from) return;
        const ok = await tagStore.rename(from, to);
        if (!ok) tagError = `Could not rename #${from}.`;
    }

    function handleRenameKeydown(from: string, e: KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            void commitTagRename(from);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            tagEditor = null;
        }
    }

    /** Merge this tag into the chosen target (confirm: the source tag
     *  disappears from every task that had it). */
    async function commitTagMerge(source: string) {
        const target = mergeTarget;
        if (target === '' || target === source) {
            tagEditor = null;
            return;
        }
        const sourceCount = tagStore.tagInfo.find(info => info.name === source)?.count ?? 0;
        tagEditor = null;
        const ok = await uiStore.confirm(
            `Merge #${source} into #${target}? The ${sourceCount} task${sourceCount !== 1 ? 's' : ''} carrying #${source} switch to #${target}.`,
            'Merge',
        );
        if (!ok) return;
        const merged = await tagStore.merge([source], target);
        if (!merged) tagError = `Could not merge #${source} into #${target}.`;
    }

    /** Delete: strip the tag from every task (confirm first). */
    async function deleteTag(name: string) {
        const count = tagStore.tagInfo.find(info => info.name === name)?.count ?? 0;
        const ok = await uiStore.confirm(
            `Remove #${name} from ${count} task${count !== 1 ? 's' : ''}? The tasks stay; the tag goes.`,
            'Remove',
        );
        if (!ok) return;
        const deleted = await tagStore.delete(name);
        if (!deleted) tagError = `Could not remove #${name}.`;
    }

    /** Set (or clear) a tag's color. 'none' returns the tag to its
     *  semantic priority color, or the neutral chip. */
    function setTagColor(name: string, color: TagColorId | 'none') {
        tagEditor = null;
        const next = { ...preferencesStore.tagColors };
        if (color === 'none') {
            delete next[name];
        } else {
            next[name] = color;
        }
        preferencesStore.setTagColors(next);
    }

    // -- Export (ADR-008) ---------------------------------------------------------

    const exportService = new ExportService(container.httpClient, container.dateProvider);
    let exportError = $state<string | null>(null);
    let exporting = $state<ExportFormat | null>(null);

    /** Fetch the export document and hand it to the browser as a download.
     *  Works for both deployment shapes (split-origin dev, proxied prod):
     *  the body arrives as text and the Blob is same-origin either way. */
    async function downloadExport(format: ExportFormat): Promise<void> {
        exportError = null;
        exporting = format;
        try {
            const download = await exportService.export(format);
            const url = URL.createObjectURL(new Blob([download.text], { type: download.contentType }));
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = download.filename;
            anchor.click();
            URL.revokeObjectURL(url);
        } catch {
            exportError = 'Export failed -- check that the server is reachable.';
        } finally {
            exporting = null;
        }
    }

    // -- Import (ADR-009) --------------------------------------------------------

    const importService = new ImportService(container.httpClient);
    const importFormats: readonly ImportFormat[] = [...IMPORT_FORMATS];
    let importFormat = $state<ImportFormat>('todoist-csv');
    let importFile = $state<File | null>(null);
    let importSource = $state<string | null>(null);
    let csvHeader = $state<string[] | null>(null);
    let csvMapping = $state<CsvColumnMapping>({});
    let importing = $state(false);
    let importError = $state<string | null>(null);
    let importResult = $state<ImportResult | null>(null);

    /** File-picker accept hint per format (extensions only). */
    const importAccept: Record<ImportFormat, string> = {
        json: '.json,application/json',
        csv: '.csv,text/csv',
        ics: '.ics,text/calendar',
        'todoist-csv': '.csv,text/csv',
        'things-json': '.json,application/json',
    };

    function resetImportState(): void {
        importSource = null;
        csvHeader = null;
        csvMapping = {};
        importResult = null;
        importError = null;
    }

    function handleImportFormatChange(e: Event): void {
        const value = (e.currentTarget as HTMLSelectElement).value as ImportFormat;
        importFormat = value;
        importFile = null;
        resetImportState();
    }

    async function handleImportFile(e: Event): Promise<void> {
        const input = e.currentTarget as HTMLInputElement;
        const file = input.files?.[0] ?? null;
        importFile = file;
        resetImportState();
        if (file === null) return;
        importSource = await file.text();
        if (importFormat === 'csv') {
            // Column mapping UI: header + auto-detected defaults.
            csvHeader = CsvImportAdapter.readHeader(importSource);
            csvMapping = autoDetectCsvMapping(csvHeader);
        }
    }

    function setCsvMappingField(field: string, column: string): void {
        csvMapping = { ...csvMapping, [field]: column === '' ? null : column };
    }

    /** Human-readable import summary. */
    let importSummary = $derived.by(() => {
        const result = importResult;
        if (result === null) return null;
        if (result.mode === 'restore') {
            const restored = result.restored;
            return (
                `Restored ${restored?.tasks ?? 0} task(s), ` +
                `${restored?.someDayGroups ?? 0} Someday group(s), ` +
                `${restored?.projects ?? 0} project(s), ` +
                `${restored?.recurringTasks ?? 0} recurring template(s), ` +
                `${restored?.holidays ?? 0} holiday(s), and settings.`
            );
        }
        return `Imported ${result.created} task(s).`;
    });

    async function runImport(): Promise<void> {
        const source = importSource;
        if (source === null) return;
        importError = null;
        importResult = null;

        if (IMPORT_FORMAT_META[importFormat].restore) {
            const ok = await uiStore.confirm(
                'Restoring replaces ALL data on this instance: tasks (trash included), Someday groups, projects, habits, and these settings. The server writes a backup file first. Continue?',
                'Restore',
            );
            if (!ok) return;
        }

        importing = true;
        try {
            const result = await importService.importDocument(
                importFormat,
                source,
                importFormat === 'csv' && csvHeader !== null
                    ? { mapping: csvMapping, header: csvHeader }
                    : undefined,
            );
            importResult = result;
            // This client's own restore broadcast is self-skipped;
            // refetch the world from the response path.
            await refetchAllStores();
        } catch (error) {
            importError =
                error instanceof HttpClientError
                    ? parseImportError(error)
                    : 'Import failed -- check that the server is reachable.';
        } finally {
            importing = false;
        }
    }

    function parseImportError(error: HttpClientError): string {
        try {
            const body = JSON.parse(String(error.body ?? '')) as { error?: string };
            if (body.error) return `Import rejected: ${body.error}`;
        } catch {
            // fall through to the generic message
        }
        return 'Import failed -- the document could not be processed.';
    }
</script>

<Modal title="Settings" onclose={onclose}>
    <div class="settings">
        <fieldset class="section">
            <legend class="section-heading">Time</legend>
            <label class="field">
                <span class="label" id="time-format-label">Time format</span>
                <select class="select" value={timeFormat} onchange={handleTimeFormatChange} aria-labelledby="time-format-label" id="time-format-select">
                    <option value="12h">12-hour (08:53 PM)</option>
                    <option value="24h">24-hour (20:53)</option>
                </select>
            </label>
            <label class="field">
                <span class="label" id="tz-label">Timezone</span>
                <input
                    class="select tz-input"
                    list="tz-options"
                    id="tz-input"
                    value={timezoneInput}
                    oninput={handleTimezoneInput}
                    placeholder="System (device)"
                    aria-labelledby="tz-label"
                    aria-invalid={tzInvalid}
                />
                <datalist id="tz-options">
                    {#each tzOptions as tz}
                        <option value={tz}></option>
                    {/each}
                </datalist>
            </label>
            <span class="hint" class:invalid={tzInvalid}>
                {tzInvalid ? 'Unknown timezone' : tzPreview}
            </span>
            <details class="tz-help">
                <summary>Examples & format</summary>
                <p class="tz-help-text">
                    Use an IANA timezone identifier: <code>Area/Location</code>
                    (case-sensitive). E.g. <code>America/Denver</code>,
                    <code>America/Boise</code>, <code>Europe/London</code>,
                    <code>Asia/Tokyo</code>, <code>Asia/Kolkata</code>,
                    <code>Australia/Sydney</code>, <code>UTC</code>.
                </p>
                <p class="tz-help-text">
                    No abbreviations (MST, PST, EST are ambiguous) and no
                    numeric offsets (use a named zone instead). Leave blank to
                    follow your device's system timezone.
                </p>
                <p class="tz-help-text">
                    Full list:
                    <a href="https://en.wikipedia.org/wiki/List_of_tz_database_time_zones" target="_blank" rel="noopener noreferrer">wikipedia.org &rarr;</a>
                </p>
            </details>
        </fieldset>

        <fieldset class="section">
            <legend class="section-heading">Behavior</legend>
            <label class="checkbox-field">
                <input type="checkbox" checked={rolloverEnabled} onchange={handleRolloverChange} id="rollover-enabled" />
                <span>Auto-rollover incomplete tasks</span>
            </label>
            <label class="checkbox-field">
                <input
                    type="checkbox"
                    checked={showEmptyDays}
                    onchange={handleShowEmptyDaysChange}
                    id="show-empty-days"
                />
                <span>Show empty days (today always shows)</span>
            </label>
            <label class="checkbox-field">
                <input
                    type="checkbox"
                    checked={persistActiveFilters}
                    onchange={handlePersistActiveFiltersChange}
                    id="persist-active-filters"
                />
                <span>Keep filters between sessions (off = start fresh)</span>
            </label>
            {#if rolloverEnabled}
                <label class="field">
                    <span class="label" id="rollover-trigger-label">Rollover time</span>
                    <select class="select" value={rolloverTriggerTime} onchange={handleRolloverTriggerChange} aria-labelledby="rollover-trigger-label" id="rollover-trigger-select">
                        <option value="midnight">At midnight (server time)</option>
                        <option value="9am">At 9am (server time)</option>
                        <option value="manual">Only at server startup</option>
                    </select>
                </label>
            {/if}
            <label class="field">
                <span class="label" id="delete-confirm-label">Delete confirmation</span>
                <select class="select" value={deleteConfirmation} onchange={handleDeleteConfirmationChange} aria-labelledby="delete-confirm-label" id="delete-confirm-select">
                    <option value="instant">Instant delete</option>
                    <option value="confirm">Ask before deleting</option>
                </select>
            </label>
        </fieldset>

        <fieldset class="section">
            <legend class="section-heading">Tags</legend>
            <p class="hint">
                Every tag with its task count. Rename and merge apply to every
                task that carries the tag; recoloring changes chips and filters
                everywhere; removing strips the tag from its tasks (the tasks
                stay).
            </p>
            {#if tagRows.length === 0}
                <p class="hint">No tags yet -- add a #tag to any task and it shows up here.</p>
            {:else}
                <ul class="tag-manage-list">
                    {#each tagRows as row (row.name)}
                        {@const editing = tagEditor?.name === row.name ? tagEditor : null}
                        <li class="tag-manage-row">
                            {#if editing?.kind === 'color'}
                                <div class="tag-color-picker" role="radiogroup" aria-label="Color for #{row.name}">
                                    {#each TAG_COLORS as color (color)}
                                        <button
                                            type="button"
                                            class="color-dot"
                                            class:selected={preferencesStore.tagColors[row.name] === color}
                                            style="background: {TAG_SWATCH_COLORS[color]}"
                                            onclick={() => setTagColor(row.name, color)}
                                            aria-label="#{row.name} in {color}"
                                        ></button>
                                    {/each}
                                    {#if preferencesStore.tagColors[row.name] !== undefined}
                                        <button
                                            type="button"
                                            class="color-dot color-none"
                                            onclick={() => setTagColor(row.name, 'none')}
                                            aria-label="#{row.name} back to the default color"
                                        >
                                            <Icon src={LuTrash2} />
                                        </button>
                                    {/if}
                                </div>
                            {:else}
                                <button
                                    type="button"
                                    class="color-dot current"
                                    style="{row.color ? `background: ${row.color};` : ''}"
                                    onclick={() => openTagEditor(row.name, 'color')}
                                    aria-label="Recolor #{row.name}"
                                ></button>
                            {/if}

                            {#if editing?.kind === 'rename'}
                                <input
                                    class="select tag-rename-input"
                                    bind:value={renameValue}
                                    onkeydown={e => handleRenameKeydown(row.name, e)}
                                    onblur={() => void commitTagRename(row.name)}
                                    aria-label="Rename #{row.name}"
                                    maxlength={60}
                                />
                            {:else}
                                <span class="tag-manage-name">#{row.name}</span>
                                <span class="tag-count">{row.count} task{row.count !== 1 ? 's' : ''}</span>
                            {/if}

                            {#if editing?.kind === 'merge'}
                                <select
                                    class="select tag-merge-select"
                                    bind:value={mergeTarget}
                                    aria-label="Merge #{row.name} into"
                                >
                                    {#each tagRows as other (other.name)}
                                        {#if other.name !== row.name}
                                            <option value={other.name}>#{other.name}</option>
                                        {/if}
                                    {/each}
                                </select>
                                <button type="button" class="btn btn-secondary" onclick={() => void commitTagMerge(row.name)}>
                                    Merge
                                </button>
                                <button type="button" class="btn btn-secondary" onclick={() => (tagEditor = null)}>
                                    Cancel
                                </button>
                            {/if}

                            <div class="tag-actions">
                                <button
                                    type="button"
                                    class="icon-btn small"
                                    onclick={() => openTagEditor(row.name, 'rename')}
                                    aria-label="Rename #{row.name}"
                                >
                                    <Icon src={LuPencil} />
                                </button>
                                <button
                                    type="button"
                                    class="icon-btn small"
                                    disabled={tagRows.length < 2}
                                    onclick={() => openTagEditor(row.name, 'merge')}
                                    aria-label="Merge #{row.name} into another tag"
                                >
                                    <Icon src={LuGitMerge} />
                                </button>
                                <button
                                    type="button"
                                    class="icon-btn small danger"
                                    onclick={() => void deleteTag(row.name)}
                                    aria-label="Remove #{row.name}"
                                >
                                    <Icon src={LuTrash2} />
                                </button>
                            </div>
                        </li>
                    {/each}
                </ul>
            {/if}
            {#if tagError}
                <span class="hint invalid" role="alert">{tagError}</span>
            {/if}
        </fieldset>

        <fieldset class="section">
            <legend class="section-heading">Holidays</legend>
            <p class="hint">
                Named dates display a small banner above that day in the list.
                Import a holiday .ics calendar by URL or file; duplicates are
                skipped automatically.
            </p>
            <div class="holiday-add">
                <input
                    class="holiday-name-input"
                    type="text"
                    placeholder="Holiday name"
                    bind:value={newHolidayName}
                    onkeydown={handleHolidayKeydown}
                    aria-label="Holiday name"
                />
                <input
                    class="select"
                    type="date"
                    bind:value={newHolidayDate}
                    onkeydown={handleHolidayKeydown}
                    aria-label="Holiday date"
                />
                <button
                    type="button"
                    class="btn btn-secondary"
                    onclick={addHoliday}
                    disabled={newHolidayName.trim() === '' || newHolidayDate === ''}
                >
                    Add
                </button>
            </div>
            {#if holidayStore.holidays.length > 0}
                <ul class="holiday-list">
                    {#each holidayStore.holidays as holiday (holiday.id)}
                        <li class="holiday-row">
                            <span class="holiday-date">{holiday.date}</span>
                            <span class="holiday-row-name">{holiday.name}</span>
                            <button
                                class="icon-btn small danger"
                                onclick={() => holidayStore.remove(holiday.id)}
                                aria-label="Delete {holiday.name}"
                            >
                                <Icon src={LuTrash2} />
                            </button>
                        </li>
                    {/each}
                </ul>
            {/if}
            <div class="holiday-import">
                <input
                    class="holiday-url-input"
                    type="url"
                    placeholder="https://example.com/holidays.ics"
                    bind:value={holidayImportUrlInput}
                    aria-label="Holiday calendar URL"
                    onkeydown={(e: KeyboardEvent) => {
                        if (e.key === 'Enter') void importHolidayUrl();
                    }}
                />
                <button
                    type="button"
                    class="btn btn-secondary"
                    onclick={importHolidayUrl}
                    disabled={holidayImporting || holidayImportUrlInput.trim() === ''}
                >
                    {holidayImporting ? 'Importing...' : 'Import URL'}
                </button>
            </div>
            <div class="holiday-import">
                <input
                    type="file"
                    accept=".ics,text/calendar"
                    onchange={importHolidayFile}
                    aria-label="Holiday calendar file"
                    disabled={holidayImporting}
                />
            </div>
            {#if holidayImportSummary}
                <span class="hint" role="status">{holidayImportSummary}</span>
                {#if holidayImportResult && holidayImportResult.warnings.length > 0}
                    <ul class="import-warnings">
                        {#each holidayImportResult.warnings.slice(0, 3) as warning}
                            <li>{warning.message}</li>
                        {/each}
                        {#if holidayImportResult.warnings.length > 3}
                            <li>... and {holidayImportResult.warnings.length - 3} more</li>
                        {/if}
                    </ul>
                {/if}
            {/if}
            {#if holidayError}
                <span class="hint invalid" role="alert">{holidayError}</span>
            {/if}
        </fieldset>

        <fieldset class="section">
            <legend class="section-heading">Export</legend>
            <p class="hint">
                Download your data. JSON is the complete backup (every entity,
                trash included); CSV, Markdown, and iCal are task views.
            </p>
            <div class="export-buttons">
                <button
                    type="button"
                    class="btn btn-secondary"
                    onclick={() => downloadExport('json')}
                    disabled={exporting !== null}
                    aria-label="Download JSON backup"
                >
                    {exporting === 'json' ? 'Exporting...' : 'JSON (backup)'}
                </button>
                <button
                    type="button"
                    class="btn btn-secondary"
                    onclick={() => downloadExport('csv')}
                    disabled={exporting !== null}
                    aria-label="Download CSV export"
                >
                    CSV
                </button>
                <button
                    type="button"
                    class="btn btn-secondary"
                    onclick={() => downloadExport('md')}
                    disabled={exporting !== null}
                    aria-label="Download Markdown export"
                >
                    Markdown
                </button>
                <button
                    type="button"
                    class="btn btn-secondary"
                    onclick={() => downloadExport('ics')}
                    disabled={exporting !== null}
                    aria-label="Download iCal export"
                >
                    iCal
                </button>
            </div>
            {#if exportError}
                <span class="hint invalid" role="alert">{exportError}</span>
            {/if}
        </fieldset>

        <fieldset class="section">
            <legend class="section-heading">Import</legend>
            <p class="hint">
                Restore a JSON backup (replaces everything on this instance) or
                add tasks from CSV, iCal, Todoist, or Things 3.
            </p>
            <label class="field">
                <span class="label" id="import-format-label">Source</span>
                <select
                    class="select"
                    id="import-format-select"
                    value={importFormat}
                    onchange={handleImportFormatChange}
                    aria-labelledby="import-format-label"
                >
                    {#each importFormats as format (format)}
                        <option value={format}>{IMPORT_FORMAT_META[format].label}</option>
                    {/each}
                </select>
            </label>
            <input
                id="import-file-input"
                type="file"
                accept={importAccept[importFormat]}
                onchange={handleImportFile}
                aria-label="File to import"
                disabled={importing}
            />
            {#if importFormat === 'csv' && csvHeader !== null}
                <div class="csv-mapping" aria-label="Column mapping">
                    {#each CSV_IMPORT_FIELDS as field (field)}
                        <label class="field">
                            <span class="label">{field}</span>
                            <select
                                class="select"
                                aria-label="CSV column for {field}"
                                value={csvMapping[field] ?? ''}
                                onchange={event =>
                                    setCsvMappingField(field, (event.currentTarget as HTMLSelectElement).value)}
                            >
                                <option value="">(not mapped)</option>
                                {#each csvHeader as column (column)}
                                    <option value={column}>{column}</option>
                                {/each}
                            </select>
                        </label>
                    {/each}
                </div>
            {/if}
            <div>
                <button
                    type="button"
                    class="btn btn-secondary"
                    onclick={runImport}
                    disabled={importing || importSource === null}
                >
                    {#if IMPORT_FORMAT_META[importFormat].restore}
                        {importing ? 'Restoring...' : 'Restore'}
                    {:else}
                        {importing ? 'Importing...' : 'Import'}
                    {/if}
                </button>
            </div>
            {#if importSummary}
                <span class="hint" role="status">{importSummary}</span>
                {#if importResult && importResult.warnings.length > 0}
                    <ul class="import-warnings">
                        {#each importResult.warnings.slice(0, 5) as warning}
                            <li>{warning.source ? `Row ${warning.source}: ` : ''}{warning.message}</li>
                        {/each}
                        {#if importResult.warnings.length > 5}
                            <li>... and {importResult.warnings.length - 5} more</li>
                        {/if}
                    </ul>
                {/if}
            {/if}
            {#if importError}
                <span class="hint invalid" role="alert">{importError}</span>
            {/if}
        </fieldset>

        <section class="section" aria-label="Panel settings">
            <h3 class="section-heading">Panel</h3>
            <p class="hint">Toggle the Someday panel with <kbd>Ctrl</kbd>+<kbd>\</kbd></p>
        </section>
    </div>
</Modal>

<style>
    .settings {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .section h3, .section-heading {
        font-size: 13px;
        font-weight: 600;
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0 0 12px;
    }

    fieldset.section {
        border: none;
        padding: 0;
        margin: 0;
    }

    .field {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    .label {
        font-size: 14px;
        color: var(--color-text);
    }

    .select {
        padding: 6px 12px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-surface-dim);
        color: var(--color-text);
        font-size: 14px;
    }

    .select:focus {
        outline: 2px solid var(--color-accent);
        outline-offset: 2px;
    }

    .checkbox-field {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        cursor: pointer;
        padding: 4px 0;
    }

    .checkbox-field input[type="checkbox"] {
        width: 16px;
        height: 16px;
    }

    .hint {
        font-size: 13px;
        color: var(--color-text-muted);
    }

    .hint.invalid {
        color: var(--color-danger);
    }

    .export-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .holiday-add,
    .holiday-import {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }

    .holiday-name-input,
    .holiday-url-input {
        padding: 6px 12px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-surface-dim);
        color: var(--color-text);
        font-size: 14px;
        flex: 1;
        min-width: 160px;
        box-sizing: border-box;
    }

    .holiday-name-input:focus,
    .holiday-url-input:focus {
        outline: 2px solid var(--color-accent);
        outline-offset: 2px;
    }

    .holiday-list {
        list-style: none;
        margin: 0;
        padding: 0;
        max-height: 200px;
        overflow-y: auto;
    }

    .holiday-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
        border-bottom: 1px solid var(--color-border);
        font-size: 13px;
    }

    .holiday-row .holiday-row-name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .holiday-date {
        font-size: 11px;
        color: var(--color-text-muted);
        font-variant-numeric: tabular-nums;
    }

    .holiday-row .icon-btn :global(svg) {
        width: 14px;
        height: 14px;
    }

    /* -- Tags management (USE-5) ------------------------------------------- */

    .tag-manage-list {
        list-style: none;
        margin: 0;
        padding: 0;
        max-height: 240px;
        overflow-y: auto;
    }

    .tag-manage-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
        border-bottom: 1px solid var(--color-border);
        font-size: 13px;
    }

    .tag-manage-row:last-child {
        border-bottom: none;
    }

    .tag-manage-name {
        color: var(--color-text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .tag-count {
        font-size: 11px;
        color: var(--color-text-muted);
        white-space: nowrap;
    }

    .tag-actions {
        display: flex;
        gap: 2px;
        margin-left: auto;
        flex-shrink: 0;
    }

    .tag-actions .icon-btn :global(svg) {
        width: 14px;
        height: 14px;
    }

    .tag-rename-input {
        flex: 1;
        min-width: 120px;
    }

    .tag-merge-select {
        flex: 1;
        min-width: 120px;
    }

    .color-dot {
        width: 16px;
        height: 16px;
        padding: 0;
        border: 1px solid var(--color-border);
        border-radius: 999px;
        cursor: pointer;
        flex-shrink: 0;
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .color-dot.current {
        /* Uncolored tags show the neutral chip tone. */
        background: var(--color-surface-hover);
    }

    .color-dot:focus-visible {
        outline: 2px solid var(--color-accent);
        outline-offset: 2px;
    }

    .tag-color-picker {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 1;
        flex-wrap: wrap;
    }

    .tag-color-picker .color-dot.selected {
        outline: 2px solid var(--color-accent);
        outline-offset: 2px;
    }

    .color-dot.color-none :global(svg) {
        width: 10px;
        height: 10px;
        color: var(--color-text-muted);
    }

    .csv-mapping {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 8px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
    }

    .import-warnings {
        margin: 4px 0 0;
        padding-left: 18px;
        font-size: 12px;
        color: var(--color-text-muted);
    }

    .tz-input {
        width: 180px;
        font-family: inherit;
        box-sizing: border-box;
    }

    .tz-input[aria-invalid="true"] {
        border-color: var(--color-danger);
    }

    .tz-help {
        margin-top: 4px;
        font-size: 12px;
        color: var(--color-text-muted);
    }

    .tz-help summary {
        cursor: pointer;
        user-select: none;
        color: var(--color-text-secondary);
        padding: 2px 0;
    }

    .tz-help summary:hover {
        color: var(--color-text);
    }

    .tz-help-text {
        margin: 6px 0 8px;
        line-height: 1.5;
    }

    .tz-help code {
        background: var(--color-surface-dim);
        border: 1px solid var(--color-border);
        border-radius: 4px;
        padding: 1px 5px;
        font-family: monospace;
        font-size: 11px;
    }

    .tz-help a {
        color: var(--color-accent);
        text-decoration: none;
    }

    .tz-help a:hover {
        text-decoration: underline;
    }

    kbd {
        background: var(--color-surface-dim);
        border: 1px solid var(--color-border);
        border-radius: 4px;
        padding: 1px 6px;
        font-family: monospace;
        font-size: 12px;
    }
</style>