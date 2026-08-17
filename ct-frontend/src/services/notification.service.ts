const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function triggerWelcomeEmail(accessToken: string): Promise<void> {
  try {
    await fetch(`${API_URL}/api/auth/welcome-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    // Non-blocking — registration should succeed even if email fails
  }
}
