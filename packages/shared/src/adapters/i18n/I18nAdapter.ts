/**
 * I18n adapter interface (BUILD-3, v0.13.0).
 *
 * Translates user-facing strings and formats numbers for the active
 * locale. Locale files are nested JSON maps (see
 * docs/build/standards/i18n.md for the file format and the
 * adding-a-language recipe); this port is implemented by
 * {@link JsonI18nAdapter} in this package and wired through the client
 * container like every other subsystem adapter.
 *
 * Only UI strings ride this port. Date and time DISPLAY stays with the
 * DateProvider (it owns zone + locale formatting), and storage formats
 * (date keys) never localize.
 */

/** One locale's messages: a nested map whose leaves are strings. The
 *  dotted path to a leaf is the message key ('settings.time.heading').
 *  An interface, not a type alias: recursive types must be nominal here. */
export interface LocaleMessages {
    [key: string]: string | LocaleMessages;
}

/** Interpolation params: string values interpolate verbatim; number
 *  values format through Intl.NumberFormat in the active locale. */
export type I18nParams = Record<string, string | number>;

/** The plural categories Intl.PluralRules selects between. A message
 *  key that must pluralize carries one child per needed category
 *  ('tasks.one', 'tasks.other'); t() picks by a numeric `count` param. */
export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

export interface I18nAdapter {
    /** The active locale (a BCP 47 language tag, e.g. 'en'). */
    readonly locale: string;
    /** The fallback locale for keys the active locale misses
     *  ('en' by convention -- the canonical file). */
    readonly defaultLocale: string;
    /** Every locale this build carries a message file for. */
    readonly availableLocales: readonly string[];

    /**
     * Switch the active locale. Unknown ids fall back to the default
     * locale, so a persisted-but-unshipped locale can never brick the UI.
     */
    setLocale(locale: string): void;

    /**
     * Translate `key` (a dotted path into the locale file).
     *
     * - `{name}` placeholders interpolate from params; a placeholder with
     *   no matching param stays verbatim (developer-visible).
     * - A numeric `count` param selects a plural variant: `key.one`,
     *   `key.other`, ... per Intl.PluralRules, formatted via
     *   Intl.NumberFormat. A key without plural variants interpolates
     *   the count into the plain template.
     * - Missing keys fall back to the default locale, then to the raw
     *   key (visible in tests, caught by the completeness gate).
     */
    t(key: string, params?: I18nParams): string;

    /** Format a number in the active locale (Intl.NumberFormat). */
    formatNumber(value: number, options?: Intl.NumberFormatOptions): string;
}
