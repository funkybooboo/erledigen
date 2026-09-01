# API Tests (Bruno)

This directory contains the API tests for the Erledigen application, which are written using [Bruno](https://www.usebruno.com/).

## ⚡️ Quick Start

**Dockerized (recommended)** — builds the test stack and runs the collection against it:

```bash
mise run test-api
```

**Locally** —

1.  **Start the server:**

    ```bash
    bun run server
    ```

2.  **Run the tests:**

    *   **GUI**: Open the Bruno app, open the `tests/api` collection, select the `local` environment, and run the tests.
    *   **CLI**:

        ```bash
        cd tests/api
        bunx @usebruno/cli run . --env local
        ```

## 📚 Learn More

To learn more about our testing strategy and how we use Bruno, check out the [**Testing**](../../docs/devs/standards/testing.md) documentation.