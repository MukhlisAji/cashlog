import type { FastifyInstance } from "fastify";

import type { Env } from "../../config/env.js";
import type { AuthenticatedRequest } from "../../lib/auth.middleware.js";
import { sendWelcomeEmailIfNeeded } from "../../lib/email/email.service.js";
import { authOnly } from "../../lib/prehandlers.js";

export async function authRoutes(app: FastifyInstance, env: Env) {
  app.post(
    "/auth/welcome-email",
    { preHandler: authOnly },
    async (request) => {
      const { userId } = request as AuthenticatedRequest;
      const result = await sendWelcomeEmailIfNeeded(env, userId);

      return {
        success: true,
        data: result,
      };
    },
  );
}
