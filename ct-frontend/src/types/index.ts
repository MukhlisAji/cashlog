export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  whatsappConnected?: boolean;
  authProvider?: "google" | "email";
}

export interface AuthSession {
  user: User;
  accessToken: string;
}

export interface NavLink {
  label: string;
  href: string;
}
