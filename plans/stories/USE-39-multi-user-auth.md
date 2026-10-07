# USE-39: My tasks are mine (multi-user)

As an app user on a shared instance, I want to log in with a passkey
and see only my tasks, so that a household or team can share one
instance without sharing data.

**Status**: planned
**Version**: v2.2.0

## Acceptance criteria
- [ ] Passwordless auth: passkeys (WebAuthn) primary, magic-link
      email fallback
- [ ] Sessions: short-lived JWTs + refresh rotation; httpOnly
      SameSite cookies, never localStorage
- [ ] All data scoped per user (tasks, projects, lists, preferences)
- [ ] Account deletion purges everything immediately; data
      minimization by design (no name, no phone, no picture)

## Notes

Pre-auth people stay tags (ADR-014); auth is when people become
entities. Runs with HOST-10 (PostgreSQL at scale).