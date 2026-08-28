import type { FastifyReply, FastifyRequest } from "fastify";

import { getSupabaseAdmin } from "../lib/supabase.js";

export interface AuthenticatedRequest extends FastifyRequest {
  userId: string;
  userEmail?: string;
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return reply.code(503).send({
      success: false,
      error: "Layanan masuk sedang tidak tersedia. Coba lagi sebentar.",
    });
  }

  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return reply.code(401).send({
      success: false,
      error: "Sesi berakhir. Masuk lagi untuk melanjutkan.",
      code: "UNAUTHORIZED",
    });
  }

  const token = authHeader.slice(7);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return reply.code(401).send({
      success: false,
      error: "Sesi berakhir. Masuk lagi untuk melanjutkan.",
      code: "UNAUTHORIZED",
    });
  }

  (request as AuthenticatedRequest).userId = user.id;
  (request as AuthenticatedRequest).userEmail = user.email;
}
