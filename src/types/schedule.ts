// src/types/schedule.ts

export type ReportType = 
  | 'reconciliation'
  | 'fuel-issues'
  | 'deliveries'
  | 'fuel-levels'
  | 'fuel-efficiency'
  | 'fuel-limits'
  | 'summary-all';

export type DateWindowPreset = 
  | 'yesterday'
  | 'today'
  | 'last7days'
  | 'last14days'
  | 'last30days'
  | 'monthToDate'
  | 'lastMonth'
  | 'custom';

export type ScheduleFrequency = 
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'monthly';

export type ReportFormat = 'excel' | 'pdf' | 'csv' | 'inlineHtml';

export interface ReportSchedule {
  id: string;
  name: string;
  enabled: boolean;
  
  // Client selection (either specific client name/id or 'ALL')
  clientName: string; // e.g. "Digicel POM" or "ALL"
  clientId?: string;
  
  // Report selection
  reportType: ReportType;
  
  // Date range window
  datePreset: DateWindowPreset;
  customStartDate?: string;
  customEndDate?: string;
  
  // Timing
  time: string; // "HH:MM" 24hr format, e.g. "08:00"
  frequency: ScheduleFrequency;
  weeklyDay?: number; // 0=Sunday, 1=Monday... (for weekly)
  monthlyDay?: number; // 1-31 (for monthly)
  
  // Recipient Emails
  recipients: string[]; // List of receiver email addresses
  ccRecipients?: string[];
  
  // Format options
  formats: ReportFormat[]; // ['excel', 'pdf']
  
  // Metadata
  subjectTemplate?: string;
  customNotes?: string;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  lastRunStatus?: 'success' | 'failed';
  lastRunMessage?: string;
  lastScheduledSlot?: string; // e.g. "2026-09-09_19:19" to track automated scheduled dispatches
}

export interface ScheduleExecutionLog {
  id: string;
  scheduleId?: string;
  scheduleName: string;
  clientName: string;
  reportType: ReportType;
  dateRange: string;
  recipients: string[];
  formats: ReportFormat[];
  status: 'success' | 'failed';
  message: string;
  timestamp: string;
  durationMs?: number;
}
