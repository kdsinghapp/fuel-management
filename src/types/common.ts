// src/types/common.ts
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FilterParams {
  page?: number;
  pageSize?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  vehicleId?: string;
  vehicleType?: string;
}

export type Status = 'Normal' | 'Warning' | 'Exception' | 'Reconciled' | 'Matched' | 'Unmatched' | 'Active' | 'Inactive';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Administrator' | 'Manager' | 'Viewer';
  status: 'Active' | 'Inactive';
  lastLogin: string;
  createdAt: string;
  updatedAt: string;
}