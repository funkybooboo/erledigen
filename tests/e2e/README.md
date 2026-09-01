# E2E Tests

This directory contains the end-to-end tests for the Erledigen application, which are written using [Playwright](https://playwright.dev/).

## ⚡️ Quick Start

```bash
# Dockerized (recommended): builds the self-contained test stack
mise run test-e2e

# Local: spawns an ephemeral in-memory server + client, then runs the tests
bun run test:e2e
```

If you already have the stack running, you can run the tests without
spawning servers:

```bash
bun run test:e2e:no-server
```

## 📚 Learn More

To learn more about our testing strategy and how we use Playwright, check out the [**Testing**](../../docs/devs/standards/testing.md) documentation.
