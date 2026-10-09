/**
 * Contrast enforcement (USE-11): WCAG 2.1 AA for color.
 *
 * The design tokens live in src/app.css as OKLCH values. This suite
 * parses them straight out of the stylesheet (so a token regression
 * fails here, in CI, before it ever ships) and asserts, for every
 * combination that renders text -- both themes, all three accent
 * schemes, every tag/priority chip -- that the WCAG contrast ratio
 * clears the AA threshold: 4.5:1 for normal text (nothing in the app
 * is "large text"), 3:1 for the non-text focus indicator.
 *
 * The math here is the OKLab -> linear sRGB -> relative luminance
 * chain from the CSS Color 4 spec (the same conversion browsers do
 * for oklch()). The chip pairs reproduce the color-mix(in oklab)
 * formula from tagColors.ts -- keep the percentages in sync:
 *   chip text     = mix(hue 55%, --color-text)
 *   chip pastel   = mix(hue 14%, --color-surface)
 */
import { describe, expect, test } from 'bun:test';

// ------------------------------------------------------------------
// OKLCH -> luminance -> ratio
// ------------------------------------------------------------------

type Oklch = [L: number, C: number, H: number];

function oklchToLinearSrgb([L, C, H]: Oklch): [number, number, number] {
    const rad = (H * Math.PI) / 180;
    const a = C * Math.cos(rad);
    const b = C * Math.sin(rad);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ ** 3;
    const m = m_ ** 3;
    const s = s_ ** 3;
    return [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
}

function luminance(color: Oklch): number {
    const [r, g, b] = oklchToLinearSrgb(color);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio (>= 1). */
export function contrastRatio(fg: Oklch, bg: Oklch): number {
    const y1 = luminance(fg);
    const y2 = luminance(bg);
    const hi = Math.max(y1, y2);
    const lo = Math.min(y1, y2);
    return (hi + 0.05) / (lo + 0.05);
}

/** Interpolation in OKLab space -- what color-mix(in oklab) computes. */
function oklabMix(a: Oklch, b: Oklch, shareOfA: number): Oklch {
    const aRad = (a[2] * Math.PI) / 180;
    const bRad = (b[2] * Math.PI) / 180;
    const aA = a[1] * Math.cos(aRad);
    const aB = a[1] * Math.sin(aRad);
    const bA = b[1] * Math.cos(bRad);
    const bB = b[1] * Math.sin(bRad);
    const l = shareOfA * a[0] + (1 - shareOfA) * b[0];
    const lab = shareOfA * aA + (1 - shareOfA) * bA;
    const lbb = shareOfA * aB + (1 - shareOfA) * bB;
    return [l, Math.hypot(lab, lbb), (Math.atan2(lbb, lab) * 180) / Math.PI];
}

// ------------------------------------------------------------------
// app.css token parser
// ------------------------------------------------------------------

type TokenMap = Record<string, Oklch>;

const css = (await Bun.file(`${import.meta.dir}/../app.css`).text()).replaceAll(
    /\/\*[\s\S]*?\*\//g,
    '',
);

/** Every `{ selector { --token: oklch(...); ... } }` block in the file. */
function parseTokenBlocks(): Map<string, TokenMap> {
    const blocks = new Map<string, TokenMap>();
    let selector = '';
    let body = '';
    let depth = 0;
    for (const ch of css) {
        if (ch === '{') {
            depth++;
            if (depth === 1) {
                selector = body.trim();
                body = '';
                continue;
            }
        } else if (ch === '}') {
            depth--;
            if (depth === 0) {
                const tokens: TokenMap = {};
                const re = /--([a-z0-9-]+):\s*oklch\(([^)]+)\)/g;
                for (const m of body.matchAll(re)) {
                    const parts = m[2].split(/\s+/).map(v => Number.parseFloat(v.replace('%', '')));
                    // --color-surface / --tag-coral -> surface / tag-coral
                    tokens[m[1].replace(/^color-/, '')] = [parts[0] / 100, parts[1], parts[2]];
                }
                const existing = blocks.get(selector) ?? {};
                blocks.set(selector, { ...existing, ...tokens });
                body = '';
                continue;
            }
        }
        body += ch;
    }
    return blocks;
}

const blocks = parseTokenBlocks();

function requireBlock(selector: string): TokenMap {
    const block = blocks.get(selector);
    if (block === undefined) throw new Error(`no ${selector} block in app.css`);
    return block;
}

/** Resolve the token set for one (theme, accent) combination, in
 *  cascade order: :root base, then dark, then the accent scheme. */
function resolve(theme: 'light' | 'dark', accent: 'blue' | 'coral' | 'amber'): TokenMap {
    let tokens = { ...requireBlock(':root') };
    if (theme === 'dark') tokens = { ...tokens, ...requireBlock('[data-theme="dark"]') };
    if (accent !== 'blue') {
        tokens = { ...tokens, ...requireBlock(`[data-accent="${accent}"]`) };
        if (theme === 'dark') {
            tokens = { ...tokens, ...requireBlock(`[data-theme="dark"][data-accent="${accent}"]`) };
        }
    }
    return tokens;
}

// ------------------------------------------------------------------
// The pairs that render text in the app
// ------------------------------------------------------------------

/** Surface family every reading surface sits on. */
const SURFACES = ['surface', 'background', 'surface-hover', 'surface-dim', 'accent-light'];

const TAG_TOKENS = [
    'p1',
    'p2',
    'p3',
    'tag-coral',
    'tag-amber',
    'tag-lime',
    'tag-sage',
    'tag-sky',
    'tag-violet',
    'tag-rose',
    'tag-slate',
];

describe('token contrast (AA, 4.5:1 normal text)', () => {
    for (const theme of ['light', 'dark'] as const) {
        for (const accent of ['blue', 'coral', 'amber'] as const) {
            test(`${theme} theme, ${accent} accent: ink on every surface`, () => {
                const t = resolve(theme, accent);
                for (const ink of ['text', 'text-secondary']) {
                    for (const surface of SURFACES) {
                        const r = contrastRatio(t[ink], t[surface]);
                        expect(
                            r,
                            `${ink} on ${surface} (${theme}/${accent})`,
                        ).toBeGreaterThanOrEqual(4.5);
                    }
                }
            });

            test(`${theme} theme, ${accent} accent: accent and status hues as text`, () => {
                const t = resolve(theme, accent);
                const pairs: Array<[string, string]> = [
                    ['accent', 'surface'],
                    ['accent', 'background'],
                    ['accent', 'accent-light'],
                    ['on-accent', 'accent'],
                    ['danger', 'surface'],
                    ['danger', 'danger-light'],
                    ['success', 'surface'],
                    ['success', 'success-light'],
                    // SectionHeader's "all done" stats sit on the today wash.
                    ['success', 'accent-light'],
                    ['warning', 'surface'],
                    ['warning', 'warning-light'],
                ];
                for (const [fg, bg] of pairs) {
                    const r = contrastRatio(t[fg], t[bg]);
                    expect(r, `${fg} on ${bg} (${theme}/${accent})`).toBeGreaterThanOrEqual(4.5);
                }
            });

            test(`${theme} theme, ${accent} accent: focus indicator is visible (3:1, non-text)`, () => {
                const t = resolve(theme, accent);
                const r = contrastRatio(t['accent'], t['background']);
                expect(
                    r,
                    `focus outline accent on background (${theme}/${accent})`,
                ).toBeGreaterThanOrEqual(3);
            });
        }

        test(`${theme} theme: every tag/priority chip clears AA on its pastel`, () => {
            const t = resolve(theme, 'blue');
            for (const token of TAG_TOKENS) {
                // The formula from tagColors.ts; keep the shares in sync.
                const chipFg = oklabMix(t[token], t['text'], 0.55);
                const chipBg = oklabMix(t[token], t['surface'], 0.14);
                const r = contrastRatio(chipFg, chipBg);
                expect(r, `chip ${token} (${theme})`).toBeGreaterThanOrEqual(4.5);
            }
        });

        test(`${theme} theme: neutral chips (secondary on hover tint) clear AA`, () => {
            const t = resolve(theme, 'blue');
            const r = contrastRatio(t['text-secondary'], t['surface-hover']);
            expect(r, `neutral chip (${theme})`).toBeGreaterThanOrEqual(4.5);
        });
    }
});
