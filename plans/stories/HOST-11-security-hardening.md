# HOST-11: Security hardening

As an operator running an internet-exposed instance, I want a
dedicated security hardening pass, so that user data is defended
before authentication and billing land on it.

**Status**: planned
**Version**: v2.4.0

## Acceptance criteria
- [ ] OWASP Top 10 audit of all endpoints; findings remediated
- [ ] Dependency scanning in CI; zero known-vulnerable prod deps
- [ ] CSP tightened to the minimum directive set; subresource
      integrity on external assets
- [ ] Audit logging of write operations (structured, ADR-004),
      stored separately from app data
- [ ] Brute-force protection + stricter rate limits on auth
      endpoints; CORS allowlist in production (never wildcard)
- [ ] Threat model document in docs/host/

## Notes

Runs before the SaaS story (HOST-12) by design.