# Keyboard

Everything in Erledigen is reachable from the keyboard -- no action
needs a mouse. The complete binding list lives in the app (press `?`,
or click Help in the rail); this page covers the flows.

The day list is keyboard-first: click any row once (or press `n`) and
the rest is single keys. You can also reach every control by `Tab`
and activate it with `Enter` or `Space` -- every control is a real
button, input, or link.

## The core loop

- `n` -- add a task to today (or `a` in the section you are reading);
  type the text and press `Enter`
- `j` / `k` -- move focus down / up the day list; `J` / `K` jump to
  the next / previous day
- `Space` -- complete the focused task (and uncomplete it)
- `Enter` -- edit the focused task's text in place; `Esc` settles it
- `e` -- open the full task detail (notes, dates, tags, sub-tasks)
- `d` -- delete the focused task; the Undo toast restores it
- `g t` -- jump back to today

## Moving and reshaping without a mouse

The drag handles (task rows, the Someday panel edge) are pointer
conveniences; the keyboard equivalents are the inline editors:

- `r` -- reschedule the focused task: type a date phrase
  (`tomorrow`, `next monday`, `2026-10-15`) or `someday` to move it
  to the Someday panel, then press `Enter`
- `m` -- move a task to another day the same way
- `t` -- edit the focused task's tags
- `1` / `2` / `3` / `0` -- set or clear `#p1`-`#p3` priority

The Someday panel opens and closes with `Ctrl`+`\` (or `Cmd`+`\`).
Inside it, the same `j`/`k` focus and `r`/`m` editors work, and the
"+ add group" and rename controls are plain inputs reached by `Tab`.

## Modals

- `Ctrl+K` or `/` -- search and the command palette
  (`/add <text> tomorrow`, `/go next friday`, `/complete <text>`)
- `g s`, `g p`, `g h`, `g c`, `g n`, `g f`, `g x`, `g o`, `g a` --
  Summary, Projects, Habits, Calendar, Notes, Filter, Trash,
  Settings, Theme
- `Esc` -- close the open dialog and return focus to where you were
- `Tab` cycles inside a dialog (focus never escapes it), and the
  dialog body itself is a focus stop, so long dialogs scroll with the
  arrow keys when nothing else is focused

In the Projects board, every card date has a date field and the
blocked-by control is a picker -- the drag columns are a pointer
shortcut, not the only path. In the Calendar, every day cell is a
button announced by its full date ("October 15, 2026").

## Remapping

Settings > Shortcuts rebinds any of these to your own keys; conflicts
are warned, not blocked. The help modal and every tooltip always show
the live binding.