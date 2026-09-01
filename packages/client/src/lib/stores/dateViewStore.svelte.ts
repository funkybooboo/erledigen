/**
 * Shared view state linking DayList and DateMinimap.
 *
 * DayList is the source of truth for *which dates are currently loaded*
 * (its infinite-scroll window). It publishes that window here so the
 * DateMinimap can draw a viewport indicator over the matching months.
 *
 * Navigation flows the other way: the minimap (or anyone) calls
 * `requestScroll(dateStr)`; DayList watches the request and scrolls that
 * date into view; DateMinimap watches the same request and slides its own
 * window to include the target month.
 *
 * A monotonic `requestId` is bumped on every `requestScroll` call so that
 * repeated requests to the *same* date still re-trigger effects (Svelte
 * won't re-fire an effect when a $state is set to an identical value).
 */
class DateViewStore {
    /** First loaded date key (YYYY-MM-DD) in DayList, inclusive. */
    visibleStart = $state<string | null>(null);
    /** Last loaded date key (YYYY-MM-DD) in DayList, inclusive. */
    visibleEnd = $state<string | null>(null);
    /** Date key currently centered in DayList's viewport (drives minimap highlight). */
    focusedDate = $state<string | null>(null);

    /** Date key the most recent scroll request targeted. */
    pendingScrollTarget = $state<string | null>(null);
    /** Whether the most recent scroll request should also center the
     *  DateMinimap on the target's month (used by "go to today"-style
     *  full resets; ordinary minimap clicks leave the rail scroll alone). */
    centerMinimap = $state(false);
    /** Monotonic counter bumped on every requestScroll so effects re-fire
     *  even when the target date is the same as the previous request. */
    requestId = $state(0);

    setVisible(start: string | null, end: string | null) {
        this.visibleStart = start;
        this.visibleEnd = end;
    }

    setFocusedDate(date: string | null) {
        this.focusedDate = date;
    }

    /** Request DayList (and the minimap) to scroll so `dateStr` is centered.
     *  `centerMinimap` additionally centers the minimap rail on the target's
     *  month instead of merely keeping it on-screen. */
    requestScroll(dateStr: string, centerMinimap = false) {
        this.pendingScrollTarget = dateStr;
        this.centerMinimap = centerMinimap;
        this.requestId++;
    }
}

export const dateViewStore = new DateViewStore();
