import type {
    CreateHolidayInput,
    DateProvider,
    Holiday,
    UpdateHolidayInput,
} from '@erledigen/shared';
import type { HolidayRepository } from './HolidayRepository';

export class InMemoryHolidayRepository implements HolidayRepository {
    private holidays: Map<string, Holiday> = new Map();
    private idCounter = 0;

    constructor(private dateProvider: DateProvider) {}

    /** Calendar order: date, then name -- the order banners and the
     *  Summary modal read them in. */
    private sorted(): Holiday[] {
        return Array.from(this.holidays.values()).sort(
            (a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name),
        );
    }

    async findAll(): Promise<Holiday[]> {
        return this.sorted();
    }

    async findById(id: string): Promise<Holiday | null> {
        return this.holidays.get(id) ?? null;
    }

    async findByDate(date: string): Promise<Holiday[]> {
        return this.sorted().filter(h => h.date === date);
    }

    async create(input: CreateHolidayInput): Promise<Holiday> {
        const id = (++this.idCounter).toString();
        const holiday: Holiday = {
            id,
            name: input.name,
            date: input.date,
            createdAt: this.dateProvider.timestamp(),
        };
        this.holidays.set(id, holiday);
        return holiday;
    }

    async replaceAll(holidays: Holiday[]): Promise<void> {
        this.holidays.clear();
        for (const holiday of holidays) {
            this.holidays.set(holiday.id, { ...holiday });
        }
        this.idCounter = holidays.reduce(
            (max, holiday) => Math.max(max, Number.parseInt(holiday.id, 10) || 0),
            0,
        );
    }

    async update(id: string, input: UpdateHolidayInput): Promise<Holiday | null> {
        const existing = this.holidays.get(id);
        if (!existing) return null;
        const updated: Holiday = { ...existing, ...input };
        this.holidays.set(id, updated);
        return updated;
    }

    async delete(id: string): Promise<boolean> {
        return this.holidays.delete(id);
    }
}
