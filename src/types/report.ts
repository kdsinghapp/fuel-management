// src/types/report.ts
import { BaseEntity } from './common';

export interface Report extends BaseEntity {
  reportId: string;
  title: string;
  type: 'fuel-transaction' | 'fuel-consumption' | 'delivery' | 'reconciliation' | 'vehicle';
  dateRange: {
    startDate: string;
    endDate: string;
  };
  generatedBy: string;
  status: 'Pending' | 'Generating' | 'Completed' | 'Failed';
  downloadUrl?: string;
}

export interface ReportFilter {
  reportType: string;
  startDate: string;
  endDate: string;
  vehicleId?: string;
}