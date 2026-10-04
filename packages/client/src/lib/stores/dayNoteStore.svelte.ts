/**
 * DayNote store (v0.10.0): every day's margin note, live-synced.
 *
 * Not an EntityStore subclass: day notes are keyed by DATE, not id,
 * and the write path is an upsert-by-date -- bending EntityStore's
 * create(id)/update(id) contract around that would read worse than
 * this small purpose-built store. The shape (fetchAll + onServerMessage
 * + logFailure) follows the same conventions.
 */

import type { DayNote, WsServerMessage } from '@erledigen/shared';
import { container } from '$lib/container';
import { DayNoteService } from '$lib/services/dayNoteService';
import { subscribeServerMessages } from './wsSync';

const dayNoteService = new DayNoteService(container.httpClient);

class DayNoteStore {
    /** Date-ordered (the repository sorts; getter for symmetry). */
    items = $state<DayNote[]>([]);

    #wsUnsubscribe: (() => void) | null = null;

    byDate(date: string): DayNote | null {
        return this.items.find(n => n.date === date) ?? null;
    }

    async fetchAll(): Promise<void> {
        try {
            this.items = await dayNoteService.getAll();
        } catch (error) {
            this.logFailure('fetchAll', error);
        }
    }

    async upsert(date: string, notes: string): Promise<DayNote | null> {
        try {
            const dayNote = await dayNoteService.upsert(date, notes);
            this.upsertLocal(dayNote);
            return dayNote;
        } catch (error) {
            this.logFailure('upsert', error);
            return null;
        }
    }

    async remove(date: string): Promise<boolean> {
        try {
            await dayNoteService.delete(date);
            this.items = this.items.filter(n => n.date !== date);
            return true;
        } catch (error) {
            this.logFailure('remove', error);
            return false;
        }
    }

    /** Ingest a server row without duplicating (WS echoes, upserts). */
    upsertLocal(dayNote: DayNote): void {
        this.items = this.items.some(n => n.id === dayNote.id)
            ? this.items.map(n => (n.id === dayNote.id ? dayNote : n))
            : [...this.items, dayNote].sort((a, b) => a.date.localeCompare(b.date));
    }

    initWebSocket(): void {
        this.#wsUnsubscribe = subscribeServerMessages(
            () => this.fetchAll(),
            message => this.onServerMessage(message),
        );
    }

    destroyWebSocket(): void {
        this.#wsUnsubscribe?.();
        this.#wsUnsubscribe = null;
    }

    private onServerMessage(message: WsServerMessage): void {
        switch (message.type) {
            case 'dayNote:created':
            case 'dayNote:updated':
                this.upsertLocal(message.payload.dayNote);
                break;
            case 'dayNote:deleted':
                this.items = this.items.filter(n => n.date !== message.payload.date);
                break;
        }
    }

    private logFailure(operation: string, error: unknown): void {
        container.logger.warn(`dayNote ${operation} failed`, {
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

export const dayNoteStore = new DayNoteStore();
