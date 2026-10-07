# HOST-3: Restart erledigen without dropped requests

As an operator, I want the server to shut down gracefully on SIGTERM,
so that container restarts and rollouts never drop in-flight requests
or leave WebSockets torn down mid-write.

**Status**: done
**Version**: v0.10.1

## Acceptance criteria
- [x] SIGTERM: stop accepting new connections, drain in-flight
      requests, close WebSockets cleanly, close the DB, exit 0
- [x] Docker/k8s termination timeouts respected (terminationGracePeriod)
- [x] A unit/integration test covers the drain path

## Notes

ADR-018. Prerequisite for any orchestrated deployment.
