// src/types/reconciliation.ts
import { BaseEntity, Status } from './common';

export interface Reconciliation extends BaseEntity {
  date: string;
  openingBalance: number;
  deliveries: number;
  fuelIssues: number;
  expectedClosing: number;
  actualClosing: number;
  variance: number;
  status: 'Reconciled' | 'Warning' | 'Exception';
}

export interface ReconciliationSummary {
  openingBalance: number;
  deliveries: number;
  fuelIssues: number;
  expectedClosing: number;
  actualClosing: number;
  variance: number;
  status: 'Reconciled' | 'Warning' | 'Exception';
}

export interface ReconciliationFilters {
  startDate?: string;
  endDate?: string;
  status?: 'Reconciled' | 'Warning' | 'Exception';
}