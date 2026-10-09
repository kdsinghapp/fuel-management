// src/app/(dashboard)/vehicles/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Search,
    Download,
    Printer,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    ChevronDown,
    FileSpreadsheet,
    FileText,
    FileDown,
    AlertTriangle,
    RotateCcw,
    Check,
} from 'lucide-react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageContainer } from '@/components/layout/PageContainer';
import { vehicleService } from '@/services/vehicleService';
import { authService } from '@/lib/auth';
import { formatNumber, exportToCSV, exportToExcel, exportToPDF } from '@/lib/utils';
import { FuelEfficiencyTransaction } from '@/types/vehicle';
import { useClientStore } from '@/services/api';
import { cn } from '@/lib/utils';

// Distinct curated color palette for multi-vehicle chart
const VEHICLE_COLORS = [
    '#0d9488', // Teal
    '#c026d3', // Pink / Magenta
    '#6366f1', // Indigo / Purple
    '#16a34a', // Green
    '#ea580c', // Orange
    '#0284c7', // Sky blue
    '#e11d48', // Rose
    '#d97706', // Amber
    '#8b5cf6', // Violet
    '#059669', // Emerald
];

type TabType = 'chart' | 'report' | 'summary';
type SummaryGranularity = 'Yearly' | 'Quarterly' | 'Monthly' | 'Weekly' | 'Daily';

interface VehicleMeta {
    Asset?: string;
    FleetId?: string;
    Make?: string;
    Model?: string;
    Department?: string;
    StandardBurnRate?: number;
    TargetKmPerL?: number;
}

