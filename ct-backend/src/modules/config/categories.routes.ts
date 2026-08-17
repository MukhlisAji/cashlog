import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { AuthenticatedRequest } from "../../lib/auth.middleware.js";
import { checkSubscription } from "../../lib/subscription.js";
import { authOnly, authWithSubscription } from "../../lib/prehandlers.js";
import { categoriesRepository } from "../config/config.repository.js";
import type { FastifyReply } from "fastify";

const updateCategorySchema = z.object({
  keywords: z.string().max(500).optional(),
  color: z.string().max(16).optional(),
  name: z.string().min(1).max(64).optional(),
});

const createCategorySchema = z.object({
  name: z.string().min(1).max(64),
  keywords: z.string().max(500).optional(),
  color: z.string().max(16).optional(),
});

const authChain = authWithSubscription;

async function requireCustomCategories(
  userId: string,
  reply: FastifyReply,
): Promise<boolean> {
  const sub = await checkSubscription(userId);
  if (!sub.canManageCategories) {
    await reply.code(403).send({
      success: false,
      error: "Kategori custom hanya untuk Pro. Upgrade di Pengaturan.",
      code: "PRO_REQUIRED",
    });
    return false;
  }
  return true;
}

export async function categoriesRoutes(app: FastifyInstance) {
  app.get(
    "/categories",
    { preHandler: authOnly },
    async (request) => {
      const { userId } = request as AuthenticatedRequest;
      // Make sure default categories are seeded (happens during sheet setup,
      // but guard here so first read from onboarding dashboard never returns empty).
      const existing = await categoriesRepository.listByUser(userId);
      if (existing.length === 0) {
        await categoriesRepository.seedDefaults(userId);
      }
      const categories = await categoriesRepository.listByUser(userId);
      return { success: true, data: categories };
    },
  );

  app.post(
    "/categories",
    { preHandler: authChain },
    async (request, reply) => {
      const { userId } = request as AuthenticatedRequest;
      if (!(await requireCustomCategories(userId, reply))) return;

      const parsed = createCategorySchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({ success: false, error: "Invalid input" });
      }

      const existing = await categoriesRepository.listByUser(userId);
      if (existing.some((c) => c.name.toLowerCase() === parsed.data.name.toLowerCase())) {
        return reply.code(409).send({ success: false, error: "Kategori sudah ada" });
      }

      const created = await categoriesRepository.create(userId, parsed.data);
      return { success: true, data: created };
    },
  );

  app.patch(
    "/categories/:id",
    { preHandler: authChain },
    async (request, reply) => {
      const { userId } = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      const parsed = updateCategorySchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({ success: false, error: "Invalid input" });
      }

      if (
        parsed.data.name !== undefined &&
        !(await requireCustomCategories(userId, reply))
      ) {
        return;
      }

      const updated = await categoriesRepository.update(
        userId,
        Number(id),
        parsed.data,
      );

      if (!updated) {
        return reply.code(404).send({ success: false, error: "Not found" });
      }

      return { success: true, data: updated };
    },
  );

  app.delete(
    "/categories/:id",
    { preHandler: authChain },
    async (request, reply) => {
      const { userId } = request as AuthenticatedRequest;
      if (!(await requireCustomCategories(userId, reply))) return;

      const { id } = request.params as { id: string };

      const deleted = await categoriesRepository.delete(userId, Number(id));

      if (!deleted) {
        return reply.code(400).send({
          success: false,
          error: "Tidak bisa hapus — minimal 1 kategori harus tersisa",
        });
      }

      return { success: true };
    },
  );
}
