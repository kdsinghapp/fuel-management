// src/components/settings/ReportScheduleDrawer.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Clock,
  Mail,
  Send,
  Calendar,
  Building2,
  FileText,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  Trash2,
  Edit2,
  Play,
  Plus,
  Settings,
  RefreshCw,
  Sliders,
  Check,
  Fuel,
  ChevronRight,
  ShieldCheck,
  History,
  FileDown,
  Info,
  Droplet,
  Truck,
  Gauge,
  FileBarChart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CLIENTS } from '@/services/api';
import { useScheduleStore } from '@/services/scheduleStore';
import {
  ReportSchedule,
  ReportType,
  DateWindowPreset,
  ScheduleFrequency,
  ReportFormat,
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
  { id: 'monthToDate', label: 'Month-to-Date (MTD)', desc: 'From 1st of current month up to today' },
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

export function ReportScheduleDrawer() {
  const {
    isDrawerOpen,
    closeDrawer,
    activeTab,
    setActiveTab,
    schedules,
    editingSchedule,
    setEditingSchedule,
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

  // Form State
  const [scheduleName, setScheduleName] = useState('');
  const [selectedClient, setSelectedClient] = useState('Digicel POM');
  const [selectedReport, setSelectedReport] = useState<ReportType>('reconciliation');
  const [selectedDatePreset, setSelectedDatePreset] = useState<DateWindowPreset>('yesterday');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedTime, setSelectedTime] = useState('08:00');
  const [timePresets, setTimePresets] = useState<string[]>(DEFAULT_TIME_PRESETS);
  const [showCustomTimeBuilder, setShowCustomTimeBuilder] = useState(false);
  const [customHour, setCustomHour] = useState(8);
  const [customMinute, setCustomMinute] = useState(0);
  const [customAmPm, setCustomAmPm] = useState<'AM' | 'PM'>('AM');
  const [newPresetInput, setNewPresetInput] = useState('');
  const [isAddingNewPreset, setIsAddingNewPreset] = useState(false);
  const [selectedFrequency, setSelectedFrequency] = useState<ScheduleFrequency>('daily');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState('');
  const [selectedFormats, setSelectedFormats] = useState<ReportFormat[]>(['excel', 'pdf']);
  const [subjectTemplate, setSubjectTemplate] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

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

  // Microsoft Graph Connection Status
  const [graphStatus, setGraphStatus] = useState<any>(null);
  const [checkingGraph, setCheckingGraph] = useState(false);

  // Load schedules on mount
  useEffect(() => {
    fetchSchedules();
    checkGraphConnection();
  }, []);

  // When editingSchedule changes, populate form
  useEffect(() => {
    if (editingSchedule) {
      setScheduleName(editingSchedule.name);
      setSelectedClient(editingSchedule.clientName);
      setSelectedReport(editingSchedule.reportType);
      setSelectedDatePreset(editingSchedule.datePreset);
      setCustomStart(editingSchedule.customStartDate || '');
      setCustomEnd(editingSchedule.customEndDate || '');
      setSelectedTime(editingSchedule.time);
      setSelectedFrequency(editingSchedule.frequency);
      setRecipients(editingSchedule.recipients || []);
      setSelectedFormats(editingSchedule.formats || ['excel', 'pdf']);
      setSubjectTemplate(editingSchedule.subjectTemplate || '');
      setCustomNotes(editingSchedule.customNotes || '');
    } else {
      resetForm();
    }
    setFormError(null);
    setFormSuccess(null);
  }, [editingSchedule, isDrawerOpen]);

  const resetForm = () => {
    setScheduleName(`Daily ${selectedClient} ${REPORT_OPTIONS.find((r) => r.id === selectedReport)?.name || 'Report'}`);
    setSelectedClient('Digicel POM');
    setSelectedReport('reconciliation');
    setSelectedDatePreset('yesterday');
    setCustomStart('');
    setCustomEnd('');
    setSelectedTime('08:00');
    setSelectedFrequency('daily');
    setRecipients(user?.email ? [user.email] : ['manager@fuelmaster.com']);
    setSelectedFormats(['excel', 'pdf']);
    setSubjectTemplate('');
    setCustomNotes('');
  };

  const checkGraphConnection = async () => {
    setCheckingGraph(true);
    try {
      const res = await fetch('/api/email/send-report');
      const data = await res.json();
      setGraphStatus(data);
    } catch {
      setGraphStatus({ connected: false, error: 'Network error checking Microsoft Graph' });
    } finally {
      setCheckingGraph(false);
    }
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
      subjectTemplate: subjectTemplate.trim() || undefined,
      customNotes: customNotes.trim() || undefined,
    };

    const res = await saveSchedule(payload);
    if (res.success) {
      setFormSuccess('Schedule saved and activated successfully!');
      setTimeout(() => {
        setFormSuccess(null);
      }, 3000);
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

  if (!isDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={closeDrawer}
      />

      {/* Slide-over Drawer Panel */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-6">
        <div
          className="w-screen max-w-2xl bg-[#0f1117] text-white border-l border-zinc-800 shadow-2xl flex flex-col transform transition-transform duration-300 ease-out"
          style={{ background: 'linear-gradient(180deg, #13111c 0%, #0d0000 100%)' }}
        >
          {/* Header Bar */}
          <div
            className="flex items-center justify-between px-6 py-4 border-b border-white/10"
            style={{ background: 'linear-gradient(90deg, #ff9f1c 0%, #f26522 100%)' }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Mail className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white leading-tight">
                  Automated Email Report Settings
                </h2>
                <p className="text-xs text-white/90 font-medium">
                  Configure daily automated report deliveries via Microsoft 365
                </p>
              </div>
            </div>

            <button
              onClick={closeDrawer}
              className="rounded-xl p-2 text-white/80 hover:text-white hover:bg-white/20 transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-zinc-800/80 bg-black/30 px-6 pt-2 gap-2 overflow-x-auto select-none">
            <button
              onClick={() => {
                setActiveTab('schedules');
                setEditingSchedule(null);
              }}
              className={cn(
                'flex items-center gap-2 py-2.5 px-4 text-xs font-bold rounded-t-xl transition-all border-b-2',
                activeTab === 'schedules'
                  ? 'border-[#f26522] text-[#f26522] bg-white/5'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              )}
            >
              <Clock className="h-4 w-4" />
              Active Schedules ({schedules.length})
            </button>

            <button
              onClick={() => {
                setActiveTab('create');
              }}
              className={cn(
                'flex items-center gap-2 py-2.5 px-4 text-xs font-bold rounded-t-xl transition-all border-b-2',
                activeTab === 'create'
                  ? 'border-[#f26522] text-[#f26522] bg-white/5'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              )}
            >
              <Plus className="h-4 w-4" />
              {editingSchedule ? 'Edit Schedule' : '+ New Schedule'}
            </button>

            <button
              onClick={() => setActiveTab('status')}
              className={cn(
                'flex items-center gap-2 py-2.5 px-4 text-xs font-bold rounded-t-xl transition-all border-b-2',
                activeTab === 'status'
                  ? 'border-[#f26522] text-[#f26522] bg-white/5'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              Microsoft 365
              {graphStatus?.connected && (
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* TAB 1: LIST ACTIVE SCHEDULES */}
            {activeTab === 'schedules' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-200">Scheduled Email Automations</h3>
                    <p className="text-xs text-zinc-400">
                      Reports will automatically generate and email at their scheduled times.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingSchedule(null);
                      setActiveTab('create');
                    }}
                    className="bg-[#f26522] hover:bg-[#d9531e] text-white text-xs font-bold rounded-xl gap-1.5 shadow-md shadow-orange-950/40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New Schedule
                  </Button>
                </div>

                {schedules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-zinc-800 bg-white/5">
                    <Mail className="h-12 w-12 text-zinc-600 mb-3" />
                    <p className="text-sm font-bold text-zinc-300">No email schedules configured yet</p>
                    <p className="text-xs text-zinc-500 max-w-sm mt-1">
                      Click "+ New Schedule" above to set up daily automatic reports with client & recipient preferences.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {schedules.map((sched) => (
                      <div
                        key={sched.id}
                        className={cn(
                          'p-4 rounded-2xl border transition-all duration-200 bg-zinc-900/60 backdrop-blur-md',
                          sched.enabled
                            ? 'border-zinc-800 hover:border-orange-500/40 shadow-lg'
                            : 'border-zinc-800/50 opacity-60'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-white truncate">
                                {sched.name}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#f26522]/15 text-[#f26522] border border-[#f26522]/30">
                                {sched.clientName}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                {REPORT_OPTIONS.find((r) => r.id === sched.reportType)?.name || sched.reportType}
                              </span>
                            </div>

                            <div className="flex items-center gap-4 text-xs text-zinc-400 pt-1 flex-wrap">
                              <span className="flex items-center gap-1 text-amber-400 font-bold">
                                <Clock className="h-3.5 w-3.5" />
                                {sched.time} ({sched.frequency})
                              </span>
                              <span className="flex items-center gap-1 text-zinc-400">
                                <Calendar className="h-3.5 w-3.5" />
                                {DATE_PRESET_OPTIONS.find((d) => d.id === sched.datePreset)?.label || sched.datePreset}
                              </span>
                              <span className="flex items-center gap-1 text-emerald-400">
                                <FileSpreadsheet className="h-3.5 w-3.5" />
                                {sched.formats.join(' + ').toUpperCase()}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-zinc-400 pt-1">
                              <Mail className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                              <span className="truncate">
                                Recipients: <strong className="text-zinc-300">{sched.recipients.join(', ')}</strong>
                              </span>
                            </div>

                            {sched.lastRunAt && (
                              <p className="text-[11px] text-zinc-500 pt-1">
                                Last run: {new Date(sched.lastRunAt).toLocaleString()} •{' '}
                                <span
                                  className={
                                    sched.lastRunStatus === 'success' ? 'text-emerald-400' : 'text-rose-400'
                                  }
                                >
                                  {sched.lastRunStatus === 'success' ? 'Delivered' : 'Failed'}
                                </span>
                              </p>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              title="Toggle Enable/Disable"
                              onClick={() => toggleSchedule(sched.id)}
                              className={cn(
                                'h-8 px-2.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1',
                                sched.enabled
                                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                  : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
                              )}
                            >
                              {sched.enabled ? 'Active' : 'Paused'}
                            </button>

                            <button
                              title="Run & Send Report Now"
                              onClick={async () => {
                                const res = await runScheduleNow(sched.id);
                                alert(res.message);
                              }}
                              className="p-2 rounded-lg bg-orange-500/10 hover:bg-orange-500/25 text-[#f26522] transition-colors"
                            >
                              <Play className="h-4 w-4" />
                            </button>

                            <button
                              title="Edit Schedule"
                              onClick={() => {
                                setEditingSchedule(sched);
                                setActiveTab('create');
                              }}
                              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>

                            <button
                              title="Delete Schedule"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete schedule "${sched.name}"?`)) {
                                  deleteSchedule(sched.id);
                                }
                              }}
                              className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: CONFIGURE / NEW SCHEDULE FORM */}
            {activeTab === 'create' && (
              <div className="space-y-6">
                {/* 1. Schedule Name */}
                <div className="space-y-2">
                  <label className="text-xs font-extrabold tracking-wider uppercase text-zinc-400">
                    Schedule Name
                  </label>
                  <input
                    type="text"
                    value={scheduleName}
                    onChange={(e) => setScheduleName(e.target.value)}
                    placeholder="e.g. Digicel POM Morning Fuel Recon"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#f26522]"
                  />
                </div>

                {/* 2. Target Client Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-extrabold tracking-wider uppercase text-zinc-400 flex items-center justify-between">
                    <span>1. Target Client (Konse Client Ki Report)</span>
                    <span className="text-[11px] text-[#f26522] font-semibold">Select Client</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 border border-zinc-800 rounded-xl p-2 bg-black/40">
                    {CLIENTS.map((client) => {
                      const isSelected = selectedClient === client.name;
                      return (
                        <button
                          key={client.name}
                          type="button"
                          onClick={() => setSelectedClient(client.name)}
                          className={cn(
                            'flex items-center justify-between p-2.5 rounded-lg text-left text-xs font-semibold transition-all border',
                            isSelected
                              ? 'bg-[#f26522] text-white border-[#f26522] shadow-md'
                              : 'bg-zinc-900/70 text-zinc-300 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800'
                          )}
                        >
                          <span className="truncate">{client.name}</span>
                          {isSelected && <Check className="h-3.5 w-3.5 shrink-0 ml-1" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Report Type Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-extrabold tracking-wider uppercase text-zinc-400">
                    2. Report Type (Konsi Report)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {REPORT_OPTIONS.map((rep) => {
                      const isSelected = selectedReport === rep.id;
                      const Icon = rep.icon;
                      return (
                        <button
                          key={rep.id}
                          type="button"
                          onClick={() => setSelectedReport(rep.id)}
                          className={cn(
                            'flex items-start gap-3 p-3 rounded-xl text-left transition-all border',
                            isSelected
                              ? 'bg-orange-950/40 border-[#f26522] ring-1 ring-[#f26522]'
                              : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/60'
                          )}
                        >
                          <div
                            className={cn(
                              'p-2 rounded-lg shrink-0 mt-0.5',
                              isSelected ? 'bg-[#f26522] text-white' : 'bg-zinc-800 text-zinc-400'
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white leading-tight">{rep.name}</p>
                            <p className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5">{rep.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Date Range Window Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-extrabold tracking-wider uppercase text-zinc-400">
                    3. Date Range Period (Kab Se Kab Tak Ki)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {DATE_PRESET_OPTIONS.map((preset) => {
                      const isSelected = selectedDatePreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setSelectedDatePreset(preset.id)}
                          className={cn(
                            'p-2.5 rounded-xl text-left transition-all border flex flex-col justify-between',
                            isSelected
                              ? 'bg-[#f26522] text-white border-[#f26522] shadow-sm'
                              : 'bg-zinc-900/70 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                          )}
                        >
                          <span className="text-xs font-bold">{preset.label}</span>
                          <span className="text-[10px] opacity-80 mt-1 line-clamp-1">{preset.desc}</span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedDatePreset === 'custom' && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-black/40 border border-zinc-800 rounded-xl mt-2">
                      <div>
                        <label className="text-[11px] font-bold text-zinc-400">Start Date</label>
                        <input
                          type="date"
                          value={customStart}
                          onChange={(e) => setCustomStart(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-xs text-white mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-zinc-400">End Date</label>
                        <input
                          type="date"
                          value={customEnd}
                          onChange={(e) => setCustomEnd(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-xs text-white mt-1"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Schedule Timing & Frequency */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold tracking-wider uppercase text-zinc-400">
                      4. Dispatch Timing (Har Din Kab Email Jayegi)
                    </label>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-orange-500/20 text-[#f26522] border border-orange-500/30">
                      <Clock className="h-3 w-3 text-[#f26522]" />
                      {formatTime12H(selectedTime)} ({selectedTime})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* Time Selection Card */}
                    <div className="p-3 bg-zinc-900/70 border border-zinc-800 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-400 font-bold flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-zinc-500" />
                          Delivery Time
                        </span>

                        {/* Mode toggle */}
                        <div className="flex gap-1 bg-black/50 p-0.5 rounded-lg border border-zinc-800">
                          <button
                            type="button"
                            onClick={() => setShowCustomTimeBuilder(false)}
                            className={cn(
                              'text-[10px] font-bold px-2 py-0.5 rounded-md transition-all',
                              !showCustomTimeBuilder
                                ? 'bg-[#f26522] text-white'
                                : 'text-zinc-400 hover:text-white'
                            )}
                          >
                            Presets
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowCustomTimeBuilder(true)}
                            className={cn(
                              'text-[10px] font-bold px-2 py-0.5 rounded-md transition-all',
                              showCustomTimeBuilder
                                ? 'bg-[#f26522] text-white'
                                : 'text-zinc-400 hover:text-white'
                            )}
                          >
                            Custom Time
                          </button>
                        </div>
                      </div>

                      {/* View 1: Presets & Native Input */}
                      {!showCustomTimeBuilder ? (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              value={selectedTime}
                              onChange={(e) => {
                                if (e.target.value) {
                                  setSelectedTime(e.target.value);
                                  if (!timePresets.includes(e.target.value)) {
                                    setTimePresets((prev) => [...prev, e.target.value].sort());
                                  }
                                }
                              }}
                              className="bg-black/60 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white font-bold focus:outline-none focus:border-[#f26522] cursor-pointer"
                            />
                            <span className="text-xs font-bold text-zinc-300">
                              {formatTime12H(selectedTime)}
                            </span>
                          </div>

                          {/* Quick Presets Grid */}
                          <div className="flex gap-1.5 flex-wrap max-h-28 overflow-y-auto pr-1">
                            {timePresets.map((t) => {
                              const isSelected = selectedTime === t;
                              return (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => setSelectedTime(t)}
                                  className={cn(
                                    'text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1',
                                    isSelected
                                      ? 'bg-[#f26522] text-white border-[#f26522] shadow-sm'
                                      : 'bg-zinc-900/90 text-zinc-300 border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800'
                                  )}
                                >
                                  {formatTime12H(t)}
                                  {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                                </button>
                              );
                            })}
                          </div>

                          {/* Quick custom preset adder */}
                          <div className="pt-1">
                            {!isAddingNewPreset ? (
                              <button
                                type="button"
                                onClick={() => setIsAddingNewPreset(true)}
                                className="text-[11px] font-bold text-[#f26522] hover:text-[#ff9f1c] flex items-center gap-1"
                              >
                                <Plus className="h-3 w-3" />
                                Add Custom Time Preset
                              </button>
                            ) : (
                              <div className="flex items-center gap-1.5 bg-black/60 p-1.5 rounded-lg border border-zinc-700">
                                <input
                                  type="time"
                                  value={newPresetInput}
                                  onChange={(e) => setNewPresetInput(e.target.value)}
                                  className="bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-xs text-white font-bold focus:outline-none focus:border-[#f26522]"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (newPresetInput) {
                                      if (!timePresets.includes(newPresetInput)) {
                                        setTimePresets([...timePresets, newPresetInput].sort());
                                      }
                                      setSelectedTime(newPresetInput);
                                      setNewPresetInput('');
                                      setIsAddingNewPreset(false);
                                    }
                                  }}
                                  className="bg-[#f26522] hover:bg-[#d9531e] text-white text-[10px] font-extrabold px-2 py-1 rounded"
                                >
                                  Add
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIsAddingNewPreset(false)}
                                  className="text-zinc-400 hover:text-white p-1 text-[10px]"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* View 2: Custom Time Builder */
                        <div className="space-y-3 bg-black/50 p-2.5 rounded-xl border border-zinc-800">
                          <div className="grid grid-cols-3 gap-2">
                            {/* Hour Picker */}
                            <div>
                              <label className="text-[10px] font-extrabold text-zinc-400 block mb-1">
                                Hour
                              </label>
                              <select
                                value={customHour}
                                onChange={(e) => {
                                  const h = Number(e.target.value);
                                  setCustomHour(h);
                                  const t24 = formatTime24H(h, customMinute, customAmPm);
                                  setSelectedTime(t24);
                                  if (!timePresets.includes(t24)) {
                                    setTimePresets((prev) => [...prev, t24].sort());
                                  }
                                }}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-1.5 text-xs font-bold text-white focus:outline-none focus:border-[#f26522]"
                              >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                                  <option key={h} value={h}>
                                    {String(h).padStart(2, '0')}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Minute Picker */}
                            <div>
                              <label className="text-[10px] font-extrabold text-zinc-400 block mb-1">
                                Minute
                              </label>
                              <select
                                value={customMinute}
                                onChange={(e) => {
                                  const m = Number(e.target.value);
                                  setCustomMinute(m);
                                  const t24 = formatTime24H(customHour, m, customAmPm);
                                  setSelectedTime(t24);
                                  if (!timePresets.includes(t24)) {
                                    setTimePresets((prev) => [...prev, t24].sort());
                                  }
                                }}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-1.5 text-xs font-bold text-white focus:outline-none focus:border-[#f26522]"
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
                              <label className="text-[10px] font-extrabold text-zinc-400 block mb-1">
                                AM / PM
                              </label>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustomAmPm('AM');
                                    const t24 = formatTime24H(customHour, customMinute, 'AM');
                                    setSelectedTime(t24);
                                    if (!timePresets.includes(t24)) {
                                      setTimePresets((prev) => [...prev, t24].sort());
                                    }
                                  }}
                                  className={cn(
                                    'flex-1 py-1 rounded text-xs font-bold border transition-all',
                                    customAmPm === 'AM'
                                      ? 'bg-[#f26522] text-white border-[#f26522]'
                                      : 'bg-zinc-900 text-zinc-400 border-zinc-700'
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
                                    if (!timePresets.includes(t24)) {
                                      setTimePresets((prev) => [...prev, t24].sort());
                                    }
                                  }}
                                  className={cn(
                                    'flex-1 py-1 rounded text-xs font-bold border transition-all',
                                    customAmPm === 'PM'
                                      ? 'bg-[#f26522] text-white border-[#f26522]'
                                      : 'bg-zinc-900 text-zinc-400 border-zinc-700'
                                  )}
                                >
                                  PM
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-zinc-800">
                            <span>
                              Selected: <strong className="text-white">{formatTime12H(selectedTime)}</strong> ({selectedTime})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (!timePresets.includes(selectedTime)) {
                                  setTimePresets((prev) => [...prev, selectedTime].sort());
                                }
                                setShowCustomTimeBuilder(false);
                              }}
                              className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300"
                            >
                              ✓ Save as Preset
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Frequency Card */}
                    <div className="p-3 bg-zinc-900/70 border border-zinc-800 rounded-xl space-y-2">
                      <span className="text-xs text-zinc-400 font-bold block flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                        Frequency
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: 'daily', label: 'Every Day' },
                          { id: 'weekdays', label: 'Mon - Fri' },
                          { id: 'weekly', label: 'Weekly' },
                          { id: 'monthly', label: 'Monthly' },
                        ].map((freq) => (
                          <button
                            key={freq.id}
                            type="button"
                            onClick={() => setSelectedFrequency(freq.id as ScheduleFrequency)}
                            className={cn(
                              'text-xs font-bold py-2 px-2 rounded-lg border text-center transition-all',
                              selectedFrequency === freq.id
                                ? 'bg-[#f26522] text-white border-[#f26522]'
                                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
                            )}
                          >
                            {freq.label}
                          </button>
                        ))}
                      </div>

                      <div className="p-2 bg-black/40 rounded-lg border border-zinc-800/80 text-[11px] text-zinc-400 leading-snug">
                        🔔 Email will dispatch <strong>{selectedFrequency === 'daily' ? 'every day' : selectedFrequency}</strong> at <strong>{formatTime12H(selectedTime)}</strong>.
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6. Recipient Emails Input */}
                <div className="space-y-2">
                  <label className="text-xs font-extrabold tracking-wider uppercase text-zinc-400">
                    5. Receiver Email Addresses (Kisko Mail Jayegi)
                  </label>
                  <div className="p-3 bg-zinc-900/70 border border-zinc-800 rounded-xl space-y-2.5">
                    <div className="flex gap-2">
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
                        placeholder="Type recipient email and click Add or press Enter..."
                        className="flex-1 bg-black/60 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#f26522]"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddRecipient}
                        className="bg-[#f26522] hover:bg-[#d9531e] text-white text-xs font-bold rounded-lg px-4"
                      >
                        + Add
                      </Button>
                    </div>

                    {/* Chips */}
                    <div className="flex flex-wrap gap-1.5 min-h-[36px] items-center p-2 bg-black/40 rounded-lg border border-zinc-800/80">
                      {recipients.length === 0 ? (
                        <span className="text-xs text-zinc-500 italic">
                          No recipients added yet. Add at least one receiver email.
                        </span>
                      ) : (
                        recipients.map((email) => (
                          <span
                            key={email}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-300 border border-orange-500/30"
                          >
                            <Mail className="h-3 w-3 text-orange-400" />
                            {email}
                            <button
                              type="button"
                              onClick={() => handleRemoveRecipient(email)}
                              className="ml-1 hover:text-white"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* 7. Attachment Formats */}
                <div className="space-y-2">
                  <label className="text-xs font-extrabold tracking-wider uppercase text-zinc-400">
                    6. File Attachments & Format
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'excel', label: 'Excel (.xlsx)', icon: FileSpreadsheet },
                      { id: 'pdf', label: 'PDF Document', icon: FileText },
                      { id: 'csv', label: 'CSV File', icon: FileDown },
                      { id: 'inlineHtml', label: 'HTML Table', icon: Mail },
                    ].map((fmt) => {
                      const isChecked = selectedFormats.includes(fmt.id as ReportFormat);
                      const Icon = fmt.icon;
                      return (
                        <button
                          key={fmt.id}
                          type="button"
                          onClick={() => handleToggleFormat(fmt.id as ReportFormat)}
                          className={cn(
                            'p-2.5 rounded-xl text-left border flex items-center gap-2 transition-all',
                            isChecked
                              ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300'
                              : 'bg-zinc-900/60 border-zinc-800 text-zinc-500'
                          )}
                        >
                          <div
                            className={cn(
                              'h-4 w-4 rounded border flex items-center justify-center text-[10px]',
                              isChecked
                                ? 'bg-emerald-500 border-emerald-500 text-black font-extrabold'
                                : 'border-zinc-600'
                            )}
                          >
                            {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                          <Icon className="h-4 w-4" />
                          <span className="text-xs font-bold">{fmt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 7. Email Subject Line Template */}
                <div className="space-y-2">
                  <label className="text-xs font-extrabold tracking-wider uppercase text-zinc-400 flex items-center justify-between">
                    <span>7. Email Subject Line (Optional Template)</span>
                    <span className="text-[11px] text-zinc-500 font-normal">Leave empty for recommended format</span>
                  </label>
                  <div className="p-3 bg-zinc-900/70 border border-zinc-800 rounded-xl space-y-2">
                    <input
                      type="text"
                      value={subjectTemplate}
                      onChange={(e) => setSubjectTemplate(e.target.value)}
                      placeholder="{ClientName} Fuel Bowser Reconciliation Report: {FromDate}-{ToDate}"
                      className="w-full bg-black/60 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#f26522]"
                    />
                    <p className="text-[10px] text-zinc-400">
                      <strong>Tokens:</strong> <code className="text-[#f26522]">{'{ClientName}'}</code>, <code className="text-[#f26522]">{'{FromDate}'}</code>, <code className="text-[#f26522]">{'{ToDate}'}</code>, <code className="text-[#f26522]">{'{ReportName}'}</code>
                    </p>
                  </div>
                </div>

                {/* Status / Feedback Alerts */}
                {formError && (
                  <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl flex items-center gap-2 text-xs text-rose-300">
                    <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {formSuccess && (
                  <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
                    <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>{formSuccess}</span>
                  </div>
                )}

                {lastTestResult && (
                  <div
                    className={cn(
                      'p-3.5 rounded-xl border text-xs leading-relaxed space-y-1',
                      lastTestResult.success
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                        : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      {lastTestResult.success ? (
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-rose-400" />
                      )}
                      <span>Test Dispatch Result</span>
                    </div>
                    <p className="text-[11px] opacity-90">{lastTestResult.message}</p>
                  </div>
                )}

                {/* Submit & Test Action Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <Button
                    type="button"
                    onClick={handleSaveSchedule}
                    className="flex-1 bg-[#f26522] hover:bg-[#d9531e] text-white font-extrabold text-sm py-3 rounded-xl shadow-lg shadow-orange-950/50 gap-2"
                  >
                    <Check className="h-4 w-4" />
                    {editingSchedule ? 'Update Schedule' : 'Save & Activate Schedule'}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSendingTest}
                    onClick={handleTestNow}
                    className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-white font-bold text-xs py-3 rounded-xl gap-2"
                  >
                    {isSendingTest ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#f26522]" />
                        Dispatching Test Email...
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5 text-[#f26522]" />
                        Send Test Report Now
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* TAB 3: MICROSOFT 365 STATUS */}
            {activeTab === 'status' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-xl bg-[#f26522]/20 flex items-center justify-center text-[#f26522]">
                        <ShieldCheck className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Microsoft Graph Mail Engine</h4>
                        <p className="text-xs text-zinc-400">
                          Automated email delivery via Microsoft 365 Cloud
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={checkingGraph}
                      onClick={checkGraphConnection}
                      className="text-xs bg-zinc-800 border-zinc-700 text-zinc-200 gap-1.5"
                    >
                      <RefreshCw className={cn('h-3.5 w-3.5', checkingGraph && 'animate-spin')} />
                      Check Health
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-black/40 rounded-xl border border-zinc-800/80">
                      <span className="text-[11px] text-zinc-500 font-bold block">Status</span>
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mt-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        API Engine Ready
                      </span>
                    </div>

                    <div className="p-3 bg-black/40 rounded-xl border border-zinc-800/80">
                      <span className="text-[11px] text-zinc-500 font-bold block">Sender Account</span>
                      <span className="text-xs font-bold text-white mt-1 truncate block">
                        {graphStatus?.sender || 'support@yourcompany.com'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-1 text-xs text-blue-300">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Info className="h-4 w-4 text-blue-400" />
                      <span>Configuration Details</span>
                    </div>
                    <p className="text-[11px] text-blue-300/80">
                      Credentials configured in <code>.env.local</code>:
                      <br />• <code>MICROSOFT_TENANT_ID</code>
                      <br />• <code>MICROSOFT_CLIENT_ID</code>
                      <br />• <code>MICROSOFT_CLIENT_SECRET</code>
                      <br />• <code>MICROSOFT_SENDER_EMAIL</code>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
