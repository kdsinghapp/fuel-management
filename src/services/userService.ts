// src/services/userService.ts
import { User } from '@/types/common';
import { FilterParams, PaginatedResponse } from '@/types/common';
import { delay, generateId } from '@/lib/utils';

// Local list of users to completely remove @/data dependency
const usersList: User[] = [
  { id: '1', name: 'Admin User', email: 'admin@example.com', role: 'Administrator', status: 'Active', lastLogin: '2026-08-12 08:30:00', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  { id: '2', name: 'Manager User', email: 'manager@example.com', role: 'Manager', status: 'Active', lastLogin: '2026-08-12 07:45:00', createdAt: '2026-01-15T00:00:00Z', updatedAt: '2026-01-15T00:00:00Z' },
  { id: '3', name: 'Viewer User', email: 'viewer@example.com', role: 'Viewer', status: 'Active', assignedClients: ['St Johns Pom', 'Digicel POM'], lastLogin: '2026-08-11 16:20:00', createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z' },
  { id: '4', name: 'John Smith', email: 'john.smith@example.com', role: 'Manager', status: 'Active', lastLogin: '2026-08-12 09:15:00', createdAt: '2026-03-10T00:00:00Z', updatedAt: '2026-03-10T00:00:00Z' },
  { id: '5', name: 'Sarah Johnson', email: 'sarah.johnson@example.com', role: 'Viewer', status: 'Active', assignedClients: ['Paradise Foods HQ', 'Paradise Foods Hanta'], lastLogin: '2026-08-11 14:30:00', createdAt: '2026-04-05T00:00:00Z', updatedAt: '2026-04-05T00:00:00Z' },
  { id: '6', name: 'Mike Wilson', email: 'mike.wilson@example.com', role: 'Manager', status: 'Inactive', lastLogin: '2026-07-20 10:00:00', createdAt: '2026-05-12T00:00:00Z', updatedAt: '2026-05-12T00:00:00Z' },
  { id: '7', name: 'Emily Brown', email: 'emily.brown@example.com', role: 'Viewer', status: 'Active', assignedClients: ['Laga Industries Taraka', 'Laga Industries Gabaka'], lastLogin: '2026-08-10 11:45:00', createdAt: '2026-06-08T00:00:00Z', updatedAt: '2026-06-08T00:00:00Z' },
  { id: '8', name: 'David Lee', email: 'david.lee@example.com', role: 'Administrator', status: 'Active', lastLogin: '2026-08-12 06:30:00', createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z' },
  { id: '9', name: 'Lisa Chen', email: 'lisa.chen@example.com', role: 'Manager', status: 'Active', lastLogin: '2026-08-11 13:15:00', createdAt: '2026-07-15T00:00:00Z', updatedAt: '2026-07-15T00:00:00Z' },
  { id: '10', name: 'Robert Taylor', email: 'robert.taylor@example.com', role: 'Viewer', status: 'Active', assignedClients: ['TWL Lae', 'TWL Hagen'], lastLogin: '2026-08-10 15:30:00', createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' },
];

const USERS_STORAGE_KEY = 'fuel_users_list_store';

function loadUsers(): User[] {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(USERS_STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // fallback
      }
    }
  }
  return [...usersList];
}

function saveUsers(users: User[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }
}

export interface CreateUserOptions {
  name: string;
  email: string;
  role: 'Administrator' | 'Manager' | 'Viewer';
  status: 'Active' | 'Inactive';
  assignedClients?: string[];
  tempPassword?: string;
  sendNotificationEmail?: boolean;
}

export const userService = {
  async getUsers(params: FilterParams = {}): Promise<PaginatedResponse<User>> {
    await delay(200);
    
    let data = loadUsers();
    
    if (params.search) {
      const search = params.search.toLowerCase();
      data = data.filter(user => 
        user.name.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search)
      );
    }
    if (params.status) {
      data = data.filter(user => user.status === params.status);
    }
    
    // Pagination
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedData = data.slice(start, end);
    
    return {
      data: paginatedData,
      total: data.length,
      page,
      pageSize,
      totalPages: Math.ceil(data.length / pageSize),
    };
  },
  
  async getUserById(id: string): Promise<User | null> {
    await delay(150);
    const users = loadUsers();
    return users.find(u => u.id === id) || null;
  },
  
  async createUser(userData: CreateUserOptions): Promise<{ user: User; emailSent: boolean; emailError?: string }> {
    await delay(300);
    const users = loadUsers();
    
    const newUser: User = {
      id: generateId(),
      name: userData.name,
      email: userData.email,
      role: userData.role,
      status: userData.status,
      assignedClients: userData.assignedClients,
      lastLogin: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    users.unshift(newUser);
    saveUsers(users);

    // Register user credentials for login
    try {
      const { authService } = await import('@/lib/auth');
      authService.registerUserCredentials(
        newUser.email,
        newUser.name,
        newUser.role,
        userData.tempPassword || 'Password123!',
        newUser.assignedClients
      );
    } catch (e) {
      console.warn('Could not register in authService:', e);
    }

    let emailSent = false;
    let emailError: string | undefined;

    // Dispatch automatic welcome email from noreply@mastersystems.com.pg
    if (userData.sendNotificationEmail !== false) {
      try {
        const res = await fetch('/api/email/user-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'account_created',
            recipientEmail: newUser.email,
            recipientName: newUser.name,
            role: newUser.role,
            tempPassword: userData.tempPassword,
            assignedClients: newUser.assignedClients,
          }),
        });
        const result = await res.json();
        emailSent = result.success;
        if (!result.success) {
          emailError = result.error || 'Failed to dispatch email';
        }
      } catch (err: any) {
        console.warn('Failed to send user creation email:', err);
        emailError = err?.message || 'Network error while dispatching email';
      }
    }

    return { user: newUser, emailSent, emailError };
  },
  
  async updateUser(id: string, userData: Partial<User>): Promise<User | null> {
    await delay(200);
    const users = loadUsers();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) return null;
    users[index] = { ...users[index], ...userData, updatedAt: new Date().toISOString() };
    saveUsers(users);

    // Update credentials store
    try {
      const { authService } = await import('@/lib/auth');
      authService.registerUserCredentials(
        users[index].email,
        users[index].name,
        users[index].role,
        'Password123!',
        users[index].assignedClients
      );
    } catch (e) {
      // ignore
    }

    return users[index];
  },
  
  async deleteUser(id: string): Promise<boolean> {
    await delay(200);
    const users = loadUsers();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) return false;
    users.splice(index, 1);
    saveUsers(users);
    return true;
  },

  async sendPasswordResetEmail(email: string, name?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/email/user-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'password_reset',
          recipientEmail: email,
          recipientName: name || email.split('@')[0],
        }),
      });
      const result = await res.json();
      return { success: result.success, error: result.error };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error dispatching reset email' };
    }
  },

  async sendWelcomeEmail(user: { name: string; email: string; role: string; tempPassword?: string; assignedClients?: string[] }): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/email/user-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'account_created',
          recipientEmail: user.email,
          recipientName: user.name,
          role: user.role,
          tempPassword: user.tempPassword,
          assignedClients: user.assignedClients,
        }),
      });
      const result = await res.json();
      return { success: result.success, error: result.error };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error dispatching welcome email' };
    }
  },
};
