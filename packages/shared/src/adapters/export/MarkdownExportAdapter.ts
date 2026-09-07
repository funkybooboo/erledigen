/**
 * MarkdownExportAdapter -- the day-grouped plain-text task view
 * (`- [ ] text #tags`), readable by humans and any Markdown renderer.
 *
 * A view, not a backup: only ACTIVE tasks; Someday (dateless) tasks land
 * in a final "Someday" section after all date sections.
 */

import type { ExportSnapshot } from '../../types/export';
import { EXPORT_FORMAT_META } from '../../types/export';
import type { Task } from '../../types/task';
import type { ExportAdapter } from './ExportAdapter';

function taskLine(task: Task): string {
    const tags = task.tags.map(tag => ` #${tag}`).join('');
    return `- [${task.completed ? 'x' : ' '}] ${task.text}${tags}`;
}

export class MarkdownExportAdapter implements ExportAdapter {
    readonly extension = EXPORT_FORMAT_META.md.extension;
    readonly contentType = EXPORT_FORMAT_META.md.contentType;

    export(snapshot: ExportSnapshot): string {
        const active = snapshot.tasks.filter(t => t.deletedAt === null);

        // Group by date preserving snapshot order; a Map keyed by date
        // keeps insertion (ascending) order for the section sequence.
        const byDate = new Map<string, Task[]>();
        const someday: Task[] = [];
        for (const task of active) {
            if (task.date === null) {
                someday.push(task);
            } else {
                const bucket = byDate.get(task.date);
                if (bucket) {
                    bucket.push(task);
                } else {
                    byDate.set(task.date, [task]);
                }
            }
        }

        const sections: string[] = [];
        // Sort date sections ascending -- the repositories already return
        // date-ordered tasks, but the adapter must not depend on that.
        const dates = [...byDate.keys()].sort((a, b) => a.localeCompare(b));
        for (const date of dates) {
            sections.push([`## ${date}`, ...(byDate.get(date) ?? []).map(taskLine)].join('\n'));
        }
        if (someday.length > 0) {
            sections.push(['## Someday', ...someday.map(taskLine)].join('\n'));
        }

        return sections.join('\n\n') + (sections.length > 0 ? '\n' : '');
    }
}