export default function VehiclesPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedClient = useClientStore((state) => state.selectedClient);

    // Active tab: sync from URL query param ?tab= or default to 'chart'
    const tabParam = (searchParams.get('tab') as TabType) || 'chart';
    const [activeTab, setActiveTab] = useState<TabType>(
        ['chart', 'report', 'summary'].includes(tabParam) ? tabParam : 'chart'
    );

    useEffect(() => {
        if (tabParam && ['chart', 'report', 'summary'].includes(tabParam)) {
            setActiveTab(tabParam);
        }
    }, [tabParam]);

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        window.history.pushState({}, '', url.toString());
    };

    // Data states
    const [transactions, setTransactions] = useState<FuelEfficiencyTransaction[]>([]);
    const [vehicleMetadata, setVehicleMetadata] = useState<Map<string, VehicleMeta>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Common search filter
    const [searchTerm, setSearchTerm] = useState('');

    // Chart view states
    const [selectedMonth, setSelectedMonth] = useState<string>('Oct 2026');
    const [selectedChartVehicles, setSelectedChartVehicles] = useState<string[]>([]);

    // Report view states
    const [selectedReportVehicles, setSelectedReportVehicles] = useState<string[]>([]);
    const [reportPage, setReportPage] = useState(1);
    const [reportPageSize, setReportPageSize] = useState<number>(10);
    const [allDataFilter, setAllDataFilter] = useState<string>('all');

    // Summary view states
    const [summaryGranularity, setSummaryGranularity] = useState<SummaryGranularity>('Yearly');
    const [summaryPage, setSummaryPage] = useState(1);
    const [summaryPageSize, setSummaryPageSize] = useState<number>(20);

    // Export dropdown
    const [exportOpen, setExportOpen] = useState(false);
    const [isExporting, setIsExporting] = useState<string | null>(null);
    const exportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
                setExportOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Load initial data
    useEffect(() => {
        const checkAuthAndLoad = async () => {
            const isAuthenticated = await authService.isAuthenticated();
            if (!isAuthenticated) {
                router.push('/login');
                return;
            }
            loadAllData();
        };
        checkAuthAndLoad();
    }, [router, selectedClient]);

    const loadAllData = async () => {
        try {
            setLoading(true);

            // 1. Fetch live metadata from /api/vehicles
            const metaMap = new Map<string, VehicleMeta>();
            try {
                const resMeta = await fetch('/api/vehicles');
                if (resMeta.ok) {
                    const jsonMeta = await resMeta.json();
                    if (jsonMeta.success && Array.isArray(jsonMeta.data)) {
                        jsonMeta.data.forEach((v: any) => {
                            const key = (v.Asset || v.FleetId || '').toString().trim().toUpperCase();
                            if (key) {
                                metaMap.set(key, v);
                                if (v.FleetId) metaMap.set(v.FleetId.toString().trim().toUpperCase(), v);
                                if (v.Asset) metaMap.set(v.Asset.toString().trim().toUpperCase(), v);
                            }
                        });
                    }
                }
            } catch (err) {
                console.warn('Failed to load vehicle metadata:', err);
            }
            setVehicleMetadata(metaMap);

            // 2. Fetch all fuel efficiency transactions
            const res = await vehicleService.getFuelEfficiencyTransactions({});
            setTransactions(res.data || []);

            // Set initial selected vehicles if available
            const uniqueVehicles = Array.from(
                new Set(
                    (res.data || [])
                        .map((tx) => tx.vehicleId || tx.fleetId)
                        .filter(Boolean)
                )
            );
            if (uniqueVehicles.length > 0) {
                setSelectedChartVehicles(uniqueVehicles.slice(0, 3));
                setSelectedReportVehicles(uniqueVehicles);
            }

            setError(null);
        } catch (err) {
            console.error('Failed to load vehicles data:', err);
            setError('Failed to load vehicle transactions and efficiency data.');
        } finally {
            setLoading(false);
            useClientStore.getState().setClientLoading(false);
        }
    };

    // List of unique vehicles with rich details
    const vehicleList = useMemo(() => {
        const map = new Map<string, { id: string; reg: string; label: string; make: string; model: string }>();
        transactions.forEach((tx) => {
            const vId = (tx.vehicleId || tx.fleetId || 'Unknown').trim();
            if (!map.has(vId)) {
                const meta = vehicleMetadata.get(vId.toUpperCase());
                const reg = tx.fleetId && tx.fleetId !== vId ? tx.fleetId : meta?.FleetId || '';
                const label = reg ? `${vId} · ${reg}` : vId;
                map.set(vId, {
                    id: vId,
                    reg: reg,
                    label: label,
                    make: meta?.Make || tx.dem || tx.depot || 'Toyota',
                    model: meta?.Model || 'L/C',
                });
            }
        });
        return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
    }, [transactions, vehicleMetadata]);

    // Available month list (e.g. Oct 2026, Sept 2026, Aug 2026, Jul 2026, Jun 2026)
    const monthOptions = useMemo(() => {
        const months = new Set<string>();
        // Add default recent months
        const now = new Date();
        for (let i = 0; i < 5; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const mName = d.toLocaleString('en-US', { month: 'short' });
            months.add(`${mName} ${d.getFullYear()}`);
        }
        // Extract any months present in transactions
        transactions.forEach((tx) => {
            if (tx.date) {
                const parts = tx.date.split('-');
                if (parts.length >= 2) {
                    const y = parseInt(parts[0], 10);
                    const m = parseInt(parts[1], 10) - 1;
                    const d = new Date(y, m, 1);
                    if (!isNaN(d.getTime())) {
                        const mName = d.toLocaleString('en-US', { month: 'short' });
                        months.add(`${mName} ${y}`);
                    }
                }
            }
        });
        return Array.from(months);
    }, [transactions]);

    // Auto-select initial month if selectedMonth is not in options
    useEffect(() => {
        if (monthOptions.length > 0 && !monthOptions.includes(selectedMonth)) {
            setSelectedMonth(monthOptions[0]);
        }
    }, [monthOptions, selectedMonth]);

    // Assign consistent color per vehicle
    const vehicleColorMap = useMemo(() => {
        const colors = new Map<string, string>();
        vehicleList.forEach((v, index) => {
            colors.set(v.id, VEHICLE_COLORS[index % VEHICLE_COLORS.length]);
        });
        return colors;
    }, [vehicleList]);

    // -------------------------------------------------------------
    // 1. CHART VIEW COMPUTATIONS
    // -------------------------------------------------------------
    const chartData = useMemo(() => {
        // Filter transactions by selectedMonth
        // Month string format: "Oct 2026"
        const [mStr, yStr] = selectedMonth.split(' ');
        const monthNum = new Date(`${mStr} 1, 2000`).getMonth();
        const yearNum = parseInt(yStr, 10);

        const daysInMonth = yearNum && !isNaN(monthNum) ? new Date(yearNum, monthNum + 1, 0).getDate() : 31;
        const daysMap: { [day: number]: { day: number; [vehicleKey: string]: any } } = {};

        for (let d = 1; d <= daysInMonth; d++) {
            daysMap[d] = { day: d };
        }

        const filteredTx = transactions.filter((tx) => {
            if (!tx.date) return false;
            const txD = new Date(tx.date);
            if (isNaN(txD.getTime())) return false;
            return txD.getFullYear() === yearNum && txD.getMonth() === monthNum;
        });

        // Populate days
        filteredTx.forEach((tx) => {
            const vId = (tx.vehicleId || tx.fleetId || '').trim();
            if (!selectedChartVehicles.includes(vId)) return;

            const day = new Date(tx.date).getDate();
            if (daysMap[day]) {
                const consumption = tx.consumption != null ? Number(tx.consumption.toFixed(2)) : null;
                if (consumption !== null) {
                    daysMap[day][vId] = consumption;
                }
            }
        });

        return Object.values(daysMap);
    }, [transactions, selectedMonth, selectedChartVehicles]);

    // Average km/L for selected vehicles in this period
    const chartAverageKmL = useMemo(() => {
        const [mStr, yStr] = selectedMonth.split(' ');
        const monthNum = new Date(`${mStr} 1, 2000`).getMonth();
        const yearNum = parseInt(yStr, 10);

        const relevant = transactions.filter((tx) => {
            const vId = (tx.vehicleId || tx.fleetId || '').trim();
            if (selectedChartVehicles.length > 0 && !selectedChartVehicles.includes(vId)) return false;
            if (!tx.date) return false;
            const txD = new Date(tx.date);
            return txD.getFullYear() === yearNum && txD.getMonth() === monthNum && tx.consumption != null;
        });

        if (relevant.length === 0) return -65.89; // fallback demo default
        const sum = relevant.reduce((acc, curr) => acc + (curr.consumption || 0), 0);
        return Number((sum / relevant.length).toFixed(2));
    }, [transactions, selectedMonth, selectedChartVehicles]);

    // -------------------------------------------------------------
    // 2. REPORT VIEW COMPUTATIONS
    // -------------------------------------------------------------
    const reportData = useMemo(() => {
        return transactions.filter((tx) => {
            const vId = (tx.vehicleId || tx.fleetId || '').trim();
            if (selectedReportVehicles.length > 0 && !selectedReportVehicles.includes(vId)) {
                return false;
            }
            if (!searchTerm.trim()) return true;
            const q = searchTerm.trim().toLowerCase();
            return (
                vId.toLowerCase().includes(q) ||
                (tx.driverAttendant && tx.driverAttendant.toLowerCase().includes(q)) ||
                (tx.fleetId && tx.fleetId.toLowerCase().includes(q)) ||
                (tx.depot && tx.depot.toLowerCase().includes(q))
            );
        });
    }, [transactions, selectedReportVehicles, searchTerm]);

    // Group report transactions by vehicle
    const groupedReportData = useMemo(() => {
        const groups: {
            vehicleId: string;
            headerLabel: string;
            rows: Array<FuelEfficiencyTransaction & {
                make: string;
                model: string;
                litresExpected: number | null;
                difference: number | null;
            }>;
        }[] = [];

        const groupMap = new Map<string, typeof groups[0]>();

        reportData.forEach((tx) => {
            const vId = (tx.vehicleId || tx.fleetId || 'Unknown').trim();
            const meta = vehicleMetadata.get(vId.toUpperCase());
            const make = meta?.Make || tx.dem || tx.depot || 'POM';
            const model = meta?.Model || 'Toyota L/C';
            const reg = tx.fleetId || meta?.FleetId || '';

            if (!groupMap.has(vId)) {
                const headerLabel = `${vId} ${make} ${model} ${reg ? `(${reg})` : ''}`.trim();
                const groupObj = {
                    vehicleId: vId,
                    headerLabel: headerLabel,
                    rows: [],
                };
                groupMap.set(vId, groupObj);
                groups.push(groupObj);
            }

            // Calculate litres expected & difference
            let litresExpected: number | null = null;
            let diff: number | null = null;
            const dist = tx.distance || 0;
            const standardRate = tx.standardBurnRate || (meta?.StandardBurnRate ? Number(meta.StandardBurnRate) : 7.0);

            if (dist > 0 && standardRate > 0) {
                // Litres expected = Distance / Standard km/L
                litresExpected = Math.round(dist / standardRate);
                if (tx.fuelQuantity > 0) {
                    diff = Math.round(litresExpected - tx.fuelQuantity);
                }
            }

            groupMap.get(vId)!.rows.push({
                ...tx,
                make: make,
                model: model,
                litresExpected: litresExpected,
                difference: diff,
            });
        });

        return groups;
    }, [reportData, vehicleMetadata]);

    const totalReportVehicles = groupedReportData.length;
    const paginatedReportGroups = useMemo(() => {
        const start = (reportPage - 1) * reportPageSize;
        return groupedReportData.slice(start, start + reportPageSize);
    }, [groupedReportData, reportPage, reportPageSize]);

    const totalReportPages = Math.ceil(totalReportVehicles / reportPageSize) || 1;

    // -------------------------------------------------------------
    // 3. SUMMARY VIEW COMPUTATIONS
    // -------------------------------------------------------------
    const summaryData = useMemo(() => {
        // Group by vehicle + period according to summaryGranularity
        const map = new Map<
            string,
            {
                period: string;
                vehicleId: string;
                vehicleReg: string;
                refills: number;
                totalLitres: number;
                totalDistance: number;
                consumptions: number[];
            }
        >();

        transactions.forEach((tx) => {
            if (!tx.date) return;
            const vId = (tx.vehicleId || tx.fleetId || '—').trim();
            const meta = vehicleMetadata.get(vId.toUpperCase());
            const reg = tx.fleetId || meta?.FleetId || '';

            // Format period label
            const d = new Date(tx.date);
            let periodKey = '2026';
            if (summaryGranularity === 'Yearly') {
                periodKey = d.getFullYear().toString();
            } else if (summaryGranularity === 'Quarterly') {
                const q = Math.floor(d.getMonth() / 3) + 1;
                periodKey = `Q${q} ${d.getFullYear()}`;
            } else if (summaryGranularity === 'Monthly') {
                periodKey = `${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}`;
            } else if (summaryGranularity === 'Weekly') {
                const weekNum = Math.ceil(d.getDate() / 7);
                periodKey = `W${weekNum} ${d.toLocaleString('en-US', { month: 'short' })}`;
            } else if (summaryGranularity === 'Daily') {
                periodKey = tx.date;
            }

            const aggKey = `${periodKey}__${vId}`;
            if (!map.has(aggKey)) {
                map.set(aggKey, {
                    period: periodKey,
                    vehicleId: vId,
                    vehicleReg: reg,
                    refills: 0,
                    totalLitres: 0,
                    totalDistance: 0,
                    consumptions: [],
                });
            }

            const item = map.get(aggKey)!;
            item.refills += 1;
            item.totalLitres += tx.fuelQuantity || 0;
            if (tx.distance && tx.distance > 0) {
                item.totalDistance += tx.distance;
            }
            if (tx.consumption != null) {
                item.consumptions.push(tx.consumption);
            }
        });

        // Format into final summary rows
        const rows = Array.from(map.values()).map((item) => {
            const avgByRefill = item.refills > 0 ? Math.round(item.totalLitres / item.refills) : 0;
            const avgByRange = item.refills > 0 ? Math.round(item.totalDistance / item.refills) : 0;
            const avgConsumption =
                item.consumptions.length > 0
                    ? Number((item.consumptions.reduce((a, b) => a + b, 0) / item.consumptions.length).toFixed(2))
                    : item.totalLitres > 0 && item.totalDistance > 0
                    ? Number((item.totalDistance / item.totalLitres).toFixed(2))
                    : 0.0;

            return {
                period: item.period,
                vehicleId: item.vehicleId,
                vehicleReg: item.vehicleReg,
                refills: item.refills,
                avgByRefill: avgByRefill,
                avgByRange: avgByRange,
                litresUsed: item.totalLitres,
                travelled: item.totalDistance,
                consumption: avgConsumption,
            };
        });

        // Filter by search
        if (!searchTerm.trim()) return rows;
        const q = searchTerm.trim().toLowerCase();
        return rows.filter(
            (r) =>
                r.vehicleId.toLowerCase().includes(q) ||
                r.vehicleReg.toLowerCase().includes(q) ||
                r.period.toLowerCase().includes(q)
        );
    }, [transactions, vehicleMetadata, summaryGranularity, searchTerm]);

    const totalSummaryRows = summaryData.length;
    const paginatedSummaryRows = useMemo(() => {
        const start = (summaryPage - 1) * summaryPageSize;
        return summaryData.slice(start, start + summaryPageSize);
    }, [summaryData, summaryPage, summaryPageSize]);

    const totalSummaryPages = Math.ceil(totalSummaryRows / summaryPageSize) || 1;

    // -------------------------------------------------------------
    // EXPORT HANDLER
    // -------------------------------------------------------------
    const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
        setIsExporting(format);
        try {
            if (activeTab === 'report') {
                const headers = [
                    'Vehicle',
                    'Tank Filled',
                    'Driver',
                    'Make',
                    'Model',
                    'Distance (km)',
                    'Litres Used',
                    'Litres Expected',
                    'Difference',
                ];
                const rows: any[] = [];
                groupedReportData.forEach((g) => {
                    g.rows.forEach((r) => {
                        rows.push([
                            r.vehicleId,
                            `${r.date} ${r.time || ''}`,
                            r.driverAttendant || '—',
                            r.make,
                            r.model,
                            r.distance != null ? formatNumber(r.distance, 0) : '—',
                            formatNumber(r.fuelQuantity, 0),
                            r.litresExpected != null ? formatNumber(r.litresExpected, 0) : '—',
                            r.difference != null ? (r.difference > 0 ? `+${r.difference}` : r.difference) : '—',
                        ]);
                    });
                });
                if (format === 'csv') exportToCSV('vehicles_report.csv', headers, rows);
                else if (format === 'excel') exportToExcel('vehicles_report.xlsx', headers, rows, 'Report');
                else if (format === 'pdf') exportToPDF('Vehicles Fuel Consumption Report', headers, rows);
            } else if (activeTab === 'summary') {
                const headers = [
                    'Period',
                    'Vehicle',
                    'Refills',
                    'Avg by Refill',
                    'Avg by Range',
                    'Litres Used',
                    'Travelled (km)',
                    'Consumption (km/L)',
                ];
                const rows = summaryData.map((r) => [
                    r.period,
                    `${r.vehicleId} ${r.vehicleReg}`.trim(),
                    r.refills,
                    formatNumber(r.avgByRefill, 0),
                    formatNumber(r.avgByRange, 0),
                    formatNumber(r.litresUsed, 0),
                    formatNumber(r.travelled, 0),
                    r.consumption.toFixed(2),
                ]);
                if (format === 'csv') exportToCSV(`vehicles_summary_${summaryGranularity.toLowerCase()}.csv`, headers, rows);
                else if (format === 'excel') exportToExcel(`vehicles_summary_${summaryGranularity.toLowerCase()}.xlsx`, headers, rows, 'Summary');
                else if (format === 'pdf') exportToPDF(`Vehicles ${summaryGranularity} Summary Report`, headers, rows);
            }
        } catch (err) {
            console.error('Failed export:', err);
        } finally {
            setIsExporting(null);
            setExportOpen(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading && transactions.length === 0) {
        return (
            <PageContainer>
                <div className="flex items-center justify-center min-h-[500px]">
                    <LoadingSpinner size="lg" />
                </div>
            </PageContainer>
        );
    }

    if (error) {
        return (
            <PageContainer>
                <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                    <AlertTriangle className="h-12 w-12 text-destructive" />
                    <p className="text-lg text-muted-foreground">{error}</p>
                    <Button onClick={() => loadAllData()}>Try Again</Button>
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer className="p-3 sm:p-4 space-y-3 h-full flex flex-col bg-[#eef5ee] min-h-screen text-slate-800">
            {/* Top Navigation Bar with Title, Subtabs and Search */}
            <div className="flex flex-wrap items-center justify-between gap-3 shrink-0 pb-1">
                <div className="flex items-center gap-6">
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight">Vehicles</h1>
                    {/* Horizontal Pill Tabs for easy switching */}
                    <div className="flex items-center bg-[#dcece0] p-1 rounded-lg gap-1 border border-[#cbe0d0]">
                        {(['chart', 'report', 'summary'] as TabType[]).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => handleTabChange(tab)}
                                className={cn(
                                    'px-3.5 py-1 text-xs font-semibold rounded-md capitalize transition-all cursor-pointer',
                                    activeTab === tab
                                        ? 'bg-[#1b2e23] text-white shadow-xs'
                                        : 'text-slate-700 hover:text-slate-900 hover:bg-white/40'
                                )}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Top Right Search Input */}
                <div className="relative w-72">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search registration, driver..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-white rounded-lg border border-slate-200 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1b2e23] shadow-2xs"
                    />
                </div>
            </div>

            {/* MAIN CONTENT BASED ON ACTIVE TAB */}
            <div className="flex-1 min-h-0 flex flex-col">
                {/* ------------------------------------------------------------- */}
                {/* TAB 1: CHART VIEW */}
                {/* ------------------------------------------------------------- */}
                {activeTab === 'chart' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 items-stretch min-h-0">
                        {/* Left Sub-Panel: Period & Toggle Vehicles */}
                        <div className="lg:col-span-3 bg-[#f3f9f4] rounded-2xl border border-[#d6e7da] p-4 flex flex-col space-y-4 shadow-2xs overflow-hidden">
                            {/* PERIOD Section */}
                            <div>
                                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                                    PERIOD
                                </h3>
                                <div className="flex flex-wrap gap-1.5">
                                    {monthOptions.slice(0, 6).map((m) => {
                                        const isSelected = selectedMonth === m;
                                        return (
                                            <button
                                                key={m}
                                                onClick={() => setSelectedMonth(m)}
                                                className={cn(
                                                    'px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer',
                                                    isSelected
                                                        ? 'bg-[#1b2e23] text-white shadow-xs font-semibold'
                                                        : 'bg-[#d8e8dc] text-slate-700 hover:bg-[#cde0d2]'
                                                )}
                                            >
                                                {m}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* TOGGLE VEHICLES Section */}
                            <div className="flex-1 flex flex-col min-h-0">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                        TOGGLE VEHICLES
                                    </h3>
                                    <button
                                        onClick={() => setSelectedChartVehicles([])}
                                        className="text-xs text-[#0d7a35] hover:text-[#095725] font-semibold transition-colors cursor-pointer"
                                    >
                                        Clear
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar min-h-0">
                                    {vehicleList.map((v) => {
                                        const isSelected = selectedChartVehicles.includes(v.id);
                                        const color = vehicleColorMap.get(v.id) || '#0d9488';
                                        return (
                                            <button
                                                key={v.id}
                                                onClick={() => {
                                                    setSelectedChartVehicles((prev) =>
                                                        prev.includes(v.id)
                                                            ? prev.filter((id) => id !== v.id)
                                                            : [...prev, v.id]
                                                    );
                                                }}
                                                className={cn(
                                                    'w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer',
                                                    isSelected
                                                        ? 'bg-[#e2f1e6] text-[#0d3822] font-semibold'
                                                        : 'text-slate-600 hover:bg-[#eaf4ec]'
                                                )}
                                            >
                                                {isSelected ? (
                                                    <span
                                                        className="h-2.5 w-2.5 rounded-full shrink-0"
                                                        style={{ backgroundColor: color }}
                                                    />
                                                ) : (
                                                    <span className="h-2.5 w-2.5 rounded-full border border-slate-400 shrink-0" />
                                                )}
                                                <span className="truncate">{v.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Right Main Panel: Consumption History Chart Card */}
                        <div className="lg:col-span-9 bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col justify-between shadow-2xs min-h-[460px]">
                            {/* Card Header */}
                            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                                        Consumption history
                                    </h2>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Achieved km/L per fill · {selectedMonth}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                                        AVERAGE KM/L
                                    </span>
                                    <span className="text-2xl font-bold text-slate-900 tracking-tight">
                                        {chartAverageKmL > 0 ? chartAverageKmL : chartAverageKmL.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {/* Chart Body */}
                            <div className="flex-1 w-full min-h-[320px] py-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="day"
                                            stroke="#94a3b8"
                                            fontSize={11}
                                            tickLine={false}
                                            ticks={[1, 5, 10, 15, 20, 25, 31]}
                                        />
                                        <YAxis
                                            stroke="#94a3b8"
                                            fontSize={11}
                                            tickLine={false}
                                            domain={['auto', 'auto']}
                                        />
                                        <Tooltip
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div className="bg-slate-900 text-white text-xs rounded-lg p-2.5 shadow-xl border border-slate-800 space-y-1">
                                                            <p className="font-bold text-slate-300 border-b border-slate-800 pb-1">
                                                                Day {label} · {selectedMonth}
                                                            </p>
                                                            {payload.map((item: any) => (
                                                                <div key={item.dataKey} className="flex items-center gap-2">
                                                                    <span
                                                                        className="h-2 w-2 rounded-full"
                                                                        style={{ backgroundColor: item.color }}
                                                                    />
                                                                    <span className="text-slate-200">{item.name}:</span>
                                                                    <span className="font-semibold text-white">
                                                                        {item.value} km/L
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        {selectedChartVehicles.map((vId) => {
                                            const color = vehicleColorMap.get(vId) || '#0d9488';
                                            return (
                                                <Line
                                                    key={vId}
                                                    type="monotone"
                                                    dataKey={vId}
                                                    name={vId}
                                                    stroke={color}
                                                    strokeWidth={2.5}
                                                    dot={{ r: 4, fill: color, strokeWidth: 1, stroke: '#fff' }}
                                                    activeDot={{ r: 6 }}
                                                    connectNulls={false}
                                                />
                                            );
                                        })}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Chart Bottom Legend */}
                            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-100">
                                {selectedChartVehicles.map((vId) => {
                                    const color = vehicleColorMap.get(vId) || '#0d9488';
                                    return (
                                        <div key={vId} className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                                            <span
                                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                                style={{ backgroundColor: color }}
                                            />
                                            <span>{vId}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* TAB 2: REPORT VIEW */}
                {/* ------------------------------------------------------------- */}
                {activeTab === 'report' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 items-stretch min-h-0">
                        {/* Left Sub-Panel: Checkbox Vehicle Filter */}
                        <div className="lg:col-span-3 bg-[#f3f9f4] rounded-2xl border border-[#d6e7da] p-4 flex flex-col shadow-2xs overflow-hidden">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    VEHICLES
                                </h3>
                                <button
                                    onClick={() => setSelectedReportVehicles([])}
                                    className="text-xs text-[#0d7a35] hover:text-[#095725] font-semibold transition-colors cursor-pointer"
                                >
                                    Clear
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar min-h-0">
                                {vehicleList.map((v) => {
                                    const isChecked = selectedReportVehicles.includes(v.id);
                                    return (
                                        <button
                                            key={v.id}
                                            onClick={() => {
                                                setSelectedReportVehicles((prev) =>
                                                    prev.includes(v.id)
                                                        ? prev.filter((id) => id !== v.id)
                                                        : [...prev, v.id]
                                                );
                                            }}
                                            className={cn(
                                                'w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer',
                                                isChecked
                                                    ? 'bg-[#e2f1e6] text-slate-900 font-semibold'
                                                    : 'text-slate-600 hover:bg-[#eaf4ec]'
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    'h-4 w-4 rounded flex items-center justify-center border transition-colors shrink-0',
                                                    isChecked
                                                        ? 'bg-slate-900 border-slate-900 text-white'
                                                        : 'border-slate-400 bg-white'
                                                )}
                                            >
                                                {isChecked && <Check className="h-3 w-3" />}
                                            </div>
                                            <span className="truncate">{v.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Right Main Panel: Grouped Vehicle Report */}
                        <div className="lg:col-span-9 bg-[#f3f9f4] rounded-2xl border border-[#d6e7da] p-4 flex flex-col justify-between shadow-2xs min-h-0 overflow-hidden">
                            {/* Top Action Bar */}
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-3 bg-white/70 backdrop-blur-xs p-2.5 rounded-xl border border-white/80">
                                <div className="flex items-center gap-2">
                                    {/* Export Dropdown */}
                                    <div className="relative" ref={exportRef}>
                                        <Button
                                            type="button"
                                            onClick={() => setExportOpen((prev) => !prev)}
                                            className="bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg h-8 px-3 border border-slate-200 shadow-2xs flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <Download className="h-3.5 w-3.5 text-slate-500" />
                                            <span>Export results</span>
                                        </Button>

                                        {exportOpen && (
                                            <div className="absolute left-0 mt-1.5 w-48 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                                                <button
                                                    onClick={() => handleExport('excel')}
                                                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 cursor-pointer"
                                                >
                                                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                                                    <span>Excel (.xlsx)</span>
                                                </button>
                                                <button
                                                    onClick={() => handleExport('csv')}
                                                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-sky-50 hover:text-sky-700 flex items-center gap-2 cursor-pointer"
                                                >
                                                    <FileText className="h-4 w-4 text-sky-600" />
                                                    <span>CSV (.csv)</span>
                                                </button>
                                                <button
                                                    onClick={() => handleExport('pdf')}
                                                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-2 cursor-pointer"
                                                >
                                                    <FileDown className="h-4 w-4 text-rose-600" />
                                                    <span>PDF Document</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* All Data Filter Pill */}
                                    <button
                                        onClick={() => setAllDataFilter(allDataFilter === 'all' ? 'filtered' : 'all')}
                                        className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg h-8 px-3 border border-slate-200 shadow-2xs flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <span>All data</span>
                                        <span className="bg-[#dcfce7] text-[#166534] px-1.5 py-0.5 rounded text-[10px] font-bold">
                                            {reportData.length}
                                        </span>
                                        <ChevronDown className="h-3 w-3 text-slate-400" />
                                    </button>
                                </div>

                                {/* Pagination & Page Size */}
                                <div className="flex items-center gap-3 text-xs text-slate-600">
                                    <span>
                                        Displaying {totalReportVehicles === 0 ? 0 : (reportPage - 1) * reportPageSize + 1}-
                                        {Math.min(reportPage * reportPageSize, totalReportVehicles)} of {totalReportVehicles}
                                    </span>
                                    <select
                                        value={reportPageSize}
                                        onChange={(e) => {
                                            setReportPageSize(Number(e.target.value));
                                            setReportPage(1);
                                        }}
                                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none cursor-pointer"
                                    >
                                        <option value={5}>5</option>
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                    </select>
                                    <button
                                        onClick={handlePrint}
                                        className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 text-slate-600 cursor-pointer"
                                        title="Print"
                                    >
                                        <Printer className="h-3.5 w-3.5" />
                                    </button>
                                    {/* Pagination Buttons */}
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setReportPage(1)}
                                            disabled={reportPage === 1}
                                            className="h-7 w-7 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-40 cursor-pointer"
                                        >
                                            <ChevronsLeft className="h-3 w-3" />
                                        </button>
                                        <button
                                            onClick={() => setReportPage((p) => Math.max(1, p - 1))}
                                            disabled={reportPage === 1}
                                            className="h-7 w-7 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-40 cursor-pointer"
                                        >
                                            <ChevronLeft className="h-3 w-3" />
                                        </button>
                                        <span className="h-7 w-7 rounded bg-slate-900 text-white font-bold flex items-center justify-center text-xs">
                                            {reportPage}
                                        </span>
                                        <button
                                            onClick={() => setReportPage((p) => Math.min(totalReportPages, p + 1))}
                                            disabled={reportPage === totalReportPages}
                                            className="h-7 w-7 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-40 cursor-pointer"
                                        >
                                            <ChevronRight className="h-3 w-3" />
                                        </button>
                                        <button
                                            onClick={() => setReportPage(totalReportPages)}
                                            disabled={reportPage === totalReportPages}
                                            className="h-7 w-7 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-40 cursor-pointer"
                                        >
                                            <ChevronsRight className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Grouped Table View */}
                            <div className="flex-1 overflow-x-auto overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-2xs min-h-0">
                                <table className="w-full text-xs text-left whitespace-nowrap">
                                    <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                        <tr>
                                            <th className="py-2.5 px-3">VEHICLE</th>
                                            <th className="py-2.5 px-3">TANK FILLED</th>
                                            <th className="py-2.5 px-3">DRIVER</th>
                                            <th className="py-2.5 px-3">MAKE</th>
                                            <th className="py-2.5 px-3">MODEL</th>
                                            <th className="py-2.5 px-3 text-right">DISTANCE</th>
                                            <th className="py-2.5 px-3 text-right">LITRES USED</th>
                                            <th className="py-2.5 px-3 text-right">LITRES EXPECTED</th>
                                            <th className="py-2.5 px-3 text-right">DIFFERENCE</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                        {paginatedReportGroups.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="py-8 text-center text-slate-400">
                                                    No vehicle records match the selected filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedReportGroups.map((group) => (
                                                <React.Fragment key={group.vehicleId}>
                                                    {/* Group Header Banner */}
                                                    <tr className="bg-[#122319] text-white font-bold">
                                                        <td colSpan={9} className="py-1.5 px-3 text-xs tracking-wide">
                                                            {group.headerLabel}
                                                        </td>
                                                    </tr>
                                                    {/* Group Data Rows */}
                                                    {group.rows.map((row) => (
                                                        <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                                            <td className="py-2 px-3 font-semibold text-slate-900">
                                                                {row.vehicleId}
                                                            </td>
                                                            <td className="py-2 px-3 text-slate-600">
                                                                {row.date.replace(/-/g, '/')}, {row.time || '00:00:00'}
                                                            </td>
                                                            <td className="py-2 px-3">{row.driverAttendant || '—'}</td>
                                                            <td className="py-2 px-3">{row.make}</td>
                                                            <td className="py-2 px-3">{row.model}</td>
                                                            <td className="py-2 px-3 text-right font-medium">
                                                                {row.distance != null && row.distance > 0
                                                                    ? formatNumber(row.distance, 0)
                                                                    : '—'}
                                                            </td>
                                                            <td className="py-2 px-3 text-right font-semibold">
                                                                {formatNumber(row.fuelQuantity, 0)}
                                                            </td>
                                                            <td className="py-2 px-3 text-right text-slate-600">
                                                                {row.litresExpected != null ? row.litresExpected : '—'}
                                                            </td>
                                                            <td className="py-2 px-3 text-right font-bold">
                                                                {row.difference != null ? (
                                                                    <span
                                                                        className={
                                                                            row.difference >= 0
                                                                                ? 'text-emerald-600'
                                                                                : 'text-rose-600'
                                                                        }
                                                                    >
                                                                        {row.difference > 0 ? `+${row.difference}` : row.difference}
                                                                    </span>
                                                                ) : (
                                                                    '—'
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Bottom Action Bar repeating top controls */}
                            <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-2 border-t border-[#d6e7da]/60">
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        onClick={() => handleExport('excel')}
                                        className="bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg h-8 px-3 border border-slate-200 shadow-2xs flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <Download className="h-3.5 w-3.5 text-slate-500" />
                                        <span>Export results</span>
                                    </Button>
                                    <div className="bg-white text-slate-700 text-xs font-semibold rounded-lg h-8 px-3 border border-slate-200 shadow-2xs flex items-center gap-1.5">
                                        <span>All data</span>
                                        <span className="bg-[#dcfce7] text-[#166534] px-1.5 py-0.5 rounded text-[10px] font-bold">
                                            {reportData.length}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-600">
                                    <span>
                                        Displaying {totalReportVehicles === 0 ? 0 : (reportPage - 1) * reportPageSize + 1}-
                                        {Math.min(reportPage * reportPageSize, totalReportVehicles)} of {totalReportVehicles}
                                    </span>
                                    {/* Pagination Buttons */}
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setReportPage(1)}
                                            disabled={reportPage === 1}
                                            className="h-7 w-7 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-40 cursor-pointer"
                                        >
                                            <ChevronsLeft className="h-3 w-3" />
                                        </button>
                                        <button
                                            onClick={() => setReportPage((p) => Math.max(1, p - 1))}
                                            disabled={reportPage === 1}
                                            className="h-7 w-7 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-40 cursor-pointer"
                                        >
                                            <ChevronLeft className="h-3 w-3" />
                                        </button>
                                        <span className="h-7 w-7 rounded bg-slate-900 text-white font-bold flex items-center justify-center text-xs">
                                            {reportPage}
                                        </span>
                                        <button
                                            onClick={() => setReportPage((p) => Math.min(totalReportPages, p + 1))}
                                            disabled={reportPage === totalReportPages}
                                            className="h-7 w-7 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-40 cursor-pointer"
                                        >
                                            <ChevronRight className="h-3 w-3" />
                                        </button>
                                        <button
                                            onClick={() => setReportPage(totalReportPages)}
                                            disabled={reportPage === totalReportPages}
                                            className="h-7 w-7 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-40 cursor-pointer"
                                        >
                                            <ChevronsRight className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* TAB 3: SUMMARY VIEW */}
                {/* ------------------------------------------------------------- */}
                {activeTab === 'summary' && (
                    <div className="bg-[#f3f9f4] rounded-2xl border border-[#d6e7da] p-4 flex flex-col justify-between shadow-2xs flex-1 min-h-0 overflow-hidden">
                        {/* Top Action Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 bg-white/70 backdrop-blur-xs p-2.5 rounded-xl border border-white/80">
                            <div className="flex items-center gap-3">
                                {/* Export results */}
                                <div className="relative" ref={exportRef}>
                                    <Button
                                        type="button"
                                        onClick={() => setExportOpen((prev) => !prev)}
                                        className="bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg h-8 px-3 border border-slate-200 shadow-2xs flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <Download className="h-3.5 w-3.5 text-slate-500" />
                                        <span>Export results</span>
                                    </Button>

                                    {exportOpen && (
                                        <div className="absolute left-0 mt-1.5 w-48 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                                            <button
                                                onClick={() => handleExport('excel')}
                                                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 cursor-pointer"
                                            >
                                                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                                                <span>Excel (.xlsx)</span>
                                            </button>
                                            <button
                                                onClick={() => handleExport('csv')}
                                                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-sky-50 hover:text-sky-700 flex items-center gap-2 cursor-pointer"
                                            >
                                                <FileText className="h-4 w-4 text-sky-600" />
                                                <span>CSV (.csv)</span>
                                            </button>
                                            <button
                                                onClick={() => handleExport('pdf')}
                                                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-2 cursor-pointer"
                                            >
                                                <FileDown className="h-4 w-4 text-rose-600" />
                                                <span>PDF Document</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Granularity Tabs */}
                                <div className="flex items-center bg-[#d8e8dc] p-0.5 rounded-lg gap-1 border border-[#cbe0d0]">
                                    {(['Yearly', 'Quarterly', 'Monthly', 'Weekly', 'Daily'] as SummaryGranularity[]).map(
                                        (gran) => (
                                            <button
                                                key={gran}
                                                onClick={() => {
                                                    setSummaryGranularity(gran);
                                                    setSummaryPage(1);
                                                }}
                                                className={cn(
                                                    'px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer',
                                                    summaryGranularity === gran
                                                        ? 'bg-[#1b2e23] text-white shadow-xs'
                                                        : 'text-slate-700 hover:text-slate-900'
                                                )}
                                            >
                                                {gran}
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>

                            {/* Pagination & Print */}
                            <div className="flex items-center gap-3 text-xs text-slate-600">
                                <span>
                                    Displaying {totalSummaryRows === 0 ? 0 : (summaryPage - 1) * summaryPageSize + 1}-
                                    {Math.min(summaryPage * summaryPageSize, totalSummaryRows)} of {totalSummaryRows}
                                </span>
                                <select
                                    value={summaryPageSize}
                                    onChange={(e) => {
                                        setSummaryPageSize(Number(e.target.value));
                                        setSummaryPage(1);
                                    }}
                                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none cursor-pointer"
                                >
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                </select>
                                <button
                                    onClick={handlePrint}
                                    className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 text-slate-600 cursor-pointer"
                                    title="Print"
                                >
                                    <Printer className="h-3.5 w-3.5" />
                                </button>
                                {/* Pagination Controls */}
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setSummaryPage(1)}
                                        disabled={summaryPage === 1}
                                        className="h-7 w-7 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-40 cursor-pointer"
                                    >
                                        <ChevronsLeft className="h-3 w-3" />
                                    </button>
                                    <button
                                        onClick={() => setSummaryPage((p) => Math.max(1, p - 1))}
                                        disabled={summaryPage === 1}
                                        className="h-7 w-7 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-40 cursor-pointer"
                                    >
                                        <ChevronLeft className="h-3 w-3" />
                                    </button>
                                    <span className="h-7 w-7 rounded bg-slate-900 text-white font-bold flex items-center justify-center text-xs">
                                        {summaryPage}
                                    </span>
                                    <button
                                        onClick={() => setSummaryPage((p) => Math.min(totalSummaryPages, p + 1))}
                                        disabled={summaryPage === totalSummaryPages}
                                        className="h-7 w-7 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-40 cursor-pointer"
                                    >
                                        <ChevronRight className="h-3 w-3" />
                                    </button>
                                    <button
                                        onClick={() => setSummaryPage(totalSummaryPages)}
                                        disabled={summaryPage === totalSummaryPages}
                                        className="h-7 w-7 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-40 cursor-pointer"
                                    >
                                        <ChevronsRight className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Summary Table */}
                        <div className="flex-1 overflow-x-auto overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-2xs min-h-0">
                            <table className="w-full text-xs text-left whitespace-nowrap">
                                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                    <tr>
                                        <th className="py-2.5 px-3">PERIOD</th>
                                        <th className="py-2.5 px-3">VEHICLE</th>
                                        <th className="py-2.5 px-3 text-right">REFILLS</th>
                                        <th className="py-2.5 px-3 text-right">AVG BY REFILL</th>
                                        <th className="py-2.5 px-3 text-right">AVG BY RANGE</th>
                                        <th className="py-2.5 px-3 text-right">LITRES USED</th>
                                        <th className="py-2.5 px-3 text-right">TRAVELLED</th>
                                        <th className="py-2.5 px-3 text-right">CONSUMPTION</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {paginatedSummaryRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-8 text-center text-slate-400">
                                                No summary data available for this selection.
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedSummaryRows.map((r, index) => (
                                            <tr key={`${r.period}-${r.vehicleId}-${index}`} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="py-2.5 px-3 font-semibold text-slate-900">{r.period}</td>
                                                <td className="py-2.5 px-3">
                                                    <div className="font-bold text-slate-900">{r.vehicleId}</div>
                                                    {r.vehicleReg && (
                                                        <div className="text-[10px] text-slate-400 uppercase">
                                                            {r.vehicleReg}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-medium">{r.refills}</td>
                                                <td className="py-2.5 px-3 text-right">{formatNumber(r.avgByRefill, 0)}</td>
                                                <td className="py-2.5 px-3 text-right">{formatNumber(r.avgByRange, 0)}</td>
                                                <td className="py-2.5 px-3 text-right font-semibold">
                                                    {formatNumber(r.litresUsed, 0)}
                                                </td>
                                                <td className="py-2.5 px-3 text-right">{formatNumber(r.travelled, 0)}</td>
                                                <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                                    {r.consumption.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Bottom Action Bar repeating controls */}
                        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-2 border-t border-[#d6e7da]/60">
                            <div className="flex items-center gap-3">
                                <Button
                                    type="button"
                                    onClick={() => handleExport('excel')}
                                    className="bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg h-8 px-3 border border-slate-200 shadow-2xs flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Download className="h-3.5 w-3.5 text-slate-500" />
                                    <span>Export results</span>
                                </Button>
                                <div className="flex items-center bg-[#d8e8dc] p-0.5 rounded-lg gap-1 border border-[#cbe0d0]">
                                    {(['Yearly', 'Quarterly', 'Monthly', 'Weekly', 'Daily'] as SummaryGranularity[]).map(
                                        (gran) => (
                                            <button
                                                key={gran}
                                                onClick={() => {
                                                    setSummaryGranularity(gran);
                                                    setSummaryPage(1);
                                                }}
                                                className={cn(
                                                    'px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer',
                                                    summaryGranularity === gran
                                                        ? 'bg-[#1b2e23] text-white shadow-xs'
                                                        : 'text-slate-700 hover:text-slate-900'
                                                )}
                                            >
                                                {gran}
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-600">
                                <span>
                                    Displaying {totalSummaryRows === 0 ? 0 : (summaryPage - 1) * summaryPageSize + 1}-
                                    {Math.min(summaryPage * summaryPageSize, totalSummaryRows)} of {totalSummaryRows}
                                </span>
                                {/* Pagination Controls */}
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setSummaryPage(1)}
                                        disabled={summaryPage === 1}
                                        className="h-7 w-7 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-40 cursor-pointer"
                                    >
                                        <ChevronsLeft className="h-3 w-3" />
                                    </button>
                                    <button
                                        onClick={() => setSummaryPage((p) => Math.max(1, p - 1))}
                                        disabled={summaryPage === 1}
                                        className="h-7 w-7 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-40 cursor-pointer"
                                    >
                                        <ChevronLeft className="h-3 w-3" />
                                    </button>
                                    <span className="h-7 w-7 rounded bg-slate-900 text-white font-bold flex items-center justify-center text-xs">
                                        {summaryPage}
                                    </span>
                                    <button
                                        onClick={() => setSummaryPage((p) => Math.min(totalSummaryPages, p + 1))}
                                        disabled={summaryPage === totalSummaryPages}
                                        className="h-7 w-7 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-40 cursor-pointer"
                                    >
                                        <ChevronRight className="h-3 w-3" />
                                    </button>
                                    <button
                                        onClick={() => setSummaryPage(totalSummaryPages)}
                                        disabled={summaryPage === totalSummaryPages}
                                        className="h-7 w-7 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-40 cursor-pointer"
                                    >
                                        <ChevronsRight className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PageContainer>
    );
}
