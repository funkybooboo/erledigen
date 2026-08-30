import type { WsServerMessage } from '@erledigen/shared';
import type { ConnectionManager } from '../adapters/ws/ConnectionManager';
import type { WebSocketServer } from '../adapters/ws/WebSocketServer';
import type { EventBus } from './EventBus';

export class WebSocketManager {
    private wsServer: WebSocketServer;
    private eventBus: EventBus;
    private connectionManager: ConnectionManager;
    private unsubscribe: (() => void) | null = null;

    constructor(
        wsServer: WebSocketServer,
        eventBus: EventBus,
        connectionManager: ConnectionManager,
    ) {
        this.wsServer = wsServer;
        this.eventBus = eventBus;
        this.connectionManager = connectionManager;
    }

    start(): void {
        // Greet each newly connected client with its assigned clientId so it can
        // (a) self-filter echoed events and (b) tag its own HTTP mutations with
        // X-Client-ID so the server doesn't broadcast them back to it. Without
        // this ack the client never learns its id and every create/update echoes
        // back as a duplicate.
        this.connectionManager.onConnect(clientId => {
            this.wsServer.send(clientId, {
                type: 'connection:ack',
                payload: { clientId, serverTime: new Date().toISOString() },
            });
        });

        this.unsubscribe = this.eventBus.onAny((eventType, payload, originClientId) => {
            const message = {
                type: eventType,
                payload,
                ...(originClientId ? { originClientId } : {}),
            } as WsServerMessage;
            this.wsServer.broadcast(message, originClientId);
        });
    }

    stop(): void {
        this.unsubscribe?.();
        this.unsubscribe = null;
        // ConnectionManager exposes no unsubscribe for onConnect; swap in a
        // no-op so a stopped manager stops greeting new connections.
        this.connectionManager.onConnect(() => {});
    }
}
