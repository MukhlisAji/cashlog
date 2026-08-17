import { authenticate } from "./auth.middleware.js";
import { requireActiveSubscription } from "./subscription.middleware.js";

/** Authenticated + active subscription required */
export const authWithSubscription = [authenticate, requireActiveSubscription];

/** Authenticated only (e.g. subscription status for expired users) */
export const authOnly = [authenticate];
