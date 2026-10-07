# ADR-016: AGPL-3.0-only License

**Status**: Accepted
**Date**: 2026-10-07

## Context

Erledigen is GPL-3.0 today. The product direction now includes running
it as a hosted service -- the operator role is first-class, and a
managed SaaS is a plausible future revenue path (the n8n model). That
changes what the license must do: it must stay honest open source while
making "take the code, host it commercially, share nothing back"
unattractive.

The decision window is unusually clean: every commit in the repo is
authored by a single person, so any relicense today is a one-party
decision. The first contribution from anyone else lands under the then-
current license and permanently narrows future options -- relicensing
later would require that contributor's consent.

Options considered:

- **GPL-3.0 (status quo)**: anyone can host a commercial instance
  without contributing back. Fine for a personal tool; leaky for a
  hosted-revenue ambition.
- **Sustainable Use / fair-code (n8n)**: revenue-protective, but not
  OSI open source -- costs the OSS badge, community trust, and GitHub's
  open-source ecosystem standing.
- **Dual licensing / open-core**: keep the door open without committing
  now; still available later because the sole author can dual-license
  their own code.
- **AGPL-3.0-only**: true open source, with network-use copyleft --
  anyone offering it as a service over the network must release their
  modifications under AGPL too. The industry's SaaS-defensive OSS choice
  (Grafana, Cal.com, Nextcloud).

## Decision

Erledigen is relicensed from GPL-3.0 to **AGPL-3.0-only**
(`SPDX-License-Identifier: AGPL-3.0-only`):

1. `LICENSE` carries the full GNU Affero GPL v3 text.
2. `REUSE.toml` declares the license for the whole tree (SPDX header
   conventions without per-file churn).
3. Package metadata (`package.json` `license` field) and the README
   badge/section follow.

Dual licensing remains open to the sole author for their own code;
nothing here forecloses a commercial-core split later. New contributors
contribute under AGPL-3.0-only, which is exactly the intent.

## Rationale

AGPL keeps the project genuinely open source (OSI-approved, community
trust, ecosystem tooling) while closing the "quiet commercial fork"
hole GPL leaves for network services. It is the established choice of
the open-source projects that both self-host and run their own hosted
service. Sustainable-Use-style licenses were rejected as inconsistent
with publishing the project as open source at all.

## Consequences

- Anyone hosting a modified erledigen as a network service must publish
  their modifications under AGPL-3.0 -- a competitor can still run it,
  but cannot do so as a closed derivative.
- The README license badge and every "GPL-3.0" reference change.
- No CLA is needed: inbound = outbound = AGPL-3.0-only.
- If a commercial core (`ee/`-style) is ever added, it must live in
  code the sole author has not distributed under AGPL, or under a
  separate agreement -- a future decision.