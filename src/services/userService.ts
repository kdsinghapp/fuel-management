// src/services/userService.ts
import { User } from '@/types/common';
import { FilterParams, PaginatedResponse } from '@/types/common';
import { delay, generateId } from '@/lib/utils';

// Local list of users to completely remove @/data dependency
const usersList: User[] = [
  { id: '1', name: 'Admin User', email: 'admin@example.com', role: 'Administrator', status: 'Active', lastLogin: '2026-08-12 08:30:00', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  { id: '2', name: 'Manager User', email: 'manager@example.com', role: 'Manager', status: 'Active', lastLogin: '2026-08-12 07:45:00', createdAt: '2026-01-15T00:00:00Z', updatedAt: '2026-01-15T00:00:00Z' },
  { id: '3', name: 'Viewer User', email: 'viewer@example.com', role: 'Viewer', status: 'Active', lastLogin: '2026-08-11 16:20:00', createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z' },
  { id: '4', name: 'John Smith', email: 'john.smith@example.com', role: 'Manager', status: 'Active', lastLogin: '2026-08-12 09:15:00', createdAt: '2026-03-10T00:00:00Z', updatedAt: '2026-03-10T00:00:00Z' },
  { id: '5', name: 'Sarah Johnson', email: 'sarah.johnson@example.com', role: 'Viewer', status: 'Active', lastLogin: '2026-08-11 14:30:00', createdAt: '2026-04-05T00:00:00Z', updatedAt: '2026-04-05T00:00:00Z' },
  { id: '6', name: 'Mike Wilson', email: 'mike.wilson@example.com', role: 'Manager', status: 'Inactive', lastLogin: '2026-07-20 10:00:00', createdAt: '2026-05-12T00:00:00Z', updatedAt: '2026-05-12T00:00:00Z' },
  { id: '7', name: 'Emily Brown', email: 'emily.brown@example.com', role: 'Viewer', status: 'Active', lastLogin: '2026-08-10 11:45:00', createdAt: '2026-06-08T00:00:00Z', updatedAt: '2026-06-08T00:00:00Z' },
  { id: '8', name: 'David Lee', email: 'david.lee@example.com', role: 'Administrator', status: 'Active', lastLogin: '2026-08-12 06:30:00', createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z' },
  { id: '9', name: 'Lisa Chen', email: 'lisa.chen@example.com', role: 'Manager', status: 'Active', lastLogin: '2026-08-11 13:15:00', createdAt: '2026-07-15T00:00:00Z', updatedAt: '2026-07-15T00:00:00Z' },
  { id: '10', name: 'Robert Taylor', email: 'robert.taylor@example.com', role: 'Viewer', status: 'Active', lastLogin: '2026-08-10 15:30:00', createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' },
];

export const userService = {
  async getUsers(params: FilterParams = {}): Promise<PaginatedResponse<User>> {
    await delay(300);
    
    let data = [...usersList];
    
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
    await delay(200);
    return usersList.find(u => u.id === id) || null;
  },
  
  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'lastLogin'>): Promise<User> {
    await delay(300);
    const newUser: User = {
      id: generateId(),
      ...userData,
      lastLogin: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    usersList.push(newUser);
    return newUser;
  },
  
  async updateUser(id: string, userData: Partial<User>): Promise<User | null> {
    await delay(300);
    const index = usersList.findIndex(u => u.id === id);
    if (index === -1) return null;
    usersList[index] = { ...usersList[index], ...userData, updatedAt: new Date().toISOString() };
    return usersList[index];
  },
  
  async deleteUser(id: string): Promise<boolean> {
    await delay(300);
    const index = usersList.findIndex(u => u.id === id);
    if (index === -1) return false;
    usersList.splice(index, 1);
    return true;
  },
};
