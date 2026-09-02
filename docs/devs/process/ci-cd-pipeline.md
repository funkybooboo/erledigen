# CI/CD Pipeline

This document defines the continuous integration and continuous deployment pipeline for the Erledigen project, including quality gates, automated checks, and deployment workflows.

## Philosophy

Our CI/CD approach prioritizes:

- **Automated quality gates** -- no manual approval for checks
- **Fast feedback** -- results in under 5 minutes
- **Fail fast** -- catch errors early in pipeline
- **Reproducible builds** -- same code produces same artifact
- **Safe deployments** -- gradual rollout with monitoring
- **Zero-downtime** -- deploy without service interruption

---

## Pipeline Overview

```
/----------------------------------------------------------\
|                   COMMIT TO BRANCH                       |
\-------------------+--------------------------------------/
                    |
                    v
/----------------------------------------------------------\
|              CONTINUOUS INTEGRATION (CI)                 |
|                                                          |
|  /-----------------\  /-----------------\              |
|  |  Code Quality   |  |  Build & Test   |              |
|  |  - Lint         |  |  - Type check   |              |
|  |  - Format       |  |  - Unit tests   |              |
|  |  - Security     |  |  - Integration  |              |
|  \-----------------/  |  - E2E tests    |              |
|                       |  - API tests    |              |
|                       \-----------------/              |
|                                                          |
|  /-----------------------------------------------------\|
|  |           AI Agent Reviews (planned)                ||
|  |  - Security  - Performance  - Code Quality          ||
|  |  - Test Quality  - Documentation  - Git Quality     ||
|  \-----------------------------------------------------/|
\-------------------+--------------------------------------/
                    |
                    v
/----------------------------------------------------------\
|                   MERGE TO MAIN                          |
\-------------------+--------------------------------------/
                    |
                    v
/----------------------------------------------------------\
|          CONTINUOUS DEPLOYMENT (CD)                      |
|                                                          |
|  Build Production   ->   Deploy Staging   ->   Tests      |
|      Artifact               Auto Deploy       Smoke      |
|                                              Validate    |
|                                                  |       |
|                                                  v       |
|                        Deploy Production (Gradual)       |
|                        10% -> 50% -> 100%                 |
|                                                          |
|                        Monitor & Alert                   |
\----------------------------------------------------------/
```

---

## Quality Gates (ALL MUST PASS)

**RULE**: Merging to main is BLOCKED unless all gates pass.

### 1. Lint & Format (Biome)

```yaml
- name: Check code quality (lint + format)
  run: mise run biome-check
```

**What it checks**: Biome linting + formatting (CI mode, no auto-fix), naming conventions, import organization.
**Failure criteria**: Any linting or formatting difference

### 2. Spell Check, Link Check, Secret Scan

```yaml
- name: Spell check
  run: mise run spellcheck
- name: Verify links
  run: mise run check-links
- name: Scan for secrets
  run: mise run scan-secrets
```

**What it checks**: cspell over the codebase, lychee over markdown/source links, gitleaks over the working tree.
**Failure criteria**: Any unknown word, broken link, or detected secret

### 3. Type Checking

```yaml
- name: Type check
  run: mise run type-check
```

**What it checks**: TypeScript strict mode across all three packages (tsc for shared/server; `svelte-kit sync` + tsc for the client).
**Failure criteria**: Any type error

### 4. Unit Tests

```yaml
- name: Run unit tests
  run: mise run test
```

**What it checks**: All Bun unit tests (shared + server + client) run in a container. Repository contract suites run against BOTH the in-memory and SQLite adapters, so SQL bugs are caught here too.
**Failure criteria**: Any test fails

### 5. E2E Tests (Playwright)

```yaml
- name: Run E2E tests
  run: mise run test-e2e
```

