import type { I18nAdapter, I18nParams, LocaleMessages } from './I18nAdapter';

/**
 * JSON-file I18n adapter (BUILD-3): the universal implementation of the
 * {@link I18nAdapter} port. Runs in both the browser and Bun -- the locale
 * files are plain JSON, so the same adapter serves the client bundle and
 * the completeness test.
 *
 * FILE FORMAT
 * -----------
 * Each locale is a nested map of strings (LocaleMessages). The dotted
 * path to a leaf is the message key:
 *
 * ```json
 * {
 *   "common": { "save": "Save" },
 *   "settings": { "tags": { "one": "{count} tag", "other": "{count} tags" } }
 * }
 * ```
 *
 * A numeric `count` param selects between plural variants of a key via
 * Intl.PluralRules of the ACTIVE locale; the `en` file's variants are the
 * canonical completeness baseline every other locale must match.
 */

/** Flatten a nested message map into dotted key -> template. */
function flatten(messages: LocaleMessages, prefix = ''): Map<string, string> {
    const flat = new Map<string, string>();
    for (const [key, value] of Object.entries(messages)) {
        const path = prefix === '' ? key : `${prefix}.${key}`;
        if (typeof value === 'string') {
            flat.set(path, value);
        } else if (value !== null && typeof value === 'object') {
            for (const [sub, template] of flatten(value, path)) {
                flat.set(sub, template);
            }
        }
    }
    return flat;
}

/** The builtin prototype members a dotted key could smuggle past a naive
 *  `obj[a][b]` walk; flattened Maps sidestep the prototype entirely. */
const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export class JsonI18nAdapter implements I18nAdapter {
    /** locale id -> dotted key -> template. */
    readonly #messages: Map<string, Map<string, string>>;
    #activeLocale: string;
    readonly #defaultLocale: string;

    /**
     * @param files - locale id -> messages, e.g. `{ en: { ... } }`.
     * @param options - `defaultLocale` ('en' unless stated); unknown
     *        active locales always fall back to it.
     */
    constructor(files: Record<string, LocaleMessages>, options?: { defaultLocale?: string }) {
        this.#messages = new Map(
            Object.entries(files).map(([id, messages]) => [id, flatten(messages)]),
        );
        this.#defaultLocale = options?.defaultLocale ?? 'en';
        this.#activeLocale = this.#messages.has(this.#defaultLocale)
            ? this.#defaultLocale
            : (this.#messages.keys().next().value ?? this.#defaultLocale);
    }

    get locale(): string {
        return this.#activeLocale;
    }

    get defaultLocale(): string {
        return this.#defaultLocale;
    }

    get availableLocales(): readonly string[] {
        return [...this.#messages.keys()];
    }

    setLocale(locale: string): void {
        this.#activeLocale = this.#messages.has(locale) ? locale : this.#defaultLocale;
    }

    /** The template for `key` in the active locale, then the default
     *  locale; undefined when neither carries the key. */
    #template(key: string): string | undefined {
        return (
            this.#messages.get(this.#activeLocale)?.get(key) ??
            this.#messages.get(this.#defaultLocale)?.get(key)
        );
    }

    t(key: string, params?: I18nParams): string {
        if (PROTOTYPE_KEYS.has(key) || key.includes('.__proto__')) {
            return key;
        }
        let template: string | undefined;
        const count = params?.['count'];
        if (typeof count === 'number') {
            // Plural-variant keys first, plain key second: a locale that
            // pluralizes overrides one that does not carry variants.
            const category = new Intl.PluralRules(this.#activeLocale).select(count);
            template = this.#template(`${key}.${category}`) ?? this.#template(key);
        } else {
            template = this.#template(key);
        }
        if (template === undefined) return key;

        if (params === undefined) return template;
        return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
            const value = params[name];
            if (value === undefined) return placeholder;
            return typeof value === 'number' ? this.formatNumber(value) : value;
        });
    }

    formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
        return new Intl.NumberFormat(this.#activeLocale, options).format(value);
    }
}
