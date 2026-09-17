export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'Administrator' | 'Manager' | 'Viewer';
  assignedClients?: string[];
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
  expiresAt: string;
}
