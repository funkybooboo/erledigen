import type { DayNote } from './dayNote';
import type { Holiday } from './holiday';
import type { ImportResult } from './import';
import type { Project } from './project';
import type { SomeDayGroup } from './someDayGroup';
import type { Task } from './task';

/** Event type -> payload shape for every server-broadcast message.
 *  The single source of truth for both the WsServerMessage union below
 *  and the server-side typed EventBus publishes (a type alias, not an
 *  interface, so it satisfies the bus's Record<string, unknown> map
 *  constraint through TS implicit index signatures). */
export type WsServerEventMap = {
    'connection:ack': ConnectionAckPayload;
    'task:created': { task: Task };
    'task:updated': { task: Task };
    'task:deleted': { id: string };
    'task:restored': { task: Task };
    'tag:renamed': TagRenamedPayload;
    'tag:merged': TagMergedPayload;
    'tag:deleted': TagDeletedPayload;
    'project:created': { project: Project };
    'project:updated': { project: Project };
    'project:deleted': { id: string };
    'someDayGroup:created': { group: SomeDayGroup };
    'someDayGroup:updated': { group: SomeDayGroup };
    'someDayGroup:deleted': { id: string };
    'holiday:created': { holiday: Holiday };
    'holiday:updated': { holiday: Holiday };
    'holiday:deleted': { id: string };
    /** One .ics import creating many holidays at once: the batch
     *  equivalent of holiday:created (per-row events would flood the
     *  broadcast for a typical yearly calendar). */
    'holidays:imported': { holidays: Holiday[] };
    'dayNote:created': { dayNote: DayNote };
    'dayNote:updated': { dayNote: DayNote };
    /** Day notes are addressed by their DATE, not their internal id --
     *  the same key the client uses to upsert and delete. */
    'dayNote:deleted': { date: string };
    'recurringTask:generated': RecurringTaskGeneratedPayload;
    /** Broadcast after a JSON restore replaced ALL application data
     *  (ADR-009): connected clients refetch everything they hold. */
    'data:restored': { restored: ImportResult['restored'] };
    'server:shutdown': ServerShutdownPayload;
};

export type WsServerEventType = keyof WsServerEventMap;

export type WsClientEventType = 'ws:ping';

/** One union member per event type -- structurally identical to the
 *  hand-written union this replaces, now derived from WsServerEventMap so
 *  the payload shapes can never drift from the map. */
export type WsServerMessage = {
    [K in WsServerEventType]: { type: K; payload: WsServerEventMap[K]; originClientId?: string };
}[WsServerEventType];

export interface WsClientMessage {
    type: WsClientEventType;
    payload?: Record<string, unknown>;
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

export interface ConnectionAckPayload {
    clientId: string;
    serverTime: string;
}

export interface ServerShutdownPayload {
    reason: string;
    graceMs: number;
}

export interface TagRenamedPayload {
    from: string;
    to: string;
    updated: number;
}

export interface TagMergedPayload {
    sources: string[];
    target: string;
    updated: number;
}

export interface TagDeletedPayload {
    name: string;
    updated: number;
}

export interface RecurringTaskGeneratedPayload {
    tasks: Task[];
    recurringTaskId: string;
}

export const WS_RECONNECT_BASE_MS = 500;
export const WS_RECONNECT_MAX_MS = 10_000;
export const WS_PING_INTERVAL_MS = 30_000;
