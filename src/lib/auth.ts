// src/lib/auth.ts
import { AuthUser, LoginCredentials, AuthSession } from '@/types/auth';

// Mock user credentials
const MOCK_CREDENTIALS: Record<string, { password: string; user: AuthUser }> = {
  'admin@fuelmaster.com': {
    password: 'admin123',
    user: {
      id: '1',
      name: 'Admin User',
      email: 'admin@fuelmaster.com',
      role: 'Administrator',
    },
  },
  'manager@fuelmaster.com': {
    password: 'manager123',
    user: {
      id: '2',
      name: 'Manager User',
      email: 'manager@fuelmaster.com',
      role: 'Manager',
    },
  },
  'viewer@fuelmaster.com': {
    password: 'viewer123',
    user: {
      id: '3',
      name: 'Viewer User',
      email: 'viewer@fuelmaster.com',
      role: 'Viewer',
    },
  },
};

// Session storage key
const SESSION_KEY = 'fuel_session';

export interface AuthService {
  login(credentials: LoginCredentials): Promise<AuthSession>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<AuthUser | null>;
  isAuthenticated(): Promise<boolean>;
  getSession(): AuthSession | null;
}

class MockAuthService implements AuthService {
  private session: AuthSession | null = null;

  constructor() {
    // Load session from localStorage on client side
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        try {
          this.session = JSON.parse(stored);
        } catch {
          this.session = null;
        }
      }
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthSession> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const userCreds = MOCK_CREDENTIALS[credentials.email];
    if (!userCreds || userCreds.password !== credentials.password) {
      throw new Error('Invalid email or password');
    }

    const session: AuthSession = {
      user: userCreds.user,
      token: `mock-token-${Date.now()}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    this.session = session;
    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      document.cookie = `${SESSION_KEY}=${encodeURIComponent(JSON.stringify(session))}; path=/; max-age=86400; SameSite=Lax`;
    }

    return session;
  }

  async logout(): Promise<void> {
    this.session = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_KEY);
      document.cookie = `${SESSION_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    return this.session?.user || null;
  }

  async isAuthenticated(): Promise<boolean> {
    if (!this.session) return false;
    // Check if session is expired
    return new Date(this.session.expiresAt) > new Date();
  }

  getSession(): AuthSession | null {
    return this.session;
  }
}

export const authService = new MockAuthService();

// Permission system
export const PERMISSIONS = {
  DASHBOARD: {
    VIEW: 'dashboard.view',
  },
  FUEL_LEVELS: {
    VIEW: 'fuel-levels.view',
  },
  DELIVERIES: {
    VIEW: 'deliveries.view',
  },
  FUEL_ISSUES: {
    VIEW: 'fuel-issues.view',
  },
  VEHICLES: {
    VIEW: 'vehicles.view',
  },
  RECONCILIATION: {
    VIEW: 'reconciliation.view',
  },
  REPORTS: {
    VIEW: 'reports.view',
    GENERATE: 'reports.generate',
    DOWNLOAD: 'reports.download',
  },
  USERS: {
    VIEW: 'users.view',
    MANAGE: 'users.manage',
  },
  ROLES: {
    VIEW: 'roles.view',
    MANAGE: 'roles.manage',
  },
};

const ROLE_PERMISSIONS: Record<string, string[]> = {
  Administrator: Object.values(PERMISSIONS).flatMap(p => Object.values(p)),
  Manager: [
    PERMISSIONS.DASHBOARD.VIEW,
    PERMISSIONS.FUEL_LEVELS.VIEW,
    PERMISSIONS.DELIVERIES.VIEW,
    PERMISSIONS.FUEL_ISSUES.VIEW,
    PERMISSIONS.VEHICLES.VIEW,
    PERMISSIONS.RECONCILIATION.VIEW,
    PERMISSIONS.REPORTS.VIEW,
    PERMISSIONS.REPORTS.GENERATE,
    PERMISSIONS.REPORTS.DOWNLOAD,
  ],
  Viewer: [
    PERMISSIONS.DASHBOARD.VIEW,
    PERMISSIONS.FUEL_LEVELS.VIEW,
    PERMISSIONS.DELIVERIES.VIEW,
    PERMISSIONS.FUEL_ISSUES.VIEW,
    PERMISSIONS.VEHICLES.VIEW,
    PERMISSIONS.RECONCILIATION.VIEW,
    PERMISSIONS.REPORTS.VIEW,
  ],
};

export function hasPermission(user: AuthUser | null, permission: string): boolean {
  if (!user) return false;
  const permissions = ROLE_PERMISSIONS[user.role] || [];
  return permissions.includes(permission);
}

export function canAccessRoute(user: AuthUser | null, route: string): boolean {
  const routePermissions: Record<string, string> = {
    '/dashboard': PERMISSIONS.DASHBOARD.VIEW,
    '/fuel-levels': PERMISSIONS.FUEL_LEVELS.VIEW,
    '/deliveries': PERMISSIONS.DELIVERIES.VIEW,
    '/fuel-issues': PERMISSIONS.FUEL_ISSUES.VIEW,
    '/vehicles': PERMISSIONS.VEHICLES.VIEW,
    '/fuel-efficiency-summary': PERMISSIONS.VEHICLES.VIEW,
    '/fuel-limits': PERMISSIONS.VEHICLES.VIEW,
    '/reconciliation': PERMISSIONS.RECONCILIATION.VIEW,
    '/reports': PERMISSIONS.REPORTS.VIEW,
    '/admin/users': PERMISSIONS.USERS.VIEW,
    '/admin/roles': PERMISSIONS.ROLES.VIEW,
  };

  const permission = routePermissions[route];
  if (!permission) return false;
  return hasPermission(user, permission);
}