**What it checks**: Browser tests (project `e2e`) + black-box HTTP tests (project `api`) against a self-contained docker test stack (`compose.test.yaml`, `STORAGE_ADAPTER=memory`, bundled Chromium).
**Failure criteria**: Any test fails (1 retry allowed in CI)

### 6. API Tests (Bruno)

```yaml
- name: Run API tests
  run: mise run test-api
```

**What it checks**: The Bruno collection in `tests/api/` against the dockerized test server.
**Failure criteria**: Any request or assertion fails

### 7. Build Validation

```yaml
- name: Build all packages
  run: mise run build
- name: Check client bundle size
  run: |
      CLIENT_SIZE=$(du -sb packages/client/dist 2>/dev/null | cut -f1 || echo "0")
      MAX_SIZE=524288  # 512KB
      ...
```

**What it checks**: All packages compile; client bundle stays under 512KB; Storybook builds (`mise run build-storybook`).
**Failure criteria**: Build failure or bundle over budget

### 8. Security Audit

```yaml
- name: Security audit
  run: mise run security
```

**What it checks**: `bun audit` for known dependency vulnerabilities. This job is `continue-on-error` -- advisories surface for review without blocking merges.
**Failure criteria**: (Non-blocking; reviewed)

### 9. Performance Tests

**Planned** -- no automated performance benchmarks exist yet. The bundle-size gate above is the only performance-adjacent check.

---

## AI Agent Integration

**Planned** - AI-agent code reviews are not implemented yet. The intent: agents
post PR comments with a score, issues found, and a decision
(AUTO-APPROVE / REQUEST-CHANGES / MANUAL-REVIEW), and do not block merges
initially. Prompts would live in an `.ai-agents/` folder when implemented.

---

## GitHub Actions Workflow

The real workflow lives in [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml)
and is mirrored locally by `mise run ci`. Every job installs mise (which pins
Bun/lychee/gitleaks) and dependencies via `mise run install-ci` (frozen
lockfile), then:

| Job | Steps |
|-----|-------|
| `quality-checks` | `biome-check` -> `spellcheck` -> `check-links` -> `scan-secrets` -> `type-check` (<= 10 min) |
| `unit-tests` | `mise run test` (dockerized Bun unit tests) |
| `e2e-tests` | start server + client, then `mise run test-e2e` (Playwright `e2e` + `api` projects against the docker test stack); report uploaded as artifact on failure |
| `api-tests` | start server, then `mise run test-api` (Bruno) |
| `build` | `mise run build` + client bundle <= 512KB check |
| `storybook-build` | `mise run build-storybook` |
| `security` | `mise run security` (`bun audit`, `continue-on-error`) |
| `all-checks` | gate job - fails if any required job failed or was cancelled |

### Deployment Workflow

**Planned** - no `deploy.yml` exists yet. Erledigen is self-hosted via
`docker compose -f compose.prod.yaml up -d --build` (single published port
behind a Caddy proxy; see the root README). The staging / production /
gradual-rollout strategy described in the sections below is the target design
for when a hosted deployment exists.

---

## Branch Protection Rules

**REQUIRED GitHub settings for `main` branch**:

### Merge Requirements

- [OK] Require pull request before merging
- [OK] Require approvals: **1 minimum**
- [OK] Dismiss stale pull request approvals when new commits pushed
- [OK] Require review from code owners
- [OK] Require approval of the most recent reviewable push

### Status Checks

- [OK] Require status checks to pass before merging
- [OK] Require branches to be up to date before merging
- **Required checks**:
  - `quality-checks` (biome, spellcheck, links, secrets, type-check)
  - `unit-tests` (Bun unit tests incl. repository contract tests)
  - `e2e-tests` (Playwright e2e + api projects)
  - `api-tests` (Bruno collection)
  - `build` (successful build + bundle budget)
  - `storybook-build` (Storybook build)
  - `security` (audit - non-blocking)
  - `all-checks` (aggregate gate)

### Additional Rules

