/**
 * The i18n store (v0.13.0): reactive access to the I18nAdapter.
 *
 * The adapter (container.i18n) owns the active locale and message
 * lookup; this store mirrors the locale in $state so that template
 * call-sites re-render when it changes -- every t() call reads
 * this.locale first, which anchors the reactive dependency.
 *
 * Activation flows one way: the preferences store (the single
 * persistence path for UserPreferences.locale) calls apply() on load
 * and on change. This store never imports the preferences store.
 */

import type { I18nParams } from '@erledigen/shared';
import { textDirection } from '@erledigen/shared';
import { container } from '$lib/container';
import { DEFAULT_LOCALE, LOCALE_FILES, type TranslationKey } from './locales';

class I18nStore {
    locale = $state(DEFAULT_LOCALE);

    /** Every locale this build ships a message file for. */
    get availableLocales(): string[] {
        return Object.keys(LOCALE_FILES);
    }

    /** Translate `key` in the active locale (see I18nAdapter.t). */
    t(key: TranslationKey, params?: I18nParams): string {
        void this.locale;
        return container.i18n.t(key, params);
    }

    /**
     * Activate a locale for this session: switch the adapter and set
     * <html lang/dir>. Unknown ids fall back to the default locale, so
     * a persisted-but-unshipped locale can never brick the UI.
     */
    apply(locale: string): void {
        const resolved = locale in LOCALE_FILES ? locale : DEFAULT_LOCALE;
        container.i18n.setLocale(resolved);
        this.locale = resolved;
        document.documentElement.setAttribute('lang', resolved);
        document.documentElement.setAttribute('dir', textDirection(resolved));
    }
}

export const i18nStore = new I18nStore();
