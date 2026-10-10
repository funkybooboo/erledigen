<script lang="ts">
    import Modal from '$lib/components/Modal.svelte';
    import { holidayStore, preferencesStore, refetchAllStores, tagStore, uiStore } from '$lib/stores';
    import { container } from '$lib/container';
    import { ExportService } from '$lib/services/exportService';
    import { HolidayService, type HolidayImportResult } from '$lib/services/holidayService';
    import { ImportService } from '$lib/services/importService';
    import { tagColorVar } from '$lib/tagColors';
    import { currentShortcuts } from '$lib/keybindingActions';
    import {
        bindingConflicts,
        formatBinding,
        isValidBinding,
        SHORTCUTS,
        SHORTCUT_SECTIONS,
        type ShortcutId,
    } from '$lib/keybindings';
    import { canonicalKey } from '$lib/keyboard';
    import { Icon } from 'svelte-icons-pack';
    import { LuGitMerge, LuPencil, LuRotateCcw, LuTrash2 } from 'svelte-icons-pack/lu';
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
        type CsvImportField,
        type ExportFormat,
        type ImportFormat,
        type ImportResult,
        type RolloverTriggerTime,
        type TagColorId,
    } from '@erledigen/shared';
    import { onMount } from 'svelte';
    import { i18nStore } from '$lib/i18n/i18nStore.svelte';
    import type { TranslationKey } from '$lib/i18n/locales';

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

    // Display labels for the shared constant lists ride the locale file
    // (ids stay the API values): import formats + the CSV mapping fields.
    const IMPORT_FORMAT_KEYS: Record<ImportFormat, TranslationKey> = {
        json: 'settings.importFormats.json',
        csv: 'settings.importFormats.csv',
        ics: 'settings.importFormats.ics',
        'todoist-csv': 'settings.importFormats.todoist-csv',
        'things-json': 'settings.importFormats.things-json',
    };
    const CSV_FIELD_KEYS: Record<CsvImportField, TranslationKey> = {
        text: 'settings.csvFields.text',
        notes: 'settings.csvFields.notes',
        date: 'settings.csvFields.date',
        tags: 'settings.csvFields.tags',
        completed: 'settings.csvFields.completed',
        priority: 'settings.csvFields.priority',
        startTime: 'settings.csvFields.startTime',
        endTime: 'settings.csvFields.endTime',
    };

    /** The language's own name, in its own script (what the list shows). */
    function languageName(locale: string): string {
        return new Intl.DisplayNames([locale], { type: 'language' }).of(locale) ?? locale;
    }

    function handleLanguageChange(e: Event) {
        const value = (e.target as HTMLSelectElement).value;
        preferencesStore.setLocale(value);
    }

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
        const time = now.toLocaleTimeString(container.i18n.locale, {
            hour: '2-digit',
            minute: '2-digit',
            hour12: preferencesStore.timeFormat !== '24h',
            ...(tz ? { timeZone: tz } : {}),
        });
        const zoneLabel = (tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone) || 'system';
        return i18nStore.t('settings.timezonePreview', { time, zone: zoneLabel });
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
            result.skipped > 0 ? i18nStore.t('settings.holidaySkippedSuffix', { count: result.skipped }) : '';
        return i18nStore.t('settings.holidayImported', { count: result.holidays.length }) + skipped + '.';
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
            holidayError = i18nStore.t('settings.holidayAddFailed');
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
                    : i18nStore.t('settings.holidayImportFailed');
        } finally {
            holidayImporting = false;
        }
    }

    function parseHolidayImportError(error: HttpClientError): string {
        try {
            const body = JSON.parse(String(error.body ?? '')) as { error?: string };
            if (body.error) return i18nStore.t('settings.holidayImportRejected', { error: body.error });
        } catch {
            // fall through to the generic message
        }
        return i18nStore.t('settings.holidayImportUnprocessable');
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
        if (!ok) tagError = i18nStore.t('settings.tagRenameFailed', { name: from });
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
            i18nStore.t('settings.tagMergeConfirm', {
                source, target, count: sourceCount,
            }),
            i18nStore.t('settings.mergeTag'),
        );
        if (!ok) return;
        const merged = await tagStore.merge([source], target);
        if (!merged) tagError = i18nStore.t('settings.tagMergeFailed', { source, target });
    }

    /** Delete: strip the tag from every task (confirm first). */
    async function deleteTag(name: string) {
        const count = tagStore.tagInfo.find(info => info.name === name)?.count ?? 0;
        const ok = await uiStore.confirm(
            i18nStore.t('settings.tagDeleteConfirm', { name, count }),
            i18nStore.t('settings.remove'),
        );
        if (!ok) return;
        const deleted = await tagStore.delete(name);
        if (!deleted) tagError = i18nStore.t('settings.tagRemoveFailed', { name });
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

    // -- Shortcuts remapping (USE-7) -------------------------------------------

    /** The live registry (defaults + the user's remaps), derived from the
     *  preferences store so remaps re-render the rows immediately. */
    const resolvedShortcuts = $derived(preferencesStore.shortcutRegistry);

    /** Flattened id list in help-table order, with each id's label key
     *  and section key (translated at render; English lives in en.json). */
    const shortcutRows = $derived(
        SHORTCUT_SECTIONS.flatMap(section =>
            section.ids.map(id => ({
                id,
                labelKey: SHORTCUTS[id].labelKey,
                sectionKey: section.titleKey,
            })),
        ),
    );

    /** id -> translated labels of actions whose bindings clash with id's
     *  right now (non-blocking warning: the user may deliberately swap
     *  two). */
    const shortcutConflicts = $derived.by(() => {
        const map = {} as Record<string, string[]>;
        for (const id of Object.keys(resolvedShortcuts) as ShortcutId[]) {
            map[id] = bindingConflicts(resolvedShortcuts, id).map(
                other => i18nStore.t(resolvedShortcuts[other].labelKey),
            );
        }
        return map;
    });

    /** Which row is listening for a new keystroke. */
    let capturingId = $state<ShortcutId | null>(null);
    /** The pending first token of a two-key chord ('g' while the second
     *  key is awaited); the template reads it for the capture hint. */
    let capturePrefix = $state<string | null>(null);

    $effect(() => {
        if (capturingId === null) return;
        const id = capturingId;
        const handler = (e: KeyboardEvent) => handleCaptureKeydown(id, e);
        // Capture phase at window level: the keystroke never reaches the
        // modal (its own Escape close) or the app's global bindings.
        window.addEventListener('keydown', handler, { capture: true });
        return () => window.removeEventListener('keydown', handler, { capture: true });
    });

    function startCapture(id: ShortcutId) {
        capturePrefix = null;
        capturingId = id;
    }

    /** Canonical registry token for a keystroke, or null for combos the
     *  grammar does not express (Ctrl+Alt, Alt). Shifted printable keys
     *  arrive already uppercase (Shift+j -> 'J'). */
    function captureToken(e: KeyboardEvent): string | null {
        if (e.ctrlKey || e.metaKey) {
            if (e.altKey) return null;
            const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
            return e.shiftKey ? `{mod}+Shift+${key}` : `{mod}+${key}`;
        }
        if (e.altKey) return null;
        return canonicalKey(e.key);
    }

    function handleCaptureKeydown(id: ShortcutId, e: KeyboardEvent) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Escape') {
            capturingId = null;
            capturePrefix = null;
            return;
        }
        const token = captureToken(e);
        if (token === null) return;
        if (capturePrefix !== null) {
            commitBinding(id, `${capturePrefix} ${token}`);
            return;
        }
        if (token === 'g') {
            // The registry's chord prefix: one more key completes 'g <k>'.
            capturePrefix = 'g';
            return;
        }
        commitBinding(id, token);
    }

    /** Store the captured binding for `id` (replacing its set) and persist.
     *  Conflicts are allowed -- deliberate swaps are a real use case --
     *  but the row warns about them. */
    function commitBinding(id: ShortcutId, binding: string) {
        capturingId = null;
        capturePrefix = null;
        if (!isValidBinding(binding)) return;
        const overrides = { ...preferencesStore.shortcutOverrides };
        overrides[id] = [binding];
        preferencesStore.setShortcutOverrides(overrides);
    }

    /** Restore one shortcut's default bindings. */
    function resetShortcut(id: ShortcutId) {
        const overrides = { ...preferencesStore.shortcutOverrides };
        delete overrides[id];
        preferencesStore.setShortcutOverrides(overrides);
    }

    /** Restore every default binding at once. */
    function resetAllShortcuts() {
        preferencesStore.setShortcutOverrides({});
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
            exportError = i18nStore.t('settings.exportFailed');
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
            return i18nStore.t('settings.importRestored', {
                tasks: restored?.tasks ?? 0,
                groups: restored?.someDayGroups ?? 0,
                projects: restored?.projects ?? 0,
                recurring: restored?.recurringTasks ?? 0,
                holidays: restored?.holidays ?? 0,
            });
        }
        return i18nStore.t('settings.importedTasks', { count: result.created });
    });

    async function runImport(): Promise<void> {
        const source = importSource;
        if (source === null) return;
        importError = null;
        importResult = null;

        if (IMPORT_FORMAT_META[importFormat].restore) {
            const ok = await uiStore.confirm(
                i18nStore.t('settings.restoreConfirm'),
                i18nStore.t('settings.restore'),
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
                    : i18nStore.t('settings.importFailed');
        } finally {
            importing = false;
        }
    }

    function parseImportError(error: HttpClientError): string {
        try {
            const body = JSON.parse(String(error.body ?? '')) as { error?: string };
            if (body.error) return i18nStore.t('settings.importRejected', { error: body.error });
        } catch {
            // fall through to the generic message
        }
        return i18nStore.t('settings.importUnprocessable');
    }
</script>

<Modal title={i18nStore.t('modal.settings')} onclose={onclose}>
    <div class="settings">
        <fieldset class="section">
            <legend class="section-heading">{i18nStore.t('settings.language')}</legend>
            <label class="field">
                <span class="label" id="language-label">{i18nStore.t('settings.language')}</span>
                <select
                    class="select"
                    id="language-select"
                    value={preferencesStore.locale}
                    onchange={handleLanguageChange}
                    aria-labelledby="language-label"
                >
                    {#each i18nStore.availableLocales as locale (locale)}
                        <option value={locale}>{languageName(locale)}</option>
                    {/each}
                </select>
            </label>
            <p class="hint">{i18nStore.t('settings.languageHint')}</p>
        </fieldset>

        <fieldset class="section">
            <legend class="section-heading">{i18nStore.t('settings.time')}</legend>
            <label class="field">
                <span class="label" id="time-format-label">{i18nStore.t('settings.timeFormat')}</span>
                <select class="select" value={timeFormat} onchange={handleTimeFormatChange} aria-labelledby="time-format-label" id="time-format-select">
                    <option value="12h">{i18nStore.t('settings.time12h')}</option>
                    <option value="24h">{i18nStore.t('settings.time24h')}</option>
                </select>
            </label>
            <label class="field">
                <span class="label" id="tz-label">{i18nStore.t('settings.timezone')}</span>
                <input
                    class="select tz-input"
                    list="tz-options"
                    id="tz-input"
                    value={timezoneInput}
                    oninput={handleTimezoneInput}
                    placeholder={i18nStore.t('settings.timezonePlaceholder')}
                    aria-labelledby="tz-label"
                    aria-invalid={tzInvalid}
                />
                <datalist id="tz-options">
                    {#each tzOptions as tz}
                        <option value={tz}></option>
                    {/each}
                </datalist>
            </label>
            {#if tzInvalid}
                <!-- A dedicated role="alert" span that MOUNTS with the error:
                     screen readers announce it the moment it appears. The
                     preview span below is NOT live, so its every-keystroke
                     updates stay unannounced (USE-12). -->
                <span class="hint invalid" role="alert">{i18nStore.t('settings.timezoneInvalid')}</span>
            {:else}
                <span class="hint">{tzPreview}</span>
            {/if}
            <details class="tz-help">
                <summary>{i18nStore.t('settings.timezoneExamples')}</summary>
                <p class="tz-help-text">
                    {i18nStore.t('settings.tzHelp1')}
                    <code>{i18nStore.t('settings.tzHelp1Code')}</code>
                    {i18nStore.t('settings.tzHelp2')}
                    <code>America/Denver</code>,
                    <code>America/Boise</code>, <code>Europe/London</code>,
                    <code>Asia/Tokyo</code>, <code>Asia/Kolkata</code>,
                    <code>Australia/Sydney</code>, <code>UTC</code>.
                </p>
                <p class="tz-help-text">
                    {i18nStore.t('settings.tzHelp3')}
                </p>
                <p class="tz-help-text">
                    {i18nStore.t('settings.tzHelp4')}
                    <a href="https://en.wikipedia.org/wiki/List_of_tz_database_time_zones" target="_blank" rel="noopener noreferrer">{i18nStore.t('settings.wikipediaLink')} &rarr;</a>
                </p>
            </details>
        </fieldset>

        <fieldset class="section">
            <legend class="section-heading">{i18nStore.t('settings.behavior')}</legend>
            <label class="checkbox-field">
                <input type="checkbox" checked={rolloverEnabled} onchange={handleRolloverChange} id="rollover-enabled" />
                <span>{i18nStore.t('settings.autoRollover')}</span>
            </label>
            <label class="checkbox-field">
                <input
                    type="checkbox"
                    checked={showEmptyDays}
                    onchange={handleShowEmptyDaysChange}
                    id="show-empty-days"
                />
                <span>{i18nStore.t('settings.showEmptyDays')}</span>
            </label>
            <label class="checkbox-field">
                <input
                    type="checkbox"
                    checked={persistActiveFilters}
                    onchange={handlePersistActiveFiltersChange}
                    id="persist-active-filters"
                />
                <span>{i18nStore.t('settings.persistFilters')}</span>
            </label>
            {#if rolloverEnabled}
                <label class="field">
                    <span class="label" id="rollover-trigger-label">{i18nStore.t('settings.rolloverTime')}</span>
                    <select class="select" value={rolloverTriggerTime} onchange={handleRolloverTriggerChange} aria-labelledby="rollover-trigger-label" id="rollover-trigger-select">
                        <option value="midnight">{i18nStore.t('settings.rolloverMidnight')}</option>
                        <option value="9am">{i18nStore.t('settings.rollover9am')}</option>
                        <option value="manual">{i18nStore.t('settings.rolloverManual')}</option>
                    </select>
                </label>
            {/if}
            <label class="field">
                <span class="label" id="delete-confirm-label">{i18nStore.t('settings.deleteConfirmation')}</span>
                <select class="select" value={deleteConfirmation} onchange={handleDeleteConfirmationChange} aria-labelledby="delete-confirm-label" id="delete-confirm-select">
                    <option value="instant">{i18nStore.t('settings.deleteInstant')}</option>
                    <option value="confirm">{i18nStore.t('settings.deleteAsk')}</option>
                </select>
            </label>
        </fieldset>

        <fieldset class="section">
            <legend class="section-heading">{i18nStore.t('settings.tags')}</legend>
            <p class="hint">{i18nStore.t('settings.tagsHint')}</p>
            {#if tagRows.length === 0}
                <p class="hint">{i18nStore.t('settings.tagsEmpty')}</p>
            {:else}
                <ul class="tag-manage-list">
                    {#each tagRows as row (row.name)}
                        {@const editing = tagEditor?.name === row.name ? tagEditor : null}
                        <li class="tag-manage-row">
                            {#if editing?.kind === 'color'}
                                <div class="tag-color-picker" role="radiogroup" aria-label={i18nStore.t('settings.colorForTag', { name: row.name })}>
                                    {#each TAG_COLORS as color (color)}
                                        <button
                                            type="button"
                                            class="color-dot"
                                            class:selected={preferencesStore.tagColors[row.name] === color}
                                            style="background: {TAG_SWATCH_COLORS[color]}"
                                            onclick={() => setTagColor(row.name, color)}
                                            aria-label={i18nStore.t('settings.tagInColor', { name: row.name, color })}
                                        ></button>
                                    {/each}
                                    {#if preferencesStore.tagColors[row.name] !== undefined}
                                        <button
                                            type="button"
                                            class="color-dot color-none"
                                            onclick={() => setTagColor(row.name, 'none')}
                                            aria-label={i18nStore.t('settings.tagDefaultColor', { name: row.name })}
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
                                    aria-label={i18nStore.t('settings.recolorTag', { name: row.name })}
                                ></button>
                            {/if}

                            {#if editing?.kind === 'rename'}
                                <input
                                    class="select tag-rename-input"
                                    bind:value={renameValue}
                                    onkeydown={e => handleRenameKeydown(row.name, e)}
                                    onblur={() => void commitTagRename(row.name)}
                                    aria-label={i18nStore.t('settings.renameTag', { name: row.name })}
                                    maxlength={60}
                                />
                            {:else}
                                <span class="tag-manage-name">#{row.name}</span>
                                <span class="tag-count">{i18nStore.t('settings.tagCount', { count: row.count })}</span>
                            {/if}

                            {#if editing?.kind === 'merge'}
                                <select
                                    class="select tag-merge-select"
                                    bind:value={mergeTarget}
                                    aria-label={i18nStore.t('settings.mergeTagInto', { name: row.name })}
                                >
                                    {#each tagRows as other (other.name)}
                                        {#if other.name !== row.name}
                                            <option value={other.name}>#{other.name}</option>
                                        {/if}
                                    {/each}
                                </select>
                                <button type="button" class="btn btn-secondary" onclick={() => void commitTagMerge(row.name)}>
                                    {i18nStore.t('settings.mergeTag')}
                                </button>
                                <button type="button" class="btn btn-secondary" onclick={() => (tagEditor = null)}>
                                    {i18nStore.t('common.cancel')}
                                </button>
                            {/if}

                            <div class="tag-actions">
                                <button
                                    type="button"
                                    class="icon-btn small"
                                    onclick={() => openTagEditor(row.name, 'rename')}
                                    aria-label={i18nStore.t('settings.renameTag', { name: row.name })}
                                >
                                    <Icon src={LuPencil} />
                                </button>
                                <button
                                    type="button"
                                    class="icon-btn small"
                                    disabled={tagRows.length < 2}
                                    onclick={() => openTagEditor(row.name, 'merge')}
                                    aria-label={i18nStore.t('settings.mergeTagIntoAnother', { name: row.name })}
                                >
                                    <Icon src={LuGitMerge} />
                                </button>
                                <button
                                    type="button"
                                    class="icon-btn small danger"
                                    onclick={() => void deleteTag(row.name)}
                                    aria-label={i18nStore.t('settings.removeTag', { name: row.name })}
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
            <legend class="section-heading">{i18nStore.t('settings.holidays')}</legend>
            <p class="hint">{i18nStore.t('settings.holidaysHint')}</p>
            <div class="holiday-add">
                <input
                    class="holiday-name-input"
                    type="text"
                    placeholder={i18nStore.t('settings.holidayNamePlaceholder')}
                    bind:value={newHolidayName}
                    onkeydown={handleHolidayKeydown}
                    aria-label={i18nStore.t('settings.holidayName')}
                />
                <input
                    class="select"
                    type="date"
                    bind:value={newHolidayDate}
                    onkeydown={handleHolidayKeydown}
                    aria-label={i18nStore.t('settings.holidayDate')}
                />
                <button
                    type="button"
                    class="btn btn-secondary"
                    onclick={addHoliday}
                    disabled={newHolidayName.trim() === '' || newHolidayDate === ''}
                >
                    {i18nStore.t('settings.add')}
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
                                aria-label={i18nStore.t('settings.deleteHoliday', { name: holiday.name })}
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
                    placeholder={i18nStore.t('settings.holidayUrlPlaceholder')}
                    bind:value={holidayImportUrlInput}
                    aria-label={i18nStore.t('settings.holidayUrl')}
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
                    {holidayImporting ? i18nStore.t('settings.importing') : i18nStore.t('settings.importUrl')}
                </button>
            </div>
            <div class="holiday-import">
                <input
                    type="file"
                    accept=".ics,text/calendar"
                    onchange={importHolidayFile}
                    aria-label={i18nStore.t('settings.holidayFile')}
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
                            <li>{i18nStore.t('settings.andMore', { count: holidayImportResult.warnings.length - 3 })}</li>
                        {/if}
                    </ul>
                {/if}
            {/if}
            {#if holidayError}
                <span class="hint invalid" role="alert">{holidayError}</span>
            {/if}
        </fieldset>

        <fieldset class="section">
            <legend class="section-heading">{i18nStore.t('settings.export')}</legend>
            <p class="hint">{i18nStore.t('settings.exportHint')}</p>
            <div class="export-buttons">
                <button
                    type="button"
                    class="btn btn-secondary"
                    onclick={() => downloadExport('json')}
                    disabled={exporting !== null}
                    aria-label={i18nStore.t('settings.downloadJson')}
                >
                    {exporting === 'json' ? i18nStore.t('settings.exporting') : i18nStore.t('settings.jsonBackup')}
                </button>
                <button
                    type="button"
                    class="btn btn-secondary"
                    onclick={() => downloadExport('csv')}
                    disabled={exporting !== null}
                    aria-label={i18nStore.t('settings.csv')}
                >
                    {i18nStore.t('settings.csv')}
                </button>
                <button
                    type="button"
                    class="btn btn-secondary"
                    onclick={() => downloadExport('md')}
                    disabled={exporting !== null}
                    aria-label={i18nStore.t('settings.markdown')}
                >
                    {i18nStore.t('settings.markdown')}
                </button>
                <button
                    type="button"
                    class="btn btn-secondary"
                    onclick={() => downloadExport('ics')}
                    disabled={exporting !== null}
                    aria-label={i18nStore.t('settings.ical')}
                >
                    {i18nStore.t('settings.ical')}
                </button>
            </div>
            {#if exportError}
                <span class="hint invalid" role="alert">{exportError}</span>
            {/if}
        </fieldset>

        <fieldset class="section">
            <legend class="section-heading">{i18nStore.t('settings.import')}</legend>
            <p class="hint">{i18nStore.t('settings.importHint')}</p>
            <label class="field">
                <span class="label" id="import-format-label">{i18nStore.t('settings.source')}</span>
                <select
                    class="select"
                    id="import-format-select"
                    value={importFormat}
                    onchange={handleImportFormatChange}
                    aria-labelledby="import-format-label"
                >
                    {#each importFormats as format (format)}
                        <option value={format}>{i18nStore.t(IMPORT_FORMAT_KEYS[format])}</option>
                    {/each}
                </select>
            </label>
            <input
                id="import-file-input"
                type="file"
                accept={importAccept[importFormat]}
                onchange={handleImportFile}
                aria-label={i18nStore.t('settings.fileToImport')}
                disabled={importing}
            />
            {#if importFormat === 'csv' && csvHeader !== null}
                <div class="csv-mapping" aria-label={i18nStore.t('settings.columnMapping')}>
                    {#each CSV_IMPORT_FIELDS as field (field)}
                        <label class="field">
                            <span class="label">{i18nStore.t(CSV_FIELD_KEYS[field])}</span>
                            <select
                                class="select"
                                aria-label={i18nStore.t('settings.csvColumnFor', { field: i18nStore.t(CSV_FIELD_KEYS[field]) })}
                                value={csvMapping[field] ?? ''}
                                onchange={event =>
                                    setCsvMappingField(field, (event.currentTarget as HTMLSelectElement).value)}
                            >
                                <option value="">{i18nStore.t('settings.notMapped')}</option>
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
                        {importing ? i18nStore.t('settings.restoring') : i18nStore.t('settings.restore')}
                    {:else}
                        {importing ? i18nStore.t('settings.importing') : i18nStore.t('settings.import')}
                    {/if}
                </button>
            </div>
            {#if importSummary}
                <span class="hint" role="status">{importSummary}</span>
                {#if importResult && importResult.warnings.length > 0}
                    <ul class="import-warnings">
                        {#each importResult.warnings.slice(0, 5) as warning}
                            <li>{warning.source ? i18nStore.t('settings.importRowWarning', { source: warning.source }) : ''}{warning.message}</li>
                        {/each}
                        {#if importResult.warnings.length > 5}
                            <li>{i18nStore.t('settings.andMore', { count: importResult.warnings.length - 5 })}</li>
                        {/if}
                    </ul>
                {/if}
            {/if}
            {#if importError}
                <span class="hint invalid" role="alert">{importError}</span>
            {/if}
        </fieldset>

        <section class="section" aria-label={i18nStore.t('settings.panelSettings')}>
            <h3 class="section-heading">{i18nStore.t('settings.panel')}</h3>
            <p class="hint">{i18nStore.t('settings.panelHint')} <kbd>Ctrl</kbd>+<kbd>\</kbd></p>
        </section>

        <fieldset class="section">
            <legend class="section-heading">{i18nStore.t('settings.shortcuts')}</legend>
            <p class="hint">
                {i18nStore.t('settings.shortcutsHint1')}
                {i18nStore.t('settings.shortcutsHint2')}
                <kbd>g</kbd>
                {i18nStore.t('settings.shortcutsHint3')}
                <kbd>g</kbd>
                {i18nStore.t('settings.shortcutsHint4')}
                <kbd>Esc</kbd>
                {i18nStore.t('settings.shortcutsHint5')}
            </p>
            <ul class="shortcut-list">
                {#each shortcutRows as row (row.id)}
                    <li class="shortcut-row">
                        <span class="shortcut-label">{i18nStore.t(row.labelKey)}</span>
                        {#if capturingId === row.id}
                            <button type="button" class="btn btn-secondary capture-hint">
                                {capturePrefix === null ? i18nStore.t('settings.pressKeys') : i18nStore.t('settings.pressSecondKey')}
                            </button>
                        {:else}
                            <button
                                type="button"
                                class="shortcut-binding"
                                onclick={() => startCapture(row.id)}
                                aria-label={i18nStore.t('settings.rebind', { label: i18nStore.t(row.labelKey) })}
                            >
                                {#each resolvedShortcuts[row.id].bindings as binding (binding)}
                                    {#each formatBinding(binding).split(' ') as key (key)}
                                        <kbd>{key}</kbd>
                                    {/each}
                                    <span class="alt" aria-hidden="true">/</span>
                                {/each}
                            </button>
                        {/if}
                        {#if shortcutConflicts[row.id] && shortcutConflicts[row.id].length > 0}
                            <span class="shortcut-warning" role="note">
                                {i18nStore.t('settings.alsoBound', { others: shortcutConflicts[row.id].join(', ') })}
                            </span>
                        {/if}
                        {#if preferencesStore.shortcutOverrides[row.id] !== undefined}
                            <button
                                type="button"
                                class="icon-btn small"
                                onclick={() => resetShortcut(row.id)}
                                aria-label={i18nStore.t('settings.resetShortcut', { label: i18nStore.t(row.labelKey) })}
                            >
                                <Icon src={LuRotateCcw} />
                            </button>
                        {/if}
                    </li>
                {/each}
            </ul>
            {#if Object.keys(preferencesStore.shortcutOverrides).length > 0}
                <div>
                    <button type="button" class="btn btn-secondary" onclick={resetAllShortcuts}>
                        {i18nStore.t('settings.resetAllShortcuts')}
                    </button>
                </div>
            {/if}
        </fieldset>
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
        color: var(--color-text-secondary);
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
        color: var(--color-text-secondary);
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
        color: var(--color-text-secondary);
        white-space: nowrap;
    }

    .tag-actions {
        display: flex;
        gap: 2px;
        margin-inline-start: auto;
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

    /* -- Shortcuts remapping (USE-7) ---------------------------------------- */

    .shortcut-list {
        list-style: none;
        margin: 0;
        padding: 0;
        max-height: 300px;
        overflow-y: auto;
    }

    .shortcut-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
        border-bottom: 1px solid var(--color-border);
        font-size: 13px;
    }

    .shortcut-row:last-child {
        border-bottom: none;
    }

    .shortcut-label {
        flex: 1;
        min-width: 120px;
        color: var(--color-text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .shortcut-binding {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--color-surface-dim);
        border: 1px solid var(--color-border);
        border-radius: 6px;
        padding: 3px 8px;
        cursor: pointer;
        color: var(--color-text-secondary);
        transition: border-color 0.15s;
    }

    .shortcut-binding:hover {
        border-color: var(--color-accent);
        color: var(--color-text);
    }

    .shortcut-binding:focus-visible {
        outline: 2px solid var(--color-accent);
        outline-offset: 2px;
    }

    .shortcut-binding .alt:last-child {
        display: none;
    }

    .shortcut-warning {
        font-size: 11px;
        color: var(--color-warning);
        max-width: 180px;
    }

    .capture-hint {
        font-size: 12px;
        animation: capture-pulse 1s ease-in-out infinite;
    }

    @keyframes capture-pulse {
        50% { opacity: 0.55; }
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
        padding-inline-start: 18px;
        font-size: 12px;
        color: var(--color-text-secondary);
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
        color: var(--color-text-secondary);
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