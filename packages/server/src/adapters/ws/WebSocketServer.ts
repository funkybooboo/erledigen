import type { WsServerMessage } from '@erledigen/shared';

export interface WebSocketServer {
    broadcast(message: WsServerMessage, excludeClientId?: string): void;
    send(clientId: string, message: WsServerMessage): void;
    getConnectedClientIds(): string[];
}
