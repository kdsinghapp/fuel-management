// src/app/(dashboard)/reports/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Mail,
  Clock,
  Send,
  Plus,
  Settings,
  ShieldCheck,
  RefreshCw,
  Play,
  Edit2,
  Trash2,
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Calendar,
  Fuel,
  Sliders,
  Building2,
  Check,
  ArrowLeft,
  X,
  FileDown,
  Info,
  Sparkles,
  Droplet,
  Truck,
  Gauge,
  FileBarChart,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/PageContainer';
import { useScheduleStore } from '@/services/scheduleStore';
import { CLIENTS } from '@/services/api';
import {
  ReportSchedule,
  ReportType,
  DateWindowPreset,
  ReportFormat,
  ScheduleFrequency,
} from '@/types/schedule';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const REPORT_OPTIONS: { id: ReportType; name: string; desc: string; icon: any }[] = [
  {
    id: 'fuel-levels',
    name: 'Fuel Levels',
    desc: 'Storage tank dip readings, capacity percentages & low stock alerts',
    icon: Droplet,
  },
  {
    id: 'deliveries',
    name: 'Deliveries',
    desc: 'Fuel refill logs, batch records, suppliers & delivered volumes',
    icon: Truck,
  },
  {
    id: 'fuel-issues',
    name: 'Transactions',
    desc: 'Detailed log of all fuel issuances, vehicle IDs, drivers, pumps & DEM status',
    icon: FileText,
  },
  {
    id: 'fuel-efficiency',
    name: 'Fuel Efficiency',
    desc: 'Fleet vehicle burn rates (km/L, L/100km) vs standard benchmark rates',
    icon: Gauge,
  },
  {
    id: 'summary-all',
    name: 'Fuel Efficiency Summary',
    desc: 'Consolidated executive report across all tanks, deliveries & fleet usage',
    icon: FileBarChart,
  },
  {
    id: 'fuel-limits',
    name: 'Fuel Limits',
    desc: 'Vehicle monthly allowances, consumption thresholds and breach limits',
    icon: Sliders,
  },
  {
    id: 'reconciliation',
    name: 'Reconciliation',
    desc: 'Opening balance, deliveries, fuel issues, expected vs actual closing & variances',
    icon: RefreshCw,
  },
];

const DATE_PRESET_OPTIONS: { id: DateWindowPreset; label: string; desc: string }[] = [
  { id: 'yesterday', label: 'Yesterday (Full Day)', desc: 'Recommended for daily morning auto-dispatch (00:00 to 23:59)' },
  { id: 'today', label: 'Today (So Far)', desc: 'Current day transactions & dip readings' },
  { id: 'last7days', label: 'Last 7 Days Rolling', desc: 'Trailing 7 days data' },
  { id: 'last14days', label: 'Last 14 Days Rolling', desc: 'Trailing 2 weeks overview' },
  { id: 'last30days', label: 'Last 30 Days Rolling', desc: 'Trailing month rolling data' },
  { id: 'monthToDate', label: 'Month-to-Date (MTD)', desc: 'From 1st of current month up to yesterday' },
  { id: 'lastMonth', label: 'Previous Month (Full)', desc: 'Complete 1st to last day of previous month' },
  { id: 'custom', label: 'Custom Date Range', desc: 'Specify custom start and end date' },
];

const DEFAULT_TIME_PRESETS = ['06:00', '07:00', '08:00', '08:30', '09:00', '10:00', '12:00', '14:00', '17:00', '18:00', '20:00'];

function formatTime12H(time24: string): string {
  if (!time24) return '08:00 AM';
  const parts = time24.split(':');
  let hour = parseInt(parts[0], 10);
  const minute = parts[1] || '00';
  if (isNaN(hour)) return time24;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12;
  const hourStr = String(hour).padStart(2, '0');
  return `${hourStr}:${minute} ${ampm}`;
}

