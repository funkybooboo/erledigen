/**
 * Content negotiation utility
 *
 * Determines whether a response should be JSON or plain text based on the
 * Accept header, honoring q-values and list order per RFC 7231. Plain text
 * is opt-in: the client must prefer `text/plain` over `application/json`.
 *
 * The previous implementation substring-matched "text/plain" anywhere in
 * the header, so axios-based clients (and thus the entire Bruno CLI
 * suite), whose default Accept lists application/json first, text/plain
 * second, and a wildcard third, received PLAIN TEXT for every list
 * endpoint -- and every structured assertion on the response body failed.
 *
 * To get plain text with curl:
 *   curl -H "Accept: text/plain" http://localhost:4000/api/tasks
 */

interface MediaRange {
    /** Lowercased media range: an exact type ("text/plain"), a main-type
     *  wildcard ("text" plus any subtype), or the global wildcard. */
    media: string;
    /** Quality value clamped to 0..1 (default 1). */
    q: number;
    /** Position in the header (for equal-q tie-breaks). */
    position: number;
}

function parseAccept(accept: string): MediaRange[] {
    return accept
        .split(',')
        .map((part, position): MediaRange => {
            const [range, ...params] = part.trim().split(';');
            let q = 1;
            for (const param of params) {
                const [key, value] = param.trim().split('=');
                if (key === 'q') {
                    const parsed = Number(value);
                    if (!Number.isNaN(parsed)) q = Math.min(1, Math.max(0, parsed));
                }
            }
            return { media: (range ?? '').trim().toLowerCase(), q, position };
        })
        .filter(range => range.media !== '');
}

/**
 * Best (highest-q, earliest-listed) match for `type`. Wildcards count:
 * the global wildcard and the type's main-type wildcard both match at
 * their own q and position.
 */
function bestMatch(ranges: MediaRange[], type: string): { q: number; position: number } {
    const mainType = type.split('/')[0] ?? '';
    let best = { q: 0, position: Number.MAX_SAFE_INTEGER };
    for (const range of ranges) {
        const matches =
            range.media === type || range.media === '*/*' || range.media === `${mainType}/*`;
        if (
            matches &&
            (range.q > best.q || (range.q === best.q && range.position < best.position))
        ) {
            best = { q: range.q, position: range.position };
        }
    }
    return best;
}

/**
 * Determine the preferred response format from an Accept header.
 *
 * Rules:
 * - text/plain must be PREFERRED over application/json (higher q-value)
 * - on equal q-values, the type listed first wins
 *   ("text/plain, application/json" -> text; the axios default, which
 *   lists application/json before text/plain, -> json)
 * - absent/empty headers and no-match headers -> json
 */
export function negotiate(accept: string | undefined): 'json' | 'text' {
    if (!accept) return 'json';
    const ranges = parseAccept(accept);
    if (ranges.length === 0) return 'json';

    const text = bestMatch(ranges, 'text/plain');
    const json = bestMatch(ranges, 'application/json');

    if (text.q === 0 && json.q === 0) return 'json';
    if (text.q !== json.q) return text.q > json.q ? 'text' : 'json';
    if (text.q === 0) return 'json';
    // RFC 7231 leaves the order of equal-q ranges unspecified; honoring
    // list order matches common server behavior and keeps an explicit
    // "text/plain, application/json" on text.
    return text.position < json.position ? 'text' : 'json';
}