- [OK] Require conversation resolution before merging
- [OK] Require signed commits (recommended)
- [OK] Include administrators (no bypass)
- [OK] Restrict who can push to matching branches
- (x) Allow force pushes: **DISABLED**
- (x) Allow deletions: **DISABLED**

---

## Deployment Strategies

### 1. Staging Environment

**Purpose**: Pre-production validation

**Deployment**:
- Automatic on merge to `main`
- Same infrastructure as production
- Real data anonymized or synthetic

**Validation**:
- Smoke tests run automatically
- Manual QA testing
- Performance monitoring
- Product owner approval

### 2. Production Deployment

**Strategy**: Gradual rollout (canary deployment)

**Steps**:
1. **10% traffic** -- Deploy to 10% of users
   - Monitor error rates
   - Monitor response times
   - Monitor user complaints
   - Duration: 5-10 minutes

2. **50% traffic** -- If healthy, deploy to 50%
   - Continue monitoring
   - Duration: 5-10 minutes

3. **100% traffic** -- If healthy, deploy to all users
   - Final monitoring
   - Announcement to team

**Rollback Criteria** (automatic):
- Error rate > 1%
- Response time > 2x baseline
- Memory usage > 90%
- Critical errors in logs

### 3. Hotfix Deployment

**When**: Critical bugs in production

**Process**:
1. Create hotfix branch from main
2. Fix bug with minimal changes
3. Fast-track code review (1 approval)
4. Run all CI checks
5. Deploy directly to production (skip staging)
6. Monitor closely

---

## Monitoring and Alerting

### Metrics to Monitor

**Application Health**:
- Error rate (target: < 0.1%)
- Response time (target: < 200ms p95)
- Throughput (requests per second)
- Availability (target: 99.9%)

**Infrastructure**:
- CPU usage (target: < 70%)
- Memory usage (target: < 80%)
- Disk usage (target: < 80%)
- Network latency

**Business Metrics**:
- Active users
- Task creation rate
- Task completion rate
- User engagement

### Alerts

**Critical (immediate response)**:
- Service down (availability < 99%)
- Error rate > 5%
- Database connection failures
- Security breach detected

**Warning (review within 1 hour)**:
- Error rate > 1%
- Response time > 500ms
- Memory usage > 85%
- Disk usage > 85%

**Info (review daily)**:
- Error rate > 0.1%
- Response time > 300ms
- Low test coverage on new code
- Dependencies with updates

---

## Rollback Procedures

### Automatic Rollback

Triggered when:
- Error rate exceeds 1% for 5 minutes
- Critical errors detected
- Health checks fail
- Deployment validation fails

### Manual Rollback

```bash
# Revert to previous version
git revert HEAD
git push origin main

# Or rollback deployment
deploy.sh --rollback --version=v1.2.3
```

### Post-Rollback

1. Investigate root cause
2. Fix issue in branch
3. Add tests to prevent recurrence
4. Create new PR
5. Deploy fix

---

## Summary: Deployment Checklist

Before every deployment:

- [ ] All CI checks pass (green)
- [ ] Code reviewed and approved
- [ ] All conversations resolved
- [ ] Documentation updated
- [ ] Database migrations tested
- [ ] Rollback plan documented
- [ ] Monitoring dashboards ready
- [ ] Team notified of deployment
- [ ] Gradual rollout configured
- [ ] Rollback criteria defined

After every deployment:

- [ ] Smoke tests pass
- [ ] Error rates normal
- [ ] Response times normal
- [ ] No user complaints
- [ ] Metrics trending positive
- [ ] Team notified of success
- [ ] Deployment notes documented

---

## Further Reading

- GitHub Actions Documentation: https://docs.github.com/en/actions
- Continuous Delivery: https://continuousdelivery.com/
- Deployment Strategies: https://cloud.google.com/architecture/application-deployment-and-testing-strategies
- Site Reliability Engineering: https://sre.google/books/
