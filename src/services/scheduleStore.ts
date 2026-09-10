// src/services/scheduleStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ReportSchedule, ScheduleExecutionLog, ReportType, DateWindowPreset, ScheduleFrequency, ReportFormat } from '@/types/schedule';

interface ScheduleStore {
  // Drawer visibility & UI state
  isDrawerOpen: boolean;
  activeTab: 'schedules' | 'create' | 'status' | 'logs';
  editingSchedule: ReportSchedule | null;
  openDrawer: (tab?: 'schedules' | 'create' | 'status' | 'logs', schedule?: ReportSchedule | null) => void;
  closeDrawer: () => void;
  setActiveTab: (tab: 'schedules' | 'create' | 'status' | 'logs') => void;
  setEditingSchedule: (schedule: ReportSchedule | null) => void;

  // Schedules state
  schedules: ReportSchedule[];
  logs: ScheduleExecutionLog[];
  isLoading: boolean;
  isSendingTest: boolean;
  lastTestResult: { success: boolean; message: string; data?: any } | null;

  // Actions
  fetchSchedules: () => Promise<void>;
  saveSchedule: (schedule: Partial<ReportSchedule>) => Promise<{ success: boolean; error?: string }>;
  deleteSchedule: (id: string) => Promise<{ success: boolean; error?: string }>;
  toggleSchedule: (id: string) => Promise<void>;
  runScheduleNow: (id: string) => Promise<{ success: boolean; message?: string }>;
  sendTestEmail: (payload: {
    clientName: string;
    reportType: ReportType;
    datePreset: DateWindowPreset;
    customStartDate?: string;
    customEndDate?: string;
    recipients: string[];
    formats: ReportFormat[];
  }) => Promise<{ success: boolean; message: string; error?: string; data?: any }>;
}

export const useScheduleStore = create<ScheduleStore>()(
  persist(
    (set, get) => ({
      isDrawerOpen: false,
      activeTab: 'schedules',
      editingSchedule: null,

      openDrawer: (tab = 'schedules', schedule = null) => {
        set({
          isDrawerOpen: true,
          activeTab: tab,
          editingSchedule: schedule,
          lastTestResult: null,
        });
      },

      closeDrawer: () => {
        set({
          isDrawerOpen: false,
          editingSchedule: null,
        });
      },

      setActiveTab: (tab) => set({ activeTab: tab }),
      setEditingSchedule: (schedule) => set({ editingSchedule: schedule }),

      schedules: [],
      logs: [],
      isLoading: false,
      isSendingTest: false,
      lastTestResult: null,

      fetchSchedules: async () => {
        try {
          set({ isLoading: true });
          const res = await fetch('/api/email/schedules');
          if (res.ok) {
            const data = await res.json();
            if (data.schedules) {
              set({ schedules: data.schedules });
            }
          }
        } catch (err) {
          console.error('Failed to fetch schedules:', err);
        } finally {
          set({ isLoading: false });
        }
      },

      saveSchedule: async (scheduleData) => {
        try {
          set({ isLoading: true });
          const res = await fetch('/api/email/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scheduleData),
          });
          const data = await res.json();
          if (data.success && data.schedules) {
            set({
              schedules: data.schedules,
              editingSchedule: null,
              activeTab: 'schedules',
            });
            return { success: true };
          }
          return { success: false, error: data.error || 'Failed to save schedule' };
        } catch (err: any) {
          return { success: false, error: err?.message || 'Network error saving schedule' };
        } finally {
          set({ isLoading: false });
        }
      },

      deleteSchedule: async (id: string) => {
        try {
          set({ isLoading: true });
          const res = await fetch(`/api/email/schedules?id=${encodeURIComponent(id)}`, {
            method: 'DELETE',
          });
          const data = await res.json();
          if (data.success && data.schedules) {
            set({ schedules: data.schedules });
            return { success: true };
          }
          return { success: false, error: data.error || 'Failed to delete' };
        } catch (err: any) {
          return { success: false, error: err?.message || 'Network error deleting schedule' };
        } finally {
          set({ isLoading: false });
        }
      },

      toggleSchedule: async (id: string) => {
        const schedule = get().schedules.find((s) => s.id === id);
        if (!schedule) return;

        const updated = { ...schedule, enabled: !schedule.enabled };
        await get().saveSchedule(updated);
      },

      runScheduleNow: async (id: string) => {
        try {
          const res = await fetch(`/api/cron/send-scheduled-reports?forceScheduleId=${encodeURIComponent(id)}`);
          const data = await res.json();
          await get().fetchSchedules();

          if (data.results && data.results[0]?.status === 'success') {
            return { success: true, message: data.results[0]?.message || 'Report sent successfully!' };
          }
          return {
            success: false,
            message: data.results?.[0]?.error || data.error || 'Failed to send report',
          };
        } catch (err: any) {
          return { success: false, message: err?.message || 'Error triggering schedule' };
        }
      },

      sendTestEmail: async (payload) => {
        try {
          set({ isSendingTest: true, lastTestResult: null });
          const res = await fetch('/api/email/send-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();

          if (data.success) {
            const result = {
              success: true,
              message: `✅ Success: Report sent to ${payload.recipients.join(', ')} (${data.recordCount || 0} records included in ${data.attachmentsSent?.join(', ') || 'attachments'})`,
              data,
            };
            set({ lastTestResult: result });
            return result;
          } else {
            const result = {
              success: false,
              message: `❌ Failed: ${data.error || 'Unknown error occurred'}`,
              error: data.error,
              data,
            };
            set({ lastTestResult: result });
            return result;
          }
        } catch (err: any) {
          const result = {
            success: false,
            message: `❌ Error: ${err?.message || 'Network connection failed'}`,
            error: err?.message,
          };
          set({ lastTestResult: result });
          return result;
        } finally {
          set({ isSendingTest: false });
        }
      },
    }),
    {
      name: 'report-schedules-storage',
      partialize: (state) => ({ schedules: state.schedules }),
    }
  )
);
