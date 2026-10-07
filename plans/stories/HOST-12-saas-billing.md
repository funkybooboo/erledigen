# HOST-12: Optional managed hosting (billing), inert when off

As an operator of a self-hosted instance, I want billing to not exist
at all on my instance; as the project's host, I want Stripe billing
on the managed tier, so that both worlds come from one codebase.

**Status**: planned
**Version**: v2.4.0

## Acceptance criteria
- [ ] PaymentAdapter interface in the server; Stripe implements it;
      a no-op adapter for self-hosters
- [ ] BILLING_ENABLED=false removes every billing code path with no
      side effects (default on self-hosted)
- [ ] Stripe Checkout + Customer Portal; webhook signatures verified
      on every event; no card data ever touches the server
- [ ] Free tier limits enforced when billing is on; managed-hosting
      Settings UI only

## Notes

The n8n-shape open-core model (ADR-016 keeps dual licensing open).
Billing is payment processing, not tracking (ADR-019).