function formatTime24H(hour12: number, minute: number, ampm: 'AM' | 'PM'): string {
  let h = hour12;
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export default function ReportsFullPage() {
  const {
    schedules,
    isLoading,
    fetchSchedules,
    saveSchedule,
    deleteSchedule,
    toggleSchedule,
    runScheduleNow,
    sendTestEmail,
    isSendingTest,
    lastTestResult,
  } = useScheduleStore();

  const { user } = useAuth();

  // Active page view: 'list' | 'form' | 'quick'
  const [activeTab, setActiveTab] = useState<'list' | 'form' | 'quick'>('list');
  const [editingSchedule, setEditingSchedule] = useState<ReportSchedule | null>(null);

  // Form State
  const [scheduleName, setScheduleName] = useState('');
  const [selectedClient, setSelectedClient] = useState('Digicel POM');
  const [selectedReport, setSelectedReport] = useState<ReportType>('reconciliation');
  const [selectedDatePreset, setSelectedDatePreset] = useState<DateWindowPreset>('yesterday');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedTime, setSelectedTime] = useState('08:00');
  const [timePresets, setTimePresets] = useState<string[]>(DEFAULT_TIME_PRESETS);
  const [customHour, setCustomHour] = useState(8);
  const [customMinute, setCustomMinute] = useState(0);
  const [customAmPm, setCustomAmPm] = useState<'AM' | 'PM'>('AM');
  const [newPresetInput, setNewPresetInput] = useState('');
  const [isAddingNewPreset, setIsAddingNewPreset] = useState(false);
  const [selectedFrequency, setSelectedFrequency] = useState<ScheduleFrequency>('daily');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState('');
  const [selectedFormats, setSelectedFormats] = useState<ReportFormat[]>(['excel', 'pdf']);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [runningScheduleId, setRunningScheduleId] = useState<string | null>(null);

  // Quick Instant Send State
  const [quickClient, setQuickClient] = useState('Digicel POM');
  const [quickReport, setQuickReport] = useState<ReportType>('reconciliation');
  const [quickDatePreset, setQuickDatePreset] = useState<DateWindowPreset>('yesterday');
  const [quickRecipient, setQuickRecipient] = useState('');
  const [quickFormats, setQuickFormats] = useState<ReportFormat[]>(['excel', 'pdf']);
  const [quickSuccess, setQuickSuccess] = useState<string | null>(null);
  const [quickError, setQuickError] = useState<string | null>(null);

  // Microsoft Graph Connection Check
  const [graphStatus, setGraphStatus] = useState<any>(null);
  const [checkingGraph, setCheckingGraph] = useState(false);

  useEffect(() => {
    fetchSchedules();
    checkGraph();
  }, []);

  // Sync custom time builder inputs whenever selectedTime changes
  useEffect(() => {
    if (selectedTime && selectedTime.includes(':')) {
      const parts = selectedTime.split(':');
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h) && !isNaN(m)) {
        setCustomAmPm(h >= 12 ? 'PM' : 'AM');
        const h12 = h % 12 || 12;
        setCustomHour(h12);
        setCustomMinute(m);
      }
    }
  }, [selectedTime]);

  const checkGraph = async () => {
    setCheckingGraph(true);
    try {
      const res = await fetch('/api/email/send-report');
      const data = await res.json();
      setGraphStatus(data);
    } catch {
      setGraphStatus({ connected: false, error: 'Connection failed' });
    } finally {
      setCheckingGraph(false);
    }
  };

  const handleOpenCreate = (scheduleToEdit: ReportSchedule | null = null) => {
    setEditingSchedule(scheduleToEdit);
    if (scheduleToEdit) {
      setScheduleName(scheduleToEdit.name);
      setSelectedClient(scheduleToEdit.clientName);
      setSelectedReport(scheduleToEdit.reportType);
      setSelectedDatePreset(scheduleToEdit.datePreset);
      setCustomStart(scheduleToEdit.customStartDate || '');
      setCustomEnd(scheduleToEdit.customEndDate || '');
      setSelectedTime(scheduleToEdit.time);
      setSelectedFrequency(scheduleToEdit.frequency);
      setRecipients(scheduleToEdit.recipients || []);
      setSelectedFormats(scheduleToEdit.formats || ['excel', 'pdf']);
    } else {
      setScheduleName(`Daily ${selectedClient} Report`);
      setSelectedClient('Digicel POM');
      setSelectedReport('reconciliation');
      setSelectedDatePreset('yesterday');
      setCustomStart('');
      setCustomEnd('');
      setSelectedTime('08:00');
      setSelectedFrequency('daily');
      setRecipients([]);
      setSelectedFormats(['excel', 'pdf']);
    }
    setFormError(null);
    setFormSuccess(null);
    setActiveTab('form');
  };

  const handleAddRecipient = () => {
    const email = recipientInput.trim().toLowerCase();
    if (!email) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setFormError('Please enter a valid email address.');
      return;
    }
    if (recipients.includes(email)) {
      setFormError('This email is already in the recipient list.');
      return;
    }
    setRecipients([...recipients, email]);
    setRecipientInput('');
    setFormError(null);
  };

  const handleRemoveRecipient = (emailToRemove: string) => {
    setRecipients(recipients.filter((r) => r !== emailToRemove));
  };

  const handleToggleFormat = (fmt: ReportFormat) => {
    if (selectedFormats.includes(fmt)) {
      if (selectedFormats.length === 1) {
        setFormError('At least one attachment format must be selected.');
        return;
      }
      setSelectedFormats(selectedFormats.filter((f) => f !== fmt));
    } else {
      setSelectedFormats([...selectedFormats, fmt]);
    }
    setFormError(null);
  };

  const handleSaveSchedule = async () => {
    if (recipients.length === 0) {
      setFormError('Please add at least one recipient email address.');
      return;
    }

    const payload: Partial<ReportSchedule> = {
      id: editingSchedule?.id,
      name: scheduleName.trim() || `Daily ${selectedClient} Report`,
      enabled: true,
      clientName: selectedClient,
      reportType: selectedReport,
      datePreset: selectedDatePreset,
      customStartDate: selectedDatePreset === 'custom' ? customStart : undefined,
      customEndDate: selectedDatePreset === 'custom' ? customEnd : undefined,
      time: selectedTime,
      frequency: selectedFrequency,
      recipients,
      formats: selectedFormats,
    };

    const res = await saveSchedule(payload);
    if (res.success) {
      setFormSuccess('Schedule saved and activated successfully!');
      setTimeout(() => {
        setFormSuccess(null);
        setActiveTab('list');
      }, 1500);
    } else {
      setFormError(res.error || 'Failed to save schedule.');
    }
  };

  const handleTestNow = async () => {
    if (recipients.length === 0) {
      setFormError('Please add at least one recipient email address before sending test.');
      return;
    }
    setFormError(null);
    setFormSuccess(null);

    await sendTestEmail({
      clientName: selectedClient,
      reportType: selectedReport,
      datePreset: selectedDatePreset,
      customStartDate: selectedDatePreset === 'custom' ? customStart : undefined,
      customEndDate: selectedDatePreset === 'custom' ? customEnd : undefined,
      recipients,
      formats: selectedFormats,
    });
  };

  const handleRunNow = async (id: string) => {
    setRunningScheduleId(id);
    const res = await runScheduleNow(id);
    setRunningScheduleId(null);
    alert(res.message);
  };

  const handleQuickSend = async () => {
    if (!quickRecipient.trim()) {
      setQuickError('Please enter a recipient email address.');
      return;
    }
    setQuickError(null);
    setQuickSuccess(null);

    const res = await sendTestEmail({
      clientName: quickClient,
      reportType: quickReport,
      datePreset: quickDatePreset,
      recipients: [quickRecipient.trim()],
      formats: quickFormats,
    });

    if (res.success) {
      setQuickSuccess(`Report successfully dispatched to ${quickRecipient}`);
      setTimeout(() => setQuickSuccess(null), 5000);
    } else {
      setQuickError(res.error || 'Failed to send report.');
    }
  };

  const activeSchedulesCount = schedules.filter((s) => s.enabled).length;

  return (
    <PageContainer>
      <div className="space-y-6 pb-12">

        {/* Tab Navigation Navigation Bar */}
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('list')}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
              activeTab === 'list'
                ? 'bg-[#f26522] text-white shadow-md'
                : 'bg-white text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 border border-zinc-200 shadow-xs'
            )}
          >
            <Clock className="h-4 w-4" />
            Scheduled Jobs ({schedules.length})
          </button>

          <button
            onClick={() => handleOpenCreate(null)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
              activeTab === 'form'
                ? 'bg-[#f26522] text-white shadow-md'
                : 'bg-white text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 border border-zinc-200 shadow-xs'
            )}
          >
            <Plus className="h-4 w-4" />
            {editingSchedule ? `Edit Schedule: ${editingSchedule.name}` : '+ Configure New Schedule'}
          </button>

          <button
            onClick={() => setActiveTab('quick')}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
              activeTab === 'quick'
                ? 'bg-[#f26522] text-white shadow-md'
                : 'bg-white text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 border border-zinc-200 shadow-xs'
            )}
          >
            <Send className="h-4 w-4" />
            Instant Dispatcher
          </button>
        </div>

        {/* ========================================================================= */}
        {/* VIEW 1: SCHEDULES LIST */}
        {/* ========================================================================= */}
        {activeTab === 'list' && (
          <div className="space-y-6">
            {/* Top Metric Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-white border border-zinc-200/90 shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                      Active Schedules
                    </span>
                    <p className="text-2xl font-black text-zinc-900">
                      {activeSchedulesCount}{' '}
                      <span className="text-xs text-zinc-500 font-semibold">/ {schedules.length} Total</span>
                    </p>
                  </div>
                  <div className="h-11 w-11 rounded-2xl bg-orange-500/10 text-[#f26522] flex items-center justify-center font-bold">
                    <Clock className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-zinc-200/90 shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                      Email Engine Status
                    </span>
                    <p className="text-sm font-black text-emerald-600 flex items-center gap-1.5 pt-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      Connected via Graph
                    </p>
                  </div>
                  <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-zinc-200/90 shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                      Sender Mailbox
                    </span>
                    <p className="text-xs font-black text-zinc-800 truncate max-w-[170px] pt-1" title={graphStatus?.sender || 'support@yourcompany.com'}>
                      {graphStatus?.sender || 'support@yourcompany.com'}
                    </p>
                  </div>
                  <div className="h-11 w-11 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                    <Mail className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-zinc-200/90 shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                      Supported Clients
                    </span>
                    <p className="text-2xl font-black text-zinc-900">
                      {CLIENTS.length}{' '}
                      <span className="text-xs text-zinc-500 font-semibold">Locations</span>
                    </p>
                  </div>
                  <div className="h-11 w-11 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
                    <Building2 className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* List of Schedules */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-zinc-900">
                    Configured Daily Automated Schedules
                  </h2>
                  <p className="text-xs text-zinc-600 font-medium">
                    Reports will automatically generate and email at their preset times
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleOpenCreate(null)}
                    className="bg-[#f26522] hover:bg-[#d9531e] text-white text-xs font-bold gap-1.5 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    + New Schedule
                  </Button>
                </div>
              </div>

              {schedules.length === 0 ? (
                <Card className="p-12 text-center border-dashed border-2 bg-white">
                  <Mail className="h-12 w-12 text-zinc-400 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-zinc-800">
                    No automated schedules created yet
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-4">
                    Create your first automated email schedule to send daily reports for any client automatically.
                  </p>
                  <Button
                    onClick={() => handleOpenCreate(null)}
                    className="bg-[#f26522] hover:bg-[#d9531e] text-white text-xs font-bold rounded-xl"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Configure Schedule Now
                  </Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-3.5">
                  {schedules.map((sched) => {
                    const repMeta = REPORT_OPTIONS.find((r) => r.id === sched.reportType) || {
                      name: sched.reportType,
                      icon: FileText,
                      desc: '',
                    };
                    const Icon = repMeta.icon;

                    return (
                      <Card
                        key={sched.id}
                        className={cn(
                          'transition-all duration-200 border overflow-hidden hover:shadow-md bg-white',
                          sched.enabled
                            ? 'border-zinc-200/90 shadow-sm'
                            : 'border-zinc-200/60 opacity-75 bg-zinc-50/80'
                        )}
                      >
                        <CardContent className="p-5">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-start gap-4 min-w-0">
                              <div className="h-12 w-12 rounded-2xl bg-orange-500/10 text-[#f26522] flex items-center justify-center shrink-0 mt-0.5 shadow-xs border border-orange-500/20">
                                <Icon className="h-6 w-6" />
                              </div>

                              <div className="space-y-1.5 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="text-base font-black text-zinc-900">
                                    {sched.name}
                                  </h3>
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#f26522]/10 text-[#f26522] border border-[#f26522]/20">
                                    {sched.clientName}
                                  </span>
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
                                    {repMeta.name}
                                  </span>
                                </div>

                                <div className="flex items-center gap-5 text-xs text-zinc-600 pt-0.5 flex-wrap">
                                  <span className="flex items-center gap-1.5 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                                    <Clock className="h-3.5 w-3.5" />
                                    {formatTime12H(sched.time)} ({sched.frequency})
                                  </span>
                                  <span className="flex items-center gap-1.5 font-medium text-zinc-700">
                                    <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                                    Window: {DATE_PRESET_OPTIONS.find((d) => d.id === sched.datePreset)?.label || sched.datePreset}
                                  </span>
                                  <span className="flex items-center gap-1.5 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                                    <FileSpreadsheet className="h-3.5 w-3.5" />
                                    {sched.formats.join(' + ').toUpperCase()}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-zinc-600 pt-1">
                                  <Mail className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                                  <span>
                                    Recipients:{' '}
                                    <strong className="text-zinc-900 font-bold">
                                      {sched.recipients.join(', ')}
                                    </strong>
                                  </span>
                                </div>

                                {sched.lastRunAt && (
                                  <p className="text-[11px] text-zinc-500 font-medium pt-1">
                                    Last run: {new Date(sched.lastRunAt).toLocaleString()} •{' '}
                                    <span
                                      className={
                                        sched.lastRunStatus === 'success'
                                          ? 'text-emerald-700 font-bold'
                                          : 'text-rose-600 font-bold'
                                      }
                                    >
                                      {sched.lastRunStatus === 'success' ? 'Delivered' : 'Failed'}
                                    </span>
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-zinc-100 self-end md:self-center">
                              <button
                                title="Click to toggle Active / Paused"
                                onClick={() => toggleSchedule(sched.id)}
                                className={cn(
                                  'h-9 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                                  sched.enabled
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                                    : 'bg-zinc-100 text-zinc-500 border border-zinc-200 hover:bg-zinc-200'
                                )}
                              >
                                {sched.enabled ? 'Active' : 'Paused'}
                              </button>

                              <button
                                title="Run & Send Report Immediately Right Now"
                                disabled={runningScheduleId === sched.id}
                                onClick={() => handleRunNow(sched.id)}
                                className="h-9 px-3 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#f26522] border border-orange-200/80 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                {runningScheduleId === sched.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                                <span className="hidden sm:inline">Run Now</span>
                              </button>

                              <button
                                title="Edit Schedule in Full Page"
                                onClick={() => handleOpenCreate(sched)}
                                className="p-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 transition-colors cursor-pointer"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>

                              <button
                                title="Delete Schedule"
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete "${sched.name}"?`)) {
                                    deleteSchedule(sched.id);
                                  }
                                }}
                                className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: FULL-PAGE CREATE / EDIT FORM */}
        {/* ========================================================================= */}
        {activeTab === 'form' && (
          <div className="space-y-6">
            <Card className="bg-white border border-zinc-200 shadow-md overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-orange-500/10 via-orange-50/50 to-transparent border-b border-zinc-200 p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-black text-zinc-900 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-[#f26522]" />
                      {editingSchedule ? 'Edit Automated Report Schedule' : 'Configure New Automated Report Schedule'}
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-600 font-medium">
                      Fill in the target client, report type, date window, daily dispatch time, and receiver email IDs.
                    </CardDescription>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('list')}
                    className="text-xs text-zinc-700 bg-white hover:bg-zinc-100 border-zinc-300 font-bold gap-1 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-8 space-y-8">
                {/* 1. Schedule Name */}
                <div className="space-y-2">
                  <label className="text-xs font-extrabold tracking-wider uppercase text-zinc-800">
                    Schedule Name
                  </label>
                  <input
                    type="text"
                    value={scheduleName}
                    onChange={(e) => setScheduleName(e.target.value)}
                    placeholder="e.g. Daily Digicel POM Reconciliation"
                    className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-3 text-sm font-semibold text-zinc-900 focus:outline-none focus:border-[#f26522] focus:ring-1 focus:ring-[#f26522]"
                  />
                </div>

                {/* 2. Target Client Selection */}
                <div className="space-y-2.5">
                  <label className="text-xs font-extrabold tracking-wider uppercase text-zinc-800 flex items-center justify-between">
                    <span>1. Target Client</span>
                    <span className="text-xs font-bold text-[#f26522]">Selected: {selectedClient}</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 max-h-56 overflow-y-auto p-2 border border-zinc-200 rounded-2xl bg-zinc-50">
                    {CLIENTS.map((client) => {
                      const isSelected = selectedClient === client.name;
                      return (
                        <button
                          key={client.name}
                          type="button"
                          onClick={() => setSelectedClient(client.name)}
                          className={cn(
                            'flex items-center justify-between p-3 rounded-xl text-left text-xs font-bold transition-all border cursor-pointer',
                            isSelected
                              ? 'bg-[#f26522] text-white border-[#f26522] shadow-sm'
                              : 'bg-white text-zinc-800 border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50'
                          )}
                        >
                          <span className="truncate">{client.name}</span>
                          {isSelected && <Check className="h-4 w-4 shrink-0 ml-1 stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Report Type Selection */}
                <div className="space-y-2.5">
                  <label className="text-xs font-extrabold tracking-wider uppercase text-zinc-800">
                    2. Report Type
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {REPORT_OPTIONS.map((rep) => {
                      const isSelected = selectedReport === rep.id;
                      const Icon = rep.icon;
                      return (
                        <button
                          key={rep.id}
                          type="button"
                          onClick={() => setSelectedReport(rep.id)}
                          className={cn(
                            'flex items-start gap-3.5 p-4 rounded-2xl text-left transition-all border cursor-pointer',
                            isSelected
                              ? 'bg-orange-50 border-[#f26522] ring-2 ring-[#f26522]/30 shadow-sm'
                              : 'bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                          )}
                        >
                          <div
                            className={cn(
                              'p-2.5 rounded-xl shrink-0 mt-0.5',
                              isSelected ? 'bg-[#f26522] text-white' : 'bg-zinc-100 text-zinc-600'
                            )}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-zinc-900 leading-tight">
                              {rep.name}
                            </p>
                            <p className="text-xs text-zinc-600 line-clamp-2 mt-1">{rep.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Date Range Window Selection */}
                <div className="space-y-2.5">
                  <label className="text-xs font-extrabold tracking-wider uppercase text-zinc-800">
                    3. Date Range Period
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {DATE_PRESET_OPTIONS.map((preset) => {
                      const isSelected = selectedDatePreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setSelectedDatePreset(preset.id)}
                          className={cn(
                            'p-3.5 rounded-2xl text-left transition-all border flex flex-col justify-between cursor-pointer',
                            isSelected
                              ? 'bg-[#f26522] text-white border-[#f26522] shadow-sm'
                              : 'bg-white text-zinc-800 border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50'
                          )}
                        >
                          <span className="text-xs font-bold">{preset.label}</span>
                          <span className={cn('text-[11px] mt-1 line-clamp-1', isSelected ? 'text-orange-100' : 'text-zinc-500')}>{preset.desc}</span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedDatePreset === 'custom' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl mt-2">
                      <div>
                        <label className="text-xs font-bold text-zinc-700">Start Date</label>
                        <input
                          type="date"
                          value={customStart}
                          onChange={(e) => setCustomStart(e.target.value)}
                          className="w-full bg-white border border-zinc-300 rounded-xl p-2.5 text-xs text-zinc-900 font-semibold mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-zinc-700">End Date</label>
                        <input
                          type="date"
                          value={customEnd}
                          onChange={(e) => setCustomEnd(e.target.value)}
                          className="w-full bg-white border border-zinc-300 rounded-xl p-2.5 text-xs text-zinc-900 font-semibold mt-1"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Dispatch Timing & Frequency */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold tracking-wider uppercase text-zinc-800">
                      4. Dispatch Timing
                    </label>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-orange-500/10 text-[#f26522] border border-orange-500/30">
                      <Clock className="h-3.5 w-3.5" />
                      {formatTime12H(selectedTime)} ({selectedTime})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Time Custom Builder Card */}
                    <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-3.5">
                      <span className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-[#f26522]" />
                        Exact Delivery Time Builder
                      </span>

                      {/* Hour, Continuous Minute 00-59, AM/PM Selectors */}
                      <div className="grid grid-cols-3 gap-2.5 bg-white p-3 rounded-xl border border-zinc-200">
                        {/* Hour */}
                        <div>
                          <label className="text-[10px] font-extrabold text-zinc-500 uppercase block mb-1">
                            Hour
                          </label>
                          <select
                            value={customHour}
                            onChange={(e) => {
                              const h = Number(e.target.value);
                              setCustomHour(h);
                              const t24 = formatTime24H(h, customMinute, customAmPm);
                              setSelectedTime(t24);
                              if (!timePresets.includes(t24)) setTimePresets([...timePresets, t24].sort());
                            }}
                            className="w-full bg-zinc-50 border border-zinc-300 rounded-lg p-2 text-xs font-bold text-zinc-900"
                          >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                              <option key={h} value={h}>
                                {String(h).padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Continuous Minute 00 to 59 */}
                        <div>
                          <label className="text-[10px] font-extrabold text-zinc-500 uppercase block mb-1">
                            Minute (00-59)
                          </label>
                          <select
                            value={customMinute}
                            onChange={(e) => {
                              const m = Number(e.target.value);
                              setCustomMinute(m);
                              const t24 = formatTime24H(customHour, m, customAmPm);
                              setSelectedTime(t24);
                              if (!timePresets.includes(t24)) setTimePresets([...timePresets, t24].sort());
                            }}
                            className="w-full bg-zinc-50 border border-zinc-300 rounded-lg p-2 text-xs font-bold text-zinc-900"
                          >
                            {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                              <option key={m} value={m}>
                                {String(m).padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* AM / PM Toggle */}
                        <div>
                          <label className="text-[10px] font-extrabold text-zinc-500 uppercase block mb-1">
                            AM / PM
                          </label>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setCustomAmPm('AM');
                                const t24 = formatTime24H(customHour, customMinute, 'AM');
                                setSelectedTime(t24);
                                if (!timePresets.includes(t24)) setTimePresets([...timePresets, t24].sort());
                              }}
                              className={cn(
                                'flex-1 py-1.5 rounded-lg text-xs font-extrabold border transition-all cursor-pointer',
                                customAmPm === 'AM'
                                  ? 'bg-[#f26522] text-white border-[#f26522]'
                                  : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                              )}
                            >
                              AM
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCustomAmPm('PM');
                                const t24 = formatTime24H(customHour, customMinute, 'PM');
                                setSelectedTime(t24);
                                if (!timePresets.includes(t24)) setTimePresets([...timePresets, t24].sort());
                              }}
                              className={cn(
                                'flex-1 py-1.5 rounded-lg text-xs font-extrabold border transition-all cursor-pointer',
                                customAmPm === 'PM'
                                  ? 'bg-[#f26522] text-white border-[#f26522]'
                                  : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                              )}
                            >
                              PM
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Quick Presets */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-zinc-500 block">Quick Time Presets:</span>
                        <div className="flex gap-1.5 flex-wrap">
                          {timePresets.map((t) => {
                            const isSelected = selectedTime === t;
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setSelectedTime(t)}
                                className={cn(
                                  'text-xs font-bold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 cursor-pointer',
                                  isSelected
                                    ? 'bg-[#f26522] text-white border-[#f26522] shadow-sm'
                                    : 'bg-white text-zinc-800 border-zinc-200 hover:border-zinc-400'
                                )}
                              >
                                {formatTime12H(t)}
                                {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Frequency Card */}
                    <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-3.5 flex flex-col justify-between">
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-zinc-700 block flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 text-[#f26522]" />
                          Schedule Frequency
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: 'daily', label: 'Every Day (Daily)' },
                            { id: 'weekdays', label: 'Mon - Fri (Weekdays)' },
                            { id: 'weekly', label: 'Weekly (Every Monday)' },
                            { id: 'monthly', label: 'Monthly (1st of Month)' },
                          ].map((freq) => (
                            <button
                              key={freq.id}
                              type="button"
                              onClick={() => setSelectedFrequency(freq.id as ScheduleFrequency)}
                              className={cn(
                                'text-xs font-bold py-3 px-2.5 rounded-xl border text-center transition-all cursor-pointer',
                                selectedFrequency === freq.id
                                  ? 'bg-[#f26522] text-white border-[#f26522] shadow-sm'
                                  : 'bg-white text-zinc-800 border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50'
                              )}
                            >
                              {freq.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-zinc-200 text-xs text-zinc-700 leading-relaxed font-medium">
                        🔔 Email report will dispatch <strong className="text-zinc-900">{selectedFrequency === 'daily' ? 'every day' : selectedFrequency}</strong> at <strong className="text-zinc-900">{formatTime12H(selectedTime)}</strong>.
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6. Recipient Emails Input */}
                <div className="space-y-2.5">
                  <label className="text-xs font-extrabold tracking-wider uppercase text-zinc-800">
                    5. Receiver Email Addresses
                  </label>
                  <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-3">
                    <div className="flex gap-2.5">
                      <input
                        type="email"
                        value={recipientInput}
                        onChange={(e) => setRecipientInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            handleAddRecipient();
                          }
                        }}
                        placeholder="Type recipient email address and click Add or press Enter..."
                        className="flex-1 bg-white border border-zinc-300 rounded-xl px-4 py-2.5 text-xs text-zinc-900 font-semibold focus:outline-none focus:border-[#f26522]"
                      />
                      <Button
                        type="button"
                        onClick={handleAddRecipient}
                        className="bg-[#f26522] hover:bg-[#d9531e] text-white text-xs font-bold rounded-xl px-5 cursor-pointer"
                      >
                        + Add Email
                      </Button>
                    </div>

                    {/* Chips */}
                    <div className="flex flex-wrap gap-2 min-h-[44px] items-center p-3 bg-white rounded-xl border border-zinc-200">
                      {recipients.length === 0 ? (
                        <span className="text-xs text-zinc-500 italic font-medium">
                          No recipients added yet. Add at least one receiver email address above.
                        </span>
                      ) : (
                        recipients.map((email) => (
                          <span
                            key={email}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-900 border border-orange-200"
                          >
                            <Mail className="h-3.5 w-3.5 text-[#f26522]" />
                            {email}
                            <button
                              type="button"
                              onClick={() => handleRemoveRecipient(email)}
                              className="ml-1 text-zinc-500 hover:text-rose-600 cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* 7. Attachment Formats */}
                <div className="space-y-2.5">
                  <label className="text-xs font-extrabold tracking-wider uppercase text-zinc-800">
                    6. File Attachments & Format
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { id: 'excel', label: 'Excel (.xlsx)', icon: FileSpreadsheet },
                      { id: 'pdf', label: 'PDF Document', icon: FileText },
                      { id: 'csv', label: 'CSV File', icon: FileDown },
                    ].map((fmt) => {
                      const isChecked = selectedFormats.includes(fmt.id as ReportFormat);
                      const Icon = fmt.icon;
                      return (
                        <button
                          key={fmt.id}
                          type="button"
                          onClick={() => handleToggleFormat(fmt.id as ReportFormat)}
                          className={cn(
                            'p-3.5 rounded-2xl text-left border flex items-center gap-2.5 transition-all cursor-pointer font-bold',
                            isChecked
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                              : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                          )}
                        >
                          <div
                            className={cn(
                              'h-4 w-4 rounded border flex items-center justify-center text-[10px]',
                              isChecked
                                ? 'bg-emerald-600 border-emerald-600 text-white font-extrabold'
                                : 'border-zinc-400 bg-white'
                            )}
                          >
                            {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                          <Icon className="h-4 w-4" />
                          <span className="text-xs">{fmt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Alerts / Feedback */}
                {formError && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs text-rose-700 font-semibold">
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {formSuccess && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs text-emerald-700 font-semibold">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{formSuccess}</span>
                  </div>
                )}

                {lastTestResult && (
                  <div
                    className={cn(
                      'p-4 rounded-2xl border text-xs leading-relaxed space-y-1 font-medium',
                      lastTestResult.success
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      {lastTestResult.success ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-rose-600" />
                      )}
                      <span>Test Dispatch Result</span>
                    </div>
                    <p className="text-xs">{lastTestResult.message}</p>
                  </div>
                )}

                {/* Submit & Test Buttons */}
                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                  <Button
                    type="button"
                    onClick={handleSaveSchedule}
                    className="flex-1 bg-[#f26522] hover:bg-[#d9531e] text-white font-black text-sm py-6 rounded-2xl shadow-md gap-2 cursor-pointer"
                  >
                    <Check className="h-4 w-4 stroke-[3]" />
                    {editingSchedule ? 'Update Schedule' : 'Save & Activate Schedule'}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSendingTest}
                    onClick={handleTestNow}
                    className="bg-white border-zinc-300 text-zinc-900 font-bold text-xs py-6 px-6 rounded-2xl gap-2 hover:bg-zinc-50 cursor-pointer shadow-xs"
                  >
                    {isSendingTest ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin text-[#f26522]" />
                        Dispatching Test Email...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 text-[#f26522]" />
                        Send Test Report Now
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: INSTANT DISPATCHER */}
        {/* ========================================================================= */}
        {activeTab === 'quick' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <Card className="bg-white border border-zinc-200 shadow-md">
              <CardHeader className="p-6 border-b border-zinc-100">
                <CardTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
                  <Send className="h-5 w-5 text-[#f26522]" />
                  Instant Live Report Dispatcher
                </CardTitle>
                <CardDescription className="text-xs text-zinc-600 font-medium">
                  Generate real-time live report data and dispatch directly to any email address via Microsoft Graph API.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-zinc-800">Target Client</label>
                  <select
                    value={quickClient}
                    onChange={(e) => setQuickClient(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-xl p-3 text-xs font-bold text-zinc-900 focus:outline-none focus:border-[#f26522]"
                  >
                    {CLIENTS.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-zinc-800">Report Type</label>
                  <select
                    value={quickReport}
                    onChange={(e) => setQuickReport(e.target.value as ReportType)}
                    className="w-full bg-white border border-zinc-300 rounded-xl p-3 text-xs font-bold text-zinc-900 focus:outline-none focus:border-[#f26522]"
                  >
                    <option value="fuel-levels">Fuel Levels</option>
                    <option value="deliveries">Deliveries</option>
                    <option value="fuel-issues">Transactions</option>
                    <option value="fuel-efficiency">Fuel Efficiency</option>
                    <option value="summary-all">Fuel Efficiency Summary</option>
                    <option value="fuel-limits">Fuel Limits</option>
                    <option value="reconciliation">Reconciliation</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-zinc-800">Date Window</label>
                  <select
                    value={quickDatePreset}
                    onChange={(e) => setQuickDatePreset(e.target.value as DateWindowPreset)}
                    className="w-full bg-white border border-zinc-300 rounded-xl p-3 text-xs font-bold text-zinc-900 focus:outline-none focus:border-[#f26522]"
                  >
                    <option value="yesterday">Yesterday (Full Day)</option>
                    <option value="today">Today (So Far)</option>
                    <option value="last7days">Last 7 Days Rolling</option>
                    <option value="last30days">Last 30 Days Rolling</option>
                    <option value="monthToDate">Month-to-Date (MTD)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-zinc-800">Receiver Email ID</label>
                  <input
                    type="email"
                    value={quickRecipient}
                    onChange={(e) => setQuickRecipient(e.target.value)}
                    placeholder="Enter receiver email address..."
                    className="w-full bg-white border border-zinc-300 rounded-xl p-3 text-xs font-semibold text-zinc-900 focus:outline-none focus:border-[#f26522]"
                  />
                </div>

                {quickError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>{quickError}</span>
                  </div>
                )}

                {quickSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{quickSuccess}</span>
                  </div>
                )}

                <Button
                  type="button"
                  disabled={isSendingTest}
                  onClick={handleQuickSend}
                  className="w-full bg-[#f26522] hover:bg-[#d9531e] text-white font-black text-sm py-6 rounded-2xl gap-2 shadow-md cursor-pointer"
                >
                  {isSendingTest ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Generating & Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Live Report Now via Microsoft Graph
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
