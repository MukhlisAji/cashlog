import type { FastifyInstance } from "fastify";

import type { Env } from "../../config/env.js";
import { authAdmin } from "../../lib/prehandlers.js";
import { getAdminOverview, listAdminUsers } from "./admin.service.js";

export async function adminRoutes(app: FastifyInstance, env: Env) {
  const preHandler = authAdmin(env);

  app.get("/admin/overview", { preHandler }, async () => {
    const data = await getAdminOverview();
    return { success: true, data };
  });

  app.get("/admin/users", { preHandler }, async (request) => {
    const query = request.query as { q?: string; page?: string };
    const data = await listAdminUsers({
      q: query.q,
      page: query.page ? Number(query.page) : 1,
    });
    return { success: true, data };
  });
}
