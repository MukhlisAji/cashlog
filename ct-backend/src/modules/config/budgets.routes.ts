import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { AuthenticatedRequest } from "../../lib/auth.middleware.js";
import { authOnly } from "../../lib/prehandlers.js";
import {
  budgetsRepository,
  userConfigRepository,
} from "../config/config.repository.js";

const upsertBudgetsSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  budgets: z.array(
    z.object({
      category: z.string().min(1).max(64),
      amount: z.number().int().min(0),
    }),
  ),
});

export async function budgetsRoutes(app: FastifyInstance) {
  app.get(
    "/budgets",
    { preHandler: authOnly },
    async (request) => {
      const { userId } = request as AuthenticatedRequest;
      const month =
        (request.query as { month?: string }).month ??
        (await userConfigRepository.getActiveMonth(userId));

      const budgets = await budgetsRepository.listByMonth(userId, month);

      return { success: true, data: { month, budgets } };
    },
  );

  app.put(
    "/budgets",
    { preHandler: authOnly },
    async (request, reply) => {
      const { userId } = request as AuthenticatedRequest;
      const parsed = upsertBudgetsSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          error: "Data budget tidak valid.",
        });
      }

      const month =
        parsed.data.month ??
        (await userConfigRepository.getActiveMonth(userId));

      await budgetsRepository.upsertMany(userId, month, parsed.data.budgets);

      const budgets = await budgetsRepository.listByMonth(userId, month);

      return { success: true, data: { month, budgets } };
    },
  );
}
