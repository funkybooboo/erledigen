# HOST-6: Back up and restore my instance

As an operator, I want a documented backup and restore procedure, so
that my data survives host failures and my own mistakes.

**Status**: done
**Version**: v0.10.1

## Acceptance criteria
- [x] docs/host/ documents the two layers: the SQLite volume and the
      app-level JSON snapshot (ADR-008 export)
- [x] The pre-restore safety backup is documented (it already exists)
- [x] A restore walkthrough from a JSON snapshot on a fresh instance
- [x] Volume-level backup guidance for compose and k8s (PVC snapshots)

## Notes

ADR-018, ADR-008, ADR-009. The primitives exist; the runbook is the
missing operator artifact.
