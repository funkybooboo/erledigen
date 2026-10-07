# Notes

Notes are the margin of your calendar -- a place to jot down what a
day or a task is about, without turning it into work items.

## Writing markdown

Notes and task titles render Markdown as you write. Only the line
under your cursor shows the raw syntax; everything else renders live:

```markdown
# Morning

- water **the basil**
- email *Dana* about `the deadline`
- read [the docs](https://example.com)
```

Supported: `# headings`, `**bold**`, `*italic*`, `` `code` ``, fenced
code blocks, `- lists` (with nesting), and `[links](https://...)`.
Links only open for `http`, `https`, and `mailto` addresses.

Everything you type is rendered safely -- HTML stays text, nothing can
inject markup into the page.

## Day notes -- the calendar's margin

Every day in the list has a quiet **note** affordance right under its
header. Click it and write. The note belongs to the day: it is never a
task, it never reorders anything, and it collapses back when you clear
it. Clearing a note (deleting every line) removes it -- the affordance
returns.

## Task notes

Open a task's details (`e` on a focused task, or the details action)
and write in its **Notes** field. Tasks carrying notes show a small
sticky-note marker on their row.

## The Notes view

Press `g n` (or the Notes icon in the rail) for the lens over every
note: day sections in date order, each day's margin note plus the
notes of the tasks on it, and undated (Someday) task notes at the
end. Every entry edits in place, and each can hop back -- to the day
in the list, or to the task's details.

Notes never exist standalone: they always live attached to a day or a
task, and the day-note rides the JSON export backup like every other
part of your data.