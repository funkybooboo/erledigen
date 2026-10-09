/**
 * Script direction for a locale (USE-15): 'rtl' or 'ltr'.
 *
 * Direction rides the SCRIPT, not the language (Kurdish is written in
 * both Arabic and Latin scripts), so the resolution maximizes the
 * locale to its likely script via Intl.Locale and checks that. A
 * language not in the script set is left-to-right -- if a future
 * contributed locale needs it, one script id enters the set (see
 * docs/build/standards/i18n.md).
 */

/** Script ids written right-to-left. */
const RTL_SCRIPTS = new Set([
    'adlm', // Adlam
    'arab', // Arabic
    'hebr', // Hebrew
    'mand', // Mandaic
    'nkoo', // N'Ko
    'rohg', // Hanifi Rohingya
    'samr', // Samaritan
    'syrc', // Syriac
    'thaa', // Thaana
    'yezi', // Yezidi
]);

export function textDirection(locale: string): 'ltr' | 'rtl' {
    try {
        // maximize() fills in the likely script for bare language tags
        // ('ar' -> 'ar-Arab-EG'); explicit scripts survive as written.
        const { script } = new Intl.Locale(locale).maximize();
        if (script !== undefined && RTL_SCRIPTS.has(script.toLowerCase())) {
            return 'rtl';
        }
        return 'ltr';
    } catch {
        // Intl.Locale throws on unparseable input -- not our problem to
        // translate; the layout stays left-to-right.
        return 'ltr';
    }
}
