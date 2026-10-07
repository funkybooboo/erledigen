# HOST-10: PostgreSQL at scale

As an operator serving many users, I want a PostgreSQL persistence
adapter behind the same repository interfaces, so that the instance
scales horizontally past what SQLite-on-a-volume can serve.

**Status**: planned
**Version**: v2.2.0

## Acceptance criteria
- [ ] PostgreSQL adapter behind the existing repository interfaces
      (ADR-001's clause); migrations/postgresql/ alongside SQLite
- [ ] The contract suites run against it (both-adapter guarantee)
- [ ] Multi-replica documented: shared WS event bus replaces the
      in-process EventBus; job queue survives multiple replicas

## Notes

ADR-018 deferred exactly this to the v2.x arc. SQLite stays the
default for single-operator instances.