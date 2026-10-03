/**
 * WebSocket sync helpers shared by the client stores.
 *
 * Every store that holds server data subscribes to server broadcasts the
 * same way: a `data:restored` message (ADR-009) means a JSON restore
 * replaced every table at once and no per-row event can describe that,
 * so the store refetches whatever it holds; every other message is
 * entity-specific and belongs to the store's own switch.
 */

import type { WsServerMessage } from '@erledigen/shared';
import { websocketService } from '$lib/services/websocketService';

/**
 * Subscribe to server messages with the shared restore handling wired
 * in. `onRestored` runs for `data:restored`; everything else goes to
 * `onMessage`. Returns the unsubscribe function.
 */
export function subscribeServerMessages(
    onRestored: () => void,
    onMessage: (message: WsServerMessage) => void,
): () => void {
    return websocketService.onServerMessage((message: WsServerMessage) => {
        if (message.type === 'data:restored') {
            onRestored();
            return;
        }
        onMessage(message);
    });
}
