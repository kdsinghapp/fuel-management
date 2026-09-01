'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Check, ChevronDown } from 'lucide-react';
import { FuelLevel } from '@/types/fuel';

export type DateRangePreset = 
  | 'all'
  | 'today'
  | 'yesterday'
  | 'weekToDate'
  | '7days'
  | '14days'
  | '21days'
  | '30days'
  | 'monthToDate'
  | 'lastMonth'
  | 'custom';

export interface DateRange {
  preset: DateRangePreset;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  label: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  allRecords?: FuelLevel[];
}

export function getDateRangeFromPreset(preset: DateRangePreset, customStart?: string, customEnd?: string): DateRange {
  const formatYMD = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const today = new Date();
  const todayStr = formatYMD(today);

  switch (preset) {
    case 'all':
      return { preset: 'all', startDate: undefined, endDate: undefined, label: 'All data' };
    case 'today':
      return { preset: 'today', startDate: todayStr, endDate: todayStr, label: 'Today' };
    case 'yesterday': {
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      const yestStr = formatYMD(d);
      return { preset: 'yesterday', startDate: yestStr, endDate: yestStr, label: 'Yesterday' };
    }
    case 'weekToDate': {
      const d = new Date(today);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      return { preset: 'weekToDate', startDate: formatYMD(monday), endDate: todayStr, label: 'Week to Date' };
    }
    case '7days': {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      return { preset: '7days', startDate: formatYMD(d), endDate: todayStr, label: '7 Days' };
    }
    case '14days': {
      const d = new Date(today);
      d.setDate(d.getDate() - 13);
      return { preset: '14days', startDate: formatYMD(d), endDate: todayStr, label: '14 Days' };
    }
    case '21days': {
      const d = new Date(today);
      d.setDate(d.getDate() - 20);
      return { preset: '21days', startDate: formatYMD(d), endDate: todayStr, label: '21 Days' };
    }
    case '30days': {
      const d = new Date(today);
      d.setDate(d.getDate() - 29);
      return { preset: '30days', startDate: formatYMD(d), endDate: todayStr, label: '30 Days' };
    }
    case 'monthToDate': {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      return { preset: 'monthToDate', startDate: formatYMD(firstDay), endDate: todayStr, label: 'Month to Date' };
    }
    case 'lastMonth': {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      return { preset: 'lastMonth', startDate: formatYMD(firstDay), endDate: formatYMD(lastDay), label: 'Last Month' };
    }
    case 'custom':
      return {
        preset: 'custom',
        startDate: customStart,
        endDate: customEnd,
        label: customStart && customEnd ? `${customStart} - ${customEnd}` : 'Custom Range'
      };
    default:
      return { preset: 'all', startDate: undefined, endDate: undefined, label: 'All data' };
  }
}

export function DateRangePicker({ value, onChange, allRecords = [] }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customStart, setCustomStart] = useState(value.startDate || '');
  const [customEnd, setCustomEnd] = useState(value.endDate || '');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const countForRange = (preset: DateRangePreset) => {
    if (!allRecords || allRecords.length === 0) return null;
    const { startDate, endDate } = getDateRangeFromPreset(preset);
    if (!startDate && !endDate) return allRecords.length;

    return allRecords.filter(r => {
      if (startDate && r.date < startDate) return false;
      if (endDate && r.date > endDate) return false;
      return true;
    }).length;
  };

  const [activeTab, setActiveTab] = useState<DateRangePreset>(value.preset);

  useEffect(() => {
    setActiveTab(value.preset);
  }, [value.preset]);

  const handleSelectPreset = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      setActiveTab('custom');
    } else {
      setActiveTab(preset);
      const range = getDateRangeFromPreset(preset);
      onChange(range);
      setIsOpen(false);
    }
  };

  const handleApplyCustom = () => {
    const range = getDateRangeFromPreset('custom', customStart, customEnd);
    onChange(range);
    setIsOpen(false);
  };

  const presets: { key: DateRangePreset; label: string; hasCalendarIcon?: boolean }[] = [
    { key: 'all', label: 'All data' },
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'weekToDate', label: 'Week to Date' },
    { key: '7days', label: '7 Days' },
    { key: '14days', label: '14 Days' },
    { key: '21days', label: '21 Days' },
    { key: '30days', label: '30 Days' },
    { key: 'monthToDate', label: 'Month to Date', hasCalendarIcon: true },
    { key: 'lastMonth', label: 'Last Month', hasCalendarIcon: true },
    { key: 'custom', label: 'Custom Range', hasCalendarIcon: true },
  ];

  return (
    <div className="relative w-full sm:w-[200px]" ref={popoverRef}>
      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
        DATE RANGE
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-8 px-3 bg-white border border-slate-200 rounded text-xs text-slate-800 font-medium flex items-center justify-between hover:border-slate-300 shadow-xs focus:outline-none focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522]"
      >
        <span className="truncate">{value.label}</span>
        <div className="flex items-center gap-1.5 text-slate-400">
          <Calendar className="h-3.5 w-3.5" />
          <ChevronDown className="h-3 w-3" />
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-64 bg-white rounded-lg shadow-xl border border-slate-200 z-50 py-2 text-xs">
          <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            PREDEFINED RANGES
          </div>

          <div className="mt-1 max-h-[320px] overflow-y-auto">
            {presets.map((p) => {
              const isSelected = activeTab === p.key;
              const count = countForRange(p.key);

              return (
                <div key={p.key}>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset(p.key)}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-50 transition-colors ${
                      isSelected ? 'bg-emerald-50/60 font-semibold text-slate-900' : 'text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{p.label}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                    </div>

                    <div className="flex items-center gap-2">
                      {p.hasCalendarIcon && <Calendar className="h-3.5 w-3.5 text-slate-400" />}
                      {count !== null && count !== undefined && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] font-medium min-w-[20px] text-center ${
                            isSelected
                              ? 'bg-emerald-100 text-emerald-700 font-bold'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </div>
                  </button>

                  {p.key === '30days' && <div className="my-1.5 border-t border-slate-100" />}
                  {p.key === 'lastMonth' && <div className="my-1.5 border-t border-slate-100" />}
                </div>
              );
            })}
          </div>

          {activeTab === 'custom' && (
            <div className="px-3 pt-2.5 mt-1 border-t border-slate-100 flex flex-col gap-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500 font-medium block mb-0.5">From</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full border border-slate-200 rounded px-2 py-1 text-[11px]"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500 font-medium block mb-0.5">To</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full border border-slate-200 rounded px-2 py-1 text-[11px]"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleApplyCustom}
                className="w-full bg-[#f26522] text-white py-1 rounded text-xs font-medium hover:bg-[#d94f12] transition-colors"
              >
                Apply Custom Range
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
