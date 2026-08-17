import type { FastifyInstance } from "fastify";

import type { HealthCheck } from "../../types/index.js";

const VERSION = "0.1.0";

export async function healthRoutes(app: FastifyInstance) {
  const healthHandler = async (): Promise<HealthCheck> => ({
    status: "ok",
    service: "ct-backend",
    version: VERSION,
    timestamp: new Date().toISOString(),
  });

  app.get(
    "/health",
    { config: { rateLimit: false } },
    healthHandler,
  );

  app.get(
    "/",
    { config: { rateLimit: false } },
    async () => ({
      name: "cashlog.id API",
      version: VERSION,
      docs: "/health",
    }),
  );
}
