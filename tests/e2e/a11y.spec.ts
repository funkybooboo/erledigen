/**
 * The automated accessibility audit (USE-13): axe-core over the page
 * and every modal, in both themes, on every e2e run. Zero violations
 * against WCAG 2.1 A/AA is the gate (ADR-022).
 *
 * This sees the machine-detectable share (~30-40%) of the standard;
 * the manual NVDA/VoiceOver protocol is the other half -- see
 * docs/build/standards/accessibility.md.
 *
 * Two timing traps live here:
 * - The shared Modal scales/fades in (150ms) and the completion
 *   flash runs 600ms; mid-animation sampling blends fg+bg at partial
 *   opacity and fabricates contrast failures. Every audit waits for
 *   ALL running animations to finish first (document.getAnimations()).
 * - The rail buttons toggle: clicking the active one closes the modal,
 *   so each surface opens from the known-closed state.
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { cleanup, createGroup, createProject, createTask, uniq } from '../api/helpers';
import { hydrated, modal, SERVER_URL, todayISO } from './util';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Every rail-reachable modal: [rail button label, dialog name]. */
const MODALS: ReadonlyArray<readonly [string, string]> = [
    ['Summary', 'Summary'],
    ['Projects', 'Projects'],
    ['Habits', 'Habits'],
    ['Calendar', 'Calendar'],
    ['Search', 'Search'],
    ['Notes', 'Notes'],
    ['Filter', 'Filter'],
    ['Trash', 'Trash'],
    ['Theme', 'Theme'],
    ['Settings', 'Settings'],
    ['Help', 'Keyboard Shortcuts'],
];

test.afterEach(async ({ request }) => {
    await cleanup(request, SERVER_URL);
});

/** Wait for every CSS animation/transition on the page to finish. */
async function settleAnimations(page: import('@playwright/test').Page): Promise<void> {
    await page.evaluate(() =>
        Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))),
    );
}

/** Audit a surface: zero axe violations against WCAG 2.1 A/AA. */
async function audit(page: import('@playwright/test').Page, surface: string): Promise<void> {
    await settleAnimations(page);
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    const summary = results.violations.map(
        v => `${v.id} (${v.impact}): ${v.help} -> ${v.nodes.map(n => n.target).join(', ')}`,
    );
    expect(summary, `axe violations on ${surface}`).toEqual([]);
}

/** Seed one of each shape so audited surfaces have real content. */
test.beforeEach(async ({ page }) => {
    await createTask(
        page.request,
        { text: `Axe plain ${uniq('t')}`, date: todayISO() },
        SERVER_URL,
    );
    await createTask(
        page.request,
        {
            text: `Axe tagged done ${uniq('t')}`,
            date: todayISO(),
            tags: ['axe'],
            completed: true,
        },
        SERVER_URL,
    );
    await createProject(page.request, { name: `Axe Project ${uniq('p')}` }, SERVER_URL);
    await createGroup(
        page.request,
        { name: `Axe Group ${uniq('g')}`, tag: uniq('audit-group'), position: 0 },
        SERVER_URL,
    );
});

test('the page has no violations (light theme)', async ({ page }) => {
    await hydrated(page);
    await audit(page, 'page light');
});

test('the page has no violations (dark theme)', async ({ page }) => {
    await page.request.patch(`${SERVER_URL}/api/preferences`, { data: { theme: 'dark' } });
    await hydrated(page);
    await audit(page, 'page dark');
});

test('the page with the Someday add-group form open has no violations', async ({ page }) => {
    await hydrated(page);
    await page.getByRole('button', { name: 'Add group' }).click();
    await page.getByLabel('New group name').waitFor();
    await audit(page, 'page + add-group form');
});

test('the task detail modal has no violations', async ({ page }) => {
    await hydrated(page);
    await page.locator('.task-row').first().getByRole('button', { name: 'Task details' }).click();
    await modal(page, 'Task Details').waitFor();
    await audit(page, 'modal Task Details');
});

test('the Habits modal with the create form open has no violations', async ({ page }) => {
    await hydrated(page);
    await page.getByRole('button', { name: 'Habits', exact: true }).click();
    const habits = modal(page, 'Habits');
    await habits.getByRole('button', { name: 'New habit' }).click();
    await habits.getByLabel('Habit name').waitFor();
    await audit(page, 'modal Habits + form');
});

test('the project detail board has no violations', async ({ page }) => {
    await hydrated(page);
    await page.getByRole('button', { name: 'Projects', exact: true }).click();
    const projects = modal(page, 'Projects');
    await projects
        .getByRole('button', { name: /Open project Axe Project/ })
        .first()
        .click();
    await projects.locator('.kanban').waitFor();
    await audit(page, 'modal Projects detail');
});

test('stacked dialogs (Settings + delete confirm) have no violations', async ({ page }) => {
    await hydrated(page);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const settings = modal(page, 'Settings');
    const row = settings.locator('.tag-manage-row', { hasText: '#axe' });
    await row.getByRole('button', { name: 'Remove #axe' }).click();
    await modal(page, 'Confirm').waitFor();
    await audit(page, 'stacked Settings + Confirm');
});

for (const [label, dialogName] of MODALS) {
    test(`the ${dialogName} modal has no violations`, async ({ page }) => {
        await hydrated(page);
        await page.getByRole('button', { name: label, exact: true }).click();
        await modal(page, dialogName).waitFor();
        await audit(page, `modal ${dialogName}`);
    });
}
