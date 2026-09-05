import { DEFAULT_RATE_LIMIT_RPM } from '@erledigen/shared';
import type { HttpResponse } from './adapters/http/types';
import { container } from './container';
import { createRateLimiterGuard } from './middleware/rateLimiter';
import { createSecurityHeadersMiddleware } from './middleware/securityHeaders';
import { registerAllRoutes } from './routes/index';

const PORT = container.config.getNumber('PORT', 4000);
const NODE_ENV = container.config.get('NODE_ENV', 'production');
const RATE_LIMIT_RPM = container.config.getNumber('RATE_LIMIT_RPM', DEFAULT_RATE_LIMIT_RPM);

const server = container.httpServer;
const logger = container.logger;

// Initialize the storage layer before serving traffic -- opens the SQLite
// database and runs pending migrations (see ADR-003) so a schema failure
// aborts startup instead of surfacing on the first request.
container.initStorage();
logger.info('Storage initialized', { adapter: container.storageAdapter });

// Wire up WebSocket support
server.setConnectionManager(container.connectionManager);
container.wsManager.start();

// Guards run BEFORE the route handler (can short-circuit)
server.addGuard(createRateLimiterGuard(RATE_LIMIT_RPM));

// Middleware runs AFTER the route handler (mutates the response)
server.use(createSecurityHeadersMiddleware(NODE_ENV));

// Root endpoint
server.route('GET', '/', async (): Promise<HttpResponse> => {
    return { status: 200, headers: {}, body: 'Hello from Bun Server!' };
});

// Register all resource routes (health and metrics included; the old
// inline /api/health stub now lives in routes/healthRoutes.ts)
registerAllRoutes(server, container);

await server.start(PORT);
const port = server.getPort();
if (port === null) throw new Error('Server failed to start -- port is null');
logger.info(`Server running at http://localhost:${port}`);
logger.info(`WebSocket available at ws://localhost:${port}`);
logger.info('Startup complete', { nodeEnv: NODE_ENV, rateLimitRpm: RATE_LIMIT_RPM });
