/**
 * In-process pub/sub event bus.
 *
 * Parameterized on an event map (event type -> payload shape): the server
 * wires it with the shared WsServerEventMap, so a publish call site with a
 * typo'd event type -- or a payload that does not match the broadcast
 * contract -- is a compile error instead of a silently unhandled message.
 */

/** Event type -> payload shape. */
export type EventMap = Record<string, unknown>;

export class EventBus<M extends EventMap = EventMap> {
    /** Internal storage stays loose; the public signatures carry the types. */
    private handlers: Map<
        string,
        Set<(eventType: string, payload: unknown, originClientId?: string) => void>
    > = new Map();
    private wildcardHandlers: Set<
        (eventType: string, payload: unknown, originClientId?: string) => void
    > = new Set();

    subscribe<K extends keyof M & string>(
        eventType: K,
        handler: (eventType: K, payload: M[K], originClientId?: string) => void,
    ): () => void {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, new Set());
        }
        // Bridge to the loose internal storage type: the map is keyed by
        // event type, so the payload is by construction M[eventType].
        const bridged = (type: string, payload: unknown, originClientId?: string): void => {
            handler(type as K, payload as M[K], originClientId);
        };
        this.handlers.get(eventType)?.add(bridged);

        return () => {
            this.handlers.get(eventType)?.delete(bridged);
        };
    }

    /** Wildcard handlers see every event; the payload arrives as the union
     *  of all payloads (correlated with `eventType` only at runtime). */
    onAny(
        handler: (
            eventType: keyof M & string,
            payload: M[keyof M & string],
            originClientId?: string,
        ) => void,
    ): () => void {
        // Same storage-bridge as subscribe: every publish call site is
        // payload-checked, so the union payload reaches every handler.
        const bridged = (type: string, payload: unknown, originClientId?: string): void => {
            handler(type as keyof M & string, payload as M[keyof M & string], originClientId);
        };
        this.wildcardHandlers.add(bridged);
        return () => {
            this.wildcardHandlers.delete(bridged);
        };
    }

    publish<K extends keyof M & string>(
        eventType: K,
        payload: M[K],
        originClientId?: string,
    ): void {
        const handlers = this.handlers.get(eventType);
        if (handlers) {
            for (const handler of handlers) {
                handler(eventType, payload, originClientId);
            }
        }
        for (const handler of this.wildcardHandlers) {
            handler(eventType, payload, originClientId);
        }
    }

    clear(): void {
        this.handlers.clear();
        this.wildcardHandlers.clear();
    }
}
