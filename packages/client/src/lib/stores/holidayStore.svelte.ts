import type {
    CreateHolidayInput,
    Holiday,
    UpdateHolidayInput,
    WsServerMessage,
} from '@erledigen/shared';
import { container } from '$lib/container';
import { HolidayService } from '$lib/services/holidayService';
import { EntityStore } from './entityStore.svelte';

const holidayService = new HolidayService(container.httpClient);

class HolidayStore extends EntityStore<Holiday, CreateHolidayInput, UpdateHolidayInput> {
    constructor() {
        super(holidayService);
    }

    /** Holidays in calendar order (the repository already sorts; the
     *  getter exists for reading symmetry with the other stores). */
    get holidays(): Holiday[] {
        return this.items;
    }

    /** Holidays on the given date key, in name order (usually 0-1). */
    holidaysOn(date: string): Holiday[] {
        return this.items.filter(h => h.date === date);
    }

    // The server broadcasts every holiday mutation; without this the
    // day-list banners in another tab go stale until reload. The .ics
    // import broadcasts one batched event instead of a flood of
    // per-row events (a yearly calendar is dozens of rows).
    protected override onServerMessage(message: WsServerMessage): void {
        switch (message.type) {
            case 'holiday:created':
                this.upsert(message.payload.holiday);
                break;
            case 'holiday:updated':
                this.items = this.items.map(h =>
                    h.id === message.payload.holiday.id ? message.payload.holiday : h,
                );
                break;
            case 'holiday:deleted':
                this.items = this.items.filter(h => h.id !== message.payload.id);
                break;
            case 'holidays:imported':
                for (const holiday of message.payload.holidays) {
                    this.upsert(holiday);
                }
                break;
        }
    }
}

export const holidayStore = new HolidayStore();
