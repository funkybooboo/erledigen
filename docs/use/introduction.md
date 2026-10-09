# Introduction

Erledigen is an **automated paper calendar**: a day list you write by hand,
plus an engine that fills in everything that recurs and never moves your
handwriting. It is self-hosted -- your tasks live in your own database, on
your own machine, with no accounts, no analytics, and no telemetry.

The interface is inspired by the clean, simple feel of
[TeuxDeux](https://teuxdeux.com): one continuously scrolling list of days,
and nothing between you and it.

In practice:

*   The **daily list** is where work happens. Days stack and load as you
    scroll; you add and edit inline, and a month minimap on the left keeps
    you oriented.
*   The **Someday panel** is the capture net -- a place on the right for
    everything that is an idea rather than a plan.
*   **Habits** are written once ("water plants every friday at 9am") and
    generate their instances into the daily list on their own schedule.
*   **Notes** are the calendar's margin -- on every day and every task,
    rendered as live markdown while you write.
*   **Tags** are the whole organizational system: priorities, projects,
    and anything else you make up. One filter covers all of it.

Everything syncs live across every open window over WebSocket, and a full
JSON backup of all your data can be exported and restored anywhere.

And the privacy rule needs no footnote: no analytics, no telemetry, no
tracking -- in any deployment mode. [The full promise](./privacy.md).

Read on:

*   [Design](./design.md) -- the product, its data model, and how the
    pieces fit together
*   [Notes](./notes.md) -- day notes, task notes, and markdown everywhere
*   [Export](./export.md) / [Import](./import.md) -- your data, in and out
*   [Privacy](./privacy.md) -- the no-tracking commitment, stated plainly