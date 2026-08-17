export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface HealthCheck {
  status: "ok" | "degraded";
  service: string;
  version: string;
  timestamp: string;
}
