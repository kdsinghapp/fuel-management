// src/services/userService.ts
import { User, FilterParams, PaginatedResponse } from '@/types/common';

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
    try {
      const searchParams = new URLSearchParams();
      if (params.search) searchParams.append('search', params.search);
      if (params.status) searchParams.append('status', params.status);
      if (params.role) searchParams.append('role', params.role);
      if (params.page) searchParams.append('page', params.page.toString());
      if (params.pageSize) searchParams.append('pageSize', params.pageSize.toString());

      const res = await fetch(`/api/users?${searchParams.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error('Failed to fetch users from database');
      }
      return await res.json();
    } catch (error) {
      console.error('Error in userService.getUsers:', error);
      return {
        data: [],
        total: 0,
        page: params.page || 1,
        pageSize: params.pageSize || 10,
        totalPages: 0,
      };
    }
  },

  async getUserById(id: string): Promise<User | null> {
    try {
      const res = await fetch(`/api/users/${id}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error('Failed to fetch user');
      }
      return await res.json();
    } catch (error) {
      console.error(`Error in userService.getUserById (${id}):`, error);
      return null;
    }
  },

  async createUser(userData: CreateUserOptions): Promise<{ user: User; emailSent: boolean; emailError?: string }> {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });

    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Failed to create user in database');
    }

    return {
      user: result.user,
      emailSent: result.emailSent || false,
      emailError: result.emailError,
    };
  },

  async updateUser(id: string, userData: Partial<User>): Promise<User | null> {
    const res = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to update user in database');
    }

    return await res.json();
  },

  async deleteUser(id: string): Promise<boolean> {
    const res = await fetch(`/api/users/${id}`, {
      method: 'DELETE',
    });

    return res.ok;
  },

  async sendPasswordResetEmail(email: string, name?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const result = await res.json();
      return { success: res.ok && result.success, error: result.error || result.emailError };
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
