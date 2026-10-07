# HOST-1: Install erledigen from published images

As an operator, I want to install erledigen by pulling prebuilt
container images instead of building from source, so that any host
with a container runtime runs it in minutes.

**Status**: doing
**Version**: v0.10.1

## Acceptance criteria
- [ ] CI builds and pushes the production images (server, client) to
      GHCR, tagged by release (and a floating tag)
- [ ] compose.prod.yaml works with the published images (no local
      build required) and stays the canonical operator path
- [ ] The install docs start with a pull, not a git clone

## Notes

ADR-018: published images are the substrate for every target --
laptop, homelab, cloud.
