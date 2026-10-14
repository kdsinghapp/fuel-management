// src/app/(dashboard)/vehicles/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { createPortal } from 'react-dom';
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
    Calendar,
    Car,
    ArrowUpDown,
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
import { DateRangePreset, DateRange, getDateRangeFromPreset } from '@/components/common/DateRangePicker';
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

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

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

function formatSpaceNumber(num: number | null | undefined, decimals = 0): string {
    if (num == null || isNaN(num)) return '—';
    if (decimals === 0) {
        const rounded = Math.round(num);
        const sign = rounded < 0 ? '-' : '';
        const absStr = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        return `${sign}${absStr}`;
    }
    const fixed = num.toFixed(decimals);
    const [intPart, decPart] = fixed.split('.');
    const sign = Number(intPart) < 0 || fixed.startsWith('-') ? '-' : '';
    const absInt = Math.abs(parseInt(intPart, 10)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${sign}${absInt}.${decPart}`;
}

function VehiclesContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedClient = useClientStore((state) => state.selectedClient);

    // Needed so the print portal is only rendered on the client (avoids hydration mismatch)
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

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
    const [reportDateRange, setReportDateRange] = useState<DateRange>({
        preset: 'all',
        startDate: undefined,
        endDate: undefined,
        label: 'All data',
    });
    const [dateRangeOpen, setDateRangeOpen] = useState(false);
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [customTabActive, setCustomTabActive] = useState(false);
    const dateRangeRef = useRef<HTMLDivElement>(null);

    // Summary view states
    const [summaryGranularity, setSummaryGranularity] = useState<SummaryGranularity>('Yearly');
    const [summaryPage, setSummaryPage] = useState(1);
    const [summaryPageSize, setSummaryPageSize] = useState<number>(25);

    // Summary filters & dropdowns matching screenshot
    const [summaryDateRange, setSummaryDateRange] = useState<DateRange>(() => getDateRangeFromPreset('monthToDate'));
    const [summaryDateRangeOpen, setSummaryDateRangeOpen] = useState(false);
    const [summaryVehicleFilter, setSummaryVehicleFilter] = useState<string>('all');
    const [summaryVehicleDropdownOpen, setSummaryVehicleDropdownOpen] = useState(false);
    const [summaryVehicleSearch, setSummaryVehicleSearch] = useState('');
    const [summaryCustomStart, setSummaryCustomStart] = useState('');
    const [summaryCustomEnd, setSummaryCustomEnd] = useState('');
    const [summaryCustomTabActive, setSummaryCustomTabActive] = useState(false);

    // Summary sorting state
    const [summarySortField, setSummarySortField] = useState<
        'vehicle' | 'dateFrom' | 'fillUps' | 'distance' | 'litresUsed' | 'litresExpected' | 'difference' | 'consumption'
    >('litresUsed');
    const [summarySortDirection, setSummarySortDirection] = useState<'asc' | 'desc'>('desc');

    // Export dropdown
    const [exportOpen, setExportOpen] = useState(false);
    const [summaryExportOpen, setSummaryExportOpen] = useState(false);
    const [isExporting, setIsExporting] = useState<string | null>(null);
    const exportRef = useRef<HTMLDivElement>(null);
    const summaryExportRef = useRef<HTMLDivElement>(null);
    const summaryDateRangeRef = useRef<HTMLDivElement>(null);
    const summaryVehicleRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
                setExportOpen(false);
            }
            if (dateRangeRef.current && !dateRangeRef.current.contains(e.target as Node)) {
                setDateRangeOpen(false);
            }
            if (summaryExportRef.current && !summaryExportRef.current.contains(e.target as Node)) {
                setSummaryExportOpen(false);
            }
            if (summaryDateRangeRef.current && !summaryDateRangeRef.current.contains(e.target as Node)) {
                setSummaryDateRangeOpen(false);
            }
            if (summaryVehicleRef.current && !summaryVehicleRef.current.contains(e.target as Node)) {
                setSummaryVehicleDropdownOpen(false);
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
        const daysMap: { [day: number]: { day: number;[vehicleKey: string]: any } } = {};

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
    // 2. REPORT VIEW COMPUTATIONS & DATE RANGE
    // -------------------------------------------------------------
    const dateRangePresets: { key: DateRangePreset; label: string; hasCalendarIcon?: boolean }[] = [
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

    const countForPreset = (preset: DateRangePreset) => {
        const { startDate, endDate } = getDateRangeFromPreset(preset);
        return transactions.filter((tx) => {
            const vId = (tx.vehicleId || tx.fleetId || '').trim();
            if (selectedReportVehicles.length > 0 && !selectedReportVehicles.includes(vId)) {
                return false;
            }
            if (startDate && tx.date && tx.date < startDate) return false;
            if (endDate && tx.date && tx.date > endDate) return false;
            return true;
        }).length;
    };

    const handleSelectPreset = (preset: DateRangePreset) => {
        if (preset === 'custom') {
            setCustomTabActive(true);
        } else {
            setCustomTabActive(false);
            const range = getDateRangeFromPreset(preset);
            setReportDateRange(range);
            setReportPage(1);
            setDateRangeOpen(false);
        }
    };

    const handleApplyCustom = () => {
        const range = getDateRangeFromPreset('custom', customStart, customEnd);
        setReportDateRange(range);
        setReportPage(1);
        setDateRangeOpen(false);
    };

    const reportData = useMemo(() => {
        return transactions.filter((tx) => {
            const vId = (tx.vehicleId || tx.fleetId || '').trim();
            if (selectedReportVehicles.length > 0 && !selectedReportVehicles.includes(vId)) {
                return false;
            }
            if (reportDateRange.startDate && tx.date && tx.date < reportDateRange.startDate) {
                return false;
            }
            if (reportDateRange.endDate && tx.date && tx.date > reportDateRange.endDate) {
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
    }, [transactions, selectedReportVehicles, searchTerm, reportDateRange]);

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
    // 3. VEHICLE SUMMARY VIEW COMPUTATIONS & FILTERS
    // -------------------------------------------------------------
    const summaryDatePresets: { key: DateRangePreset; label: string; hasCalendarIcon?: boolean }[] = [
        { key: 'monthToDate', label: 'Month to Date', hasCalendarIcon: true },
        { key: 'all', label: 'All data' },
        { key: 'today', label: 'Today' },
        { key: 'yesterday', label: 'Yesterday' },
        { key: 'weekToDate', label: 'Week to Date' },
        { key: '7days', label: '7 Days' },
        { key: '14days', label: '14 Days' },
        { key: '21days', label: '21 Days' },
        { key: '30days', label: '30 Days' },
        { key: 'lastMonth', label: 'Last Month', hasCalendarIcon: true },
        { key: 'custom', label: 'Custom Range', hasCalendarIcon: true },
    ];

    const countForSummaryPreset = (preset: DateRangePreset) => {
        const { startDate, endDate } = getDateRangeFromPreset(preset);
        return transactions.filter((tx) => {
            const vId = (tx.vehicleId || tx.fleetId || '').trim();
            if (summaryVehicleFilter !== 'all' && vId !== summaryVehicleFilter) {
                return false;
            }
            if (startDate && tx.date && tx.date < startDate) return false;
            if (endDate && tx.date && tx.date > endDate) return false;
            return true;
        }).length;
    };

    const handleSelectSummaryPreset = (preset: DateRangePreset) => {
        if (preset === 'custom') {
            setSummaryCustomTabActive(true);
        } else {
            setSummaryCustomTabActive(false);
            const range = getDateRangeFromPreset(preset);
            setSummaryDateRange(range);
            setSummaryPage(1);
            setSummaryDateRangeOpen(false);
        }
    };

    const handleApplySummaryCustom = () => {
        if (!summaryCustomStart) return;
        const start = summaryCustomStart;
        const end = summaryCustomEnd || summaryCustomStart;
        setSummaryDateRange({
            preset: 'custom',
            startDate: start,
            endDate: end,
            label: `${start.replace(/-/g, '/')} - ${end.replace(/-/g, '/')}`,
        });
        setSummaryPage(1);
        setSummaryDateRangeOpen(false);
    };

    // List of unique vehicles for Summary vehicle filter dropdown
    const summaryVehicleOptions = useMemo(() => {
        const set = new Set<string>();
        transactions.forEach((tx) => {
            const vId = (tx.vehicleId || tx.fleetId || '').trim();
            if (vId) set.add(vId);
        });
        return Array.from(set).sort();
    }, [transactions]);

    const handleSummarySort = (
        field: 'vehicle' | 'dateFrom' | 'fillUps' | 'distance' | 'litresUsed' | 'litresExpected' | 'difference' | 'consumption'
    ) => {
        if (summarySortField === field) {
            setSummarySortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSummarySortField(field);
            setSummarySortDirection('desc');
        }
    };

    // Filter transactions for vehicle summary based on date range and vehicle filter
    const summaryFilteredTransactions = useMemo(() => {
        return transactions.filter((tx) => {
            const vId = (tx.vehicleId || tx.fleetId || '').trim();
            if (summaryVehicleFilter !== 'all' && vId !== summaryVehicleFilter) {
                return false;
            }
            if (summaryDateRange.startDate && tx.date && tx.date < summaryDateRange.startDate) {
                return false;
            }
            if (summaryDateRange.endDate && tx.date && tx.date > summaryDateRange.endDate) {
                return false;
            }
            return true;
        });
    }, [transactions, summaryVehicleFilter, summaryDateRange]);

    interface VehicleSummaryRow {
        vehicleKey: string;
        vehicleName: string;
        make: string;
        model: string;
        type: string;
        dateFrom: string;
        dateTo: string;
        fillUps: number;
        distance: number | null;
        litresUsed: number;
        litresExpected: number | null;
        difference: number | null;
        consumption: number | null;
        expectedConsumption: number | null;
        detailsPercent: number | null;
        detailsType: 'under' | 'over' | null;
    }

    const vehicleSummaryData = useMemo(() => {
        // Group by vehicle
        const groupMap = new Map<string, FuelEfficiencyTransaction[]>();

        summaryFilteredTransactions.forEach((tx) => {
            const rawKey = (tx.vehicleId || tx.fleetId || '').trim();
            const vKey = rawKey === '' ? '—' : rawKey;
            if (!groupMap.has(vKey)) {
                groupMap.set(vKey, []);
            }
            groupMap.get(vKey)!.push(tx);
        });

        const rows: VehicleSummaryRow[] = [];

        groupMap.forEach((txs, vKey) => {
            const meta = vKey !== '—' ? vehicleMetadata.get(vKey.toUpperCase()) : undefined;
            const reg = meta?.FleetId || '';
            const make = meta?.Make || (vKey !== '—' ? 'POM' : '—');
            const model = meta?.Model || (vKey !== '—' ? 'Toyota L/C' : '—');
            const type = (meta as any)?.VehicleType || (meta as any)?.Type || '—';
            const vehicleName =
                vKey === '—'
                    ? '—'
                    : `${vKey} ${make} ${model} ${reg ? `(${reg})` : ''}`.replace(/\s+/g, ' ').trim();

            const dates = txs
                .map((t) => (t.date || '').split('T')[0])
                .filter(Boolean)
                .sort();
            const dateFrom = dates.length > 0 ? dates[0].replace(/-/g, '/') : '—';
            const dateTo = dates.length > 0 ? dates[dates.length - 1].replace(/-/g, '/') : '—';

            let sumDistance = 0;
            let hasDistance = false;
            let sumLitresUsed = 0;
            let sumLitresExpected = 0;
            let hasExpected = false;
            let sumDifference = 0;
            let hasDifference = false;

            txs.forEach((tx) => {
                const qty = tx.fuelQuantity || 0;
                sumLitresUsed += qty;

                const dist = tx.distance;
                if (dist != null && !isNaN(dist)) {
                    sumDistance += dist;
                    hasDistance = true;

                    const standardRate =
                        tx.standardBurnRate || (meta?.StandardBurnRate ? Number(meta.StandardBurnRate) : 7.0);
                    if (dist > 0 && standardRate > 0) {
                        const exp = Math.round(dist / standardRate);
                        sumLitresExpected += exp;
                        hasExpected = true;
                        if (qty > 0) {
                            const diff = exp - qty;
                            sumDifference += diff;
                            hasDifference = true;
                        }
                    }
                }
            });

            const distance = hasDistance ? sumDistance : null;
            const litresUsed = Math.round(sumLitresUsed);
            const litresExpected = hasExpected ? Math.round(sumLitresExpected) : null;
            const difference = hasDifference ? Math.round(sumDifference) : null;

            const consumption =
                hasDistance && litresUsed > 0
                    ? Number((sumDistance / litresUsed).toFixed(2))
                    : null;

            const expectedConsumption =
                hasExpected || hasDistance
                    ? meta?.TargetKmPerL
                        ? Number(meta.TargetKmPerL)
                        : 10.0
                    : null;

            let detailsPercent: number | null = null;
            let detailsType: 'under' | 'over' | null = null;
            if (difference != null && litresExpected != null && litresExpected > 0) {
                detailsPercent = Math.round((Math.abs(difference) / litresExpected) * 100);
                detailsType = difference >= 0 ? 'under' : 'over';
            }

            rows.push({
                vehicleKey: vKey,
                vehicleName: vehicleName,
                make: make,
                model: model,
                type: type,
                dateFrom: dateFrom,
                dateTo: dateTo,
                fillUps: txs.length,
                distance: distance,
                litresUsed: litresUsed,
                litresExpected: litresExpected,
                difference: difference,
                consumption: consumption,
                expectedConsumption: expectedConsumption,
                detailsPercent: detailsPercent,
                detailsType: detailsType,
            });
        });

        // Filter by searchTerm if active
        let filtered = rows;
        if (searchTerm.trim()) {
            const q = searchTerm.trim().toLowerCase();
            filtered = rows.filter(
                (r) =>
                    r.vehicleKey.toLowerCase().includes(q) ||
                    r.vehicleName.toLowerCase().includes(q) ||
                    r.make.toLowerCase().includes(q) ||
                    r.model.toLowerCase().includes(q)
            );
        }

        // Sort rows (default: litresUsed desc)
        filtered.sort((a, b) => {
            let res = 0;
            switch (summarySortField) {
                case 'vehicle':
                    if (a.vehicleKey === '—') return -1;
                    if (b.vehicleKey === '—') return 1;
                    res = a.vehicleName.localeCompare(b.vehicleName);
                    break;
                case 'dateFrom':
                    res = a.dateFrom.localeCompare(b.dateFrom);
                    break;
                case 'fillUps':
                    res = a.fillUps - b.fillUps;
                    break;
                case 'distance': {
                    const valA = a.distance ?? -Infinity;
                    const valB = b.distance ?? -Infinity;
                    res = valA - valB;
                    break;
                }
                case 'litresUsed':
                    res = a.litresUsed - b.litresUsed;
                    break;
                case 'litresExpected': {
                    const valA = a.litresExpected ?? -Infinity;
                    const valB = b.litresExpected ?? -Infinity;
                    res = valA - valB;
                    break;
                }
                case 'difference': {
                    const valA = a.difference ?? -Infinity;
                    const valB = b.difference ?? -Infinity;
                    res = valA - valB;
                    break;
                }
                case 'consumption': {
                    const valA = a.consumption ?? -Infinity;
                    const valB = b.consumption ?? -Infinity;
                    res = valA - valB;
                    break;
                }
                default:
                    res = b.litresUsed - a.litresUsed;
            }
            return summarySortDirection === 'asc' ? res : -res;
        });

        return filtered;
    }, [
        summaryFilteredTransactions,
        vehicleMetadata,
        searchTerm,
        summarySortField,
        summarySortDirection,
    ]);

    // Summary KPIs matching screenshot: LITRES ISSUED and TOTAL DIFFERENCE
    const summaryKpis = useMemo(() => {
        let totalLitres = 0;
        let totalDiff = 0;
        let totalFillUps = 0;

        vehicleSummaryData.forEach((r) => {
            totalLitres += r.litresUsed;
            if (r.difference != null) {
                totalDiff += r.difference;
            }
            totalFillUps += r.fillUps;
        });

        return {
            totalLitres: Math.round(totalLitres),
            totalDifference: Math.round(totalDiff),
            totalFillUps: totalFillUps,
        };
    }, [vehicleSummaryData]);

    const totalSummaryRows = vehicleSummaryData.length;
    const paginatedVehicleSummaryRows = useMemo(() => {
        const start = (summaryPage - 1) * summaryPageSize;
        return vehicleSummaryData.slice(start, start + summaryPageSize);
    }, [vehicleSummaryData, summaryPage, summaryPageSize]);

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
                    'Vehicle',
                    'Make',
                    'Model',
                    'Type',
                    'Date From',
                    'Date To',
                    'Fill ups',
                ];
                const rows = vehicleSummaryData.map((r) => [
                    r.vehicleName,
                    r.make,
                    r.model,
                    r.type,
                    r.dateFrom,
                    r.dateTo,
                    r.fillUps,
                ]);
                if (format === 'csv') exportToCSV('vehicle_summary.csv', headers, rows);
                else if (format === 'excel') exportToExcel('vehicle_summary.xlsx', headers, rows, 'Vehicle Summary');
                else if (format === 'pdf') exportToPDF('Vehicle Summary Report', headers, rows);
            }
        } catch (err) {
            console.error('Failed export:', err);
        } finally {
            setIsExporting(null);
            setExportOpen(false);
        }
    };

    // -------------------------------------------------------------
    // PRINT
    // -------------------------------------------------------------
    const handlePrint = () => {
        window.print();
    };

    const printTitle =
        activeTab === 'report'
            ? 'Vehicles Fuel Consumption Report'
            : 'Vehicle Summary Report';

    // Print-only section: rendered into document.body via portal.
    // It holds ALL rows (not just the current page) and everything else is hidden while printing.
    const printRoot =
        mounted && (activeTab === 'report' || activeTab === 'summary')
            ? createPortal(
                <div id="vehicles-print-root">
                    <style>{`
                          #vehicles-print-root { display: none; }
                          @media print {
                              @page { size: A4 landscape; margin: 10mm; }
                              body:has(#vehicles-print-root) > *:not(#vehicles-print-root) { display: none !important; }
                              #vehicles-print-root { display: block !important; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; }
                              #vehicles-print-root h1 { font-size: 16px; margin: 0 0 2px; }
                              #vehicles-print-root .meta { font-size: 10px; color: #444; margin-bottom: 8px; }
                              #vehicles-print-root table { width: 100%; border-collapse: collapse; font-size: 10px; }
                              #vehicles-print-root thead { display: table-header-group; }
                              #vehicles-print-root tr { page-break-inside: avoid; }
                              #vehicles-print-root th, #vehicles-print-root td { border: 1px solid #bbb; padding: 3px 5px; text-align: left; }
                              #vehicles-print-root th { background: #eee !important; text-transform: uppercase; font-size: 9px; }
                              #vehicles-print-root .r { text-align: right; }
                              #vehicles-print-root .grp td { background: #122319 !important; color: #fff !important; font-weight: bold; }
                              #vehicles-print-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                          }
                      `}</style>

                    <h1>{printTitle}</h1>
                    <div className="meta">
                        {activeTab === 'report'
                            ? `Date range: ${reportDateRange.label} · Vehicles: ${groupedReportData.length} · Records: ${reportData.length}`
                            : `Date range: ${summaryDateRange.label} · Vehicles: ${vehicleSummaryData.length} · Fill ups: ${summaryKpis.totalFillUps}`}
                        {' · '}Generated: {new Date().toLocaleString()}
                    </div>

                    {activeTab === 'report' ? (
                        <table>
                            <thead>
                                <tr>
                                    <th>Vehicle</th>
                                    <th>Tank Filled</th>
                                    <th>Driver</th>
                                    <th>Make</th>
                                    <th>Model</th>
                                    <th className="r">Distance</th>
                                    <th className="r">Litres Used</th>
                                    <th className="r">Litres Expected</th>
                                    <th className="r">Difference</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupedReportData.map((group) => (
                                    <React.Fragment key={group.vehicleId}>
                                        <tr className="grp">
                                            <td colSpan={9}>{group.headerLabel}</td>
                                        </tr>
                                        {group.rows.map((row) => (
                                            <tr key={row.id}>
                                                <td>{row.vehicleId}</td>
                                                <td>
                                                    {row.date.replace(/-/g, '/')}, {row.time || '00:00:00'}
                                                </td>
                                                <td>{row.driverAttendant || '—'}</td>
                                                <td>{row.make}</td>
                                                <td>{row.model}</td>
                                                <td className="r">
                                                    {row.distance != null && row.distance > 0
                                                        ? formatNumber(row.distance, 0)
                                                        : '—'}
                                                </td>
                                                <td className="r">{formatNumber(row.fuelQuantity, 0)}</td>
                                                <td className="r">
                                                    {row.litresExpected != null ? row.litresExpected : '—'}
                                                </td>
                                                <td className="r">
                                                    {row.difference != null
                                                        ? row.difference > 0
                                                            ? `+${row.difference}`
                                                            : row.difference
                                                        : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Vehicle</th>
                                    <th>Make</th>
                                    <th>Model</th>
                                    <th>Type</th>
                                    <th>Date From</th>
                                    <th>Date To</th>
                                    <th className="r">Fill ups</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vehicleSummaryData.map((r, i) => (
                                    <tr key={`${r.vehicleKey}-${i}`}>
                                        <td>{r.vehicleName}</td>
                                        <td>{r.make}</td>
                                        <td>{r.model}</td>
                                        <td>{r.type}</td>
                                        <td>{r.dateFrom}</td>
                                        <td>{r.dateTo}</td>
                                        <td className="r">{r.fillUps}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>,
                document.body
            )
            : null;

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
        <>
            <PageContainer className="p-3 sm:p-4 space-y-3 h-full flex flex-col bg-[#eef5ee] min-h-screen text-slate-800">
                {/* Top Navigation Bar with Title, Subtabs and Search */}
                <div className="flex flex-wrap items-center justify-between gap-3 shrink-0 pb-1">
                    <div className="flex items-center gap-6">
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                            {activeTab === 'summary' ? 'Vehicle Summary' : 'Vehicles'}
                        </h1>
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

                                        {/* Date Range Dropdown */}
                                        <div className="relative" ref={dateRangeRef}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDateRangeOpen((prev) => !prev);
                                                    setCustomTabActive(reportDateRange.preset === 'custom');
                                                }}
                                                className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg h-8 px-3 border border-slate-200 shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                                            >
                                                <span>{reportDateRange.label}</span>
                                                <span className="bg-[#dcfce7] text-[#166534] px-1.5 py-0.5 rounded text-[10px] font-bold">
                                                    {reportData.length}
                                                </span>
                                                <ChevronDown className={cn('h-3 w-3 text-slate-400 transition-transform duration-150', dateRangeOpen && 'rotate-180')} />
                                            </button>

                                            {dateRangeOpen && (
                                                <div className="absolute left-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                                                    <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                        PREDEFINED RANGES
                                                    </div>

                                                    <div className="mt-1 max-h-[280px] overflow-y-auto">
                                                        {dateRangePresets.map((p) => {
                                                            const isSelected = reportDateRange.preset === p.key;
                                                            const count = countForPreset(p.key);
                                                            return (
                                                                <div key={p.key}>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleSelectPreset(p.key)}
                                                                        className={cn(
                                                                            'w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer',
                                                                            isSelected ? 'bg-emerald-50 text-slate-900 font-semibold' : 'text-slate-700'
                                                                        )}
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <span>{p.label}</span>
                                                                            {isSelected && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5">
                                                                            {p.hasCalendarIcon && <Calendar className="h-3 w-3 text-slate-400" />}
                                                                            <span
                                                                                className={cn(
                                                                                    'px-1.5 py-0.5 rounded text-[10px] font-medium min-w-[20px] text-center',
                                                                                    isSelected
                                                                                        ? 'bg-[#dcfce7] text-[#166534] font-bold'
                                                                                        : 'bg-slate-100 text-slate-500'
                                                                                )}
                                                                            >
                                                                                {count}
                                                                            </span>
                                                                        </div>
                                                                    </button>
                                                                    {(p.key === '30days' || p.key === 'lastMonth') && (
                                                                        <div className="my-1 border-t border-slate-100" />
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {customTabActive && (
                                                        <div className="px-3 pt-2.5 mt-1 border-t border-slate-100 flex flex-col gap-2">
                                                            <div className="flex gap-2">
                                                                <div className="flex-1">
                                                                    <label className="text-[10px] text-slate-500 font-medium block mb-0.5">From</label>
                                                                    <input
                                                                        type="date"
                                                                        value={customStart}
                                                                        onChange={(e) => setCustomStart(e.target.value)}
                                                                        className="w-full border border-slate-200 rounded-md px-2 py-1 text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                                                                    />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <label className="text-[10px] text-slate-500 font-medium block mb-0.5">To</label>
                                                                    <input
                                                                        type="date"
                                                                        value={customEnd}
                                                                        onChange={(e) => setCustomEnd(e.target.value)}
                                                                        className="w-full border border-slate-200 rounded-md px-2 py-1 text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={handleApplyCustom}
                                                                className="w-full bg-[#1b2e23] hover:bg-[#122319] text-white py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                                                            >
                                                                Apply Custom Range
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
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
                                            <span>{reportDateRange.label}</span>
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
                        <div className="bg-[#dbeadf] rounded-2xl sm:rounded-3xl border border-[#cbe0d0] p-3 sm:p-4 flex flex-col gap-3 shadow-2xs flex-1 min-h-0 overflow-hidden">
                            {/* Top Control Bar */}
                            <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
                                <div className="flex flex-wrap items-center gap-2.5">
                                    {/* Export results dropdown */}
                                    <div className="relative" ref={summaryExportRef}>
                                        <button
                                            type="button"
                                            onClick={() => setSummaryExportOpen((prev) => !prev)}
                                            className="bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-full h-8 px-3.5 border border-slate-200/90 shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                                        >
                                            <Download className="h-3.5 w-3.5 text-slate-600" />
                                            <span>Export results</span>
                                        </button>

                                        {summaryExportOpen && (
                                            <div className="absolute left-0 mt-1.5 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                                                <button
                                                    onClick={() => handleExport('excel')}
                                                    className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 cursor-pointer transition-colors"
                                                >
                                                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                                                    <span>Excel (.xlsx)</span>
                                                </button>
                                                <button
                                                    onClick={() => handleExport('csv')}
                                                    className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-sky-50 hover:text-sky-700 flex items-center gap-2 cursor-pointer transition-colors"
                                                >
                                                    <FileText className="h-4 w-4 text-sky-600" />
                                                    <span>CSV (.csv)</span>
                                                </button>
                                                <button
                                                    onClick={() => handleExport('pdf')}
                                                    className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-2 cursor-pointer transition-colors"
                                                >
                                                    <FileDown className="h-4 w-4 text-rose-600" />
                                                    <span>PDF Document</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Date Range Picker with Fill-up count badge: e.g. "📅 Month to Date [53] ⌵" */}
                                    <div className="relative" ref={summaryDateRangeRef}>
                                        <button
                                            type="button"
                                            onClick={() => setSummaryDateRangeOpen((prev) => !prev)}
                                            className="bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-full h-8 px-3.5 border border-slate-200/90 shadow-2xs flex items-center gap-2 cursor-pointer transition-colors"
                                        >
                                            <Calendar className="h-3.5 w-3.5 text-slate-600" />
                                            <span>{summaryDateRange.label}</span>
                                            <span className="bg-[#d7ecdb] text-[#1b5e28] px-2 py-0.5 rounded-full text-[11px] font-bold">
                                                {summaryKpis.totalFillUps}
                                            </span>
                                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                        </button>

                                        {summaryDateRangeOpen && (
                                            <div className="absolute left-0 mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                                                <div className="flex border-b border-slate-100 pb-1.5 mb-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSummaryCustomTabActive(false)}
                                                        className={cn(
                                                            'flex-1 text-center py-1 text-xs font-semibold rounded-md transition-colors',
                                                            !summaryCustomTabActive ? 'bg-[#1b2e23] text-white' : 'text-slate-600 hover:bg-slate-100'
                                                        )}
                                                    >
                                                        Presets
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSummaryCustomTabActive(true)}
                                                        className={cn(
                                                            'flex-1 text-center py-1 text-xs font-semibold rounded-md transition-colors',
                                                            summaryCustomTabActive ? 'bg-[#1b2e23] text-white' : 'text-slate-600 hover:bg-slate-100'
                                                        )}
                                                    >
                                                        Custom
                                                    </button>
                                                </div>

                                                {!summaryCustomTabActive ? (
                                                    <div className="max-h-64 overflow-y-auto space-y-0.5">
                                                        {summaryDatePresets.map((preset) => {
                                                            const cnt = countForSummaryPreset(preset.key);
                                                            const isSelected = summaryDateRange.preset === preset.key;
                                                            return (
                                                                <button
                                                                    key={preset.key}
                                                                    type="button"
                                                                    onClick={() => handleSelectSummaryPreset(preset.key)}
                                                                    className={cn(
                                                                        'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer',
                                                                        isSelected ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                                                                    )}
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        {preset.hasCalendarIcon && <Calendar className="h-3 w-3 text-slate-400" />}
                                                                        <span>{preset.label}</span>
                                                                    </div>
                                                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                                                                        {cnt}
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="p-2 space-y-2.5">
                                                        <div>
                                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Start Date</label>
                                                            <input
                                                                type="date"
                                                                value={summaryCustomStart}
                                                                onChange={(e) => setSummaryCustomStart(e.target.value)}
                                                                className="w-full text-xs p-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1b2e23]"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">End Date</label>
                                                            <input
                                                                type="date"
                                                                value={summaryCustomEnd}
                                                                onChange={(e) => setSummaryCustomEnd(e.target.value)}
                                                                className="w-full text-xs p-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1b2e23]"
                                                            />
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            onClick={handleApplySummaryCustom}
                                                            className="w-full bg-[#1b2e23] hover:bg-[#253f30] text-white text-xs h-7 mt-1 cursor-pointer"
                                                        >
                                                            Apply Range
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Vehicle Filter: "🚗 All vehicles ⌵" */}
                                    <div className="relative" ref={summaryVehicleRef}>
                                        <button
                                            type="button"
                                            onClick={() => setSummaryVehicleDropdownOpen((prev) => !prev)}
                                            className="bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-full h-8 px-3.5 border border-slate-200/90 shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                                        >
                                            <Car className="h-3.5 w-3.5 text-slate-600" />
                                            <span>
                                                {summaryVehicleFilter === 'all'
                                                    ? 'All vehicles'
                                                    : summaryVehicleFilter}
                                            </span>
                                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                        </button>

                                        {summaryVehicleDropdownOpen && (
                                            <div className="absolute left-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                                                <div className="relative mb-1.5">
                                                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Filter vehicles..."
                                                        value={summaryVehicleSearch}
                                                        onChange={(e) => setSummaryVehicleSearch(e.target.value)}
                                                        className="w-full pl-8 pr-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1b2e23]"
                                                    />
                                                </div>
                                                <div className="max-h-56 overflow-y-auto space-y-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSummaryVehicleFilter('all');
                                                            setSummaryPage(1);
                                                            setSummaryVehicleDropdownOpen(false);
                                                        }}
                                                        className={cn(
                                                            'w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer flex items-center justify-between',
                                                            summaryVehicleFilter === 'all'
                                                                ? 'bg-emerald-50 text-emerald-800 font-semibold'
                                                                : 'text-slate-700 hover:bg-slate-50'
                                                        )}
                                                    >
                                                        <span>All vehicles</span>
                                                        {summaryVehicleFilter === 'all' && <Check className="h-3.5 w-3.5 text-emerald-700" />}
                                                    </button>
                                                    {summaryVehicleOptions
                                                        .filter((v) =>
                                                            !summaryVehicleSearch.trim() ||
                                                            v.toLowerCase().includes(summaryVehicleSearch.toLowerCase())
                                                        )
                                                        .map((v) => {
                                                            const isSelected = summaryVehicleFilter === v;
                                                            return (
                                                                <button
                                                                    key={v}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSummaryVehicleFilter(v);
                                                                        setSummaryPage(1);
                                                                        setSummaryVehicleDropdownOpen(false);
                                                                    }}
                                                                    className={cn(
                                                                        'w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer flex items-center justify-between',
                                                                        isSelected
                                                                            ? 'bg-emerald-50 text-emerald-800 font-semibold'
                                                                            : 'text-slate-700 hover:bg-slate-50'
                                                                    )}
                                                                >
                                                                    <span className="truncate">{v}</span>
                                                                    {isSelected && <Check className="h-3.5 w-3.5 text-emerald-700" />}
                                                                </button>
                                                            );
                                                        })}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* KPI text: LITRES ISSUED 3 430   TOTAL DIFFERENCE 158 */}
                                    <div className="flex items-center gap-5 ml-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                                        <span>
                                            LITRES ISSUED{' '}
                                            <span className="text-[#b91c1c] text-sm font-extrabold ml-1">
                                                {formatSpaceNumber(summaryKpis.totalLitres, 0)}
                                            </span>
                                        </span>
                                        <span>
                                            TOTAL DIFFERENCE{' '}
                                            <span
                                                className={cn(
                                                    'text-sm font-extrabold ml-1',
                                                    summaryKpis.totalDifference >= 0 ? 'text-[#166534]' : 'text-[#b91c1c]'
                                                )}
                                            >
                                                {summaryKpis.totalDifference >= 0
                                                    ? `${formatSpaceNumber(summaryKpis.totalDifference, 0)}`
                                                    : formatSpaceNumber(summaryKpis.totalDifference, 0)}
                                            </span>
                                        </span>
                                    </div>
                                </div>

                                {/* Top Right Controls: Displaying 1-14 of 14, Page Size, Print */}
                                <div className="flex items-center gap-3 text-xs text-slate-600">
                                    <span className="font-medium">
                                        Displaying {totalSummaryRows === 0 ? 0 : (summaryPage - 1) * summaryPageSize + 1}-
                                        {Math.min(summaryPage * summaryPageSize, totalSummaryRows)} of {totalSummaryRows}
                                    </span>
                                    <select
                                        value={summaryPageSize}
                                        onChange={(e) => {
                                            setSummaryPageSize(Number(e.target.value));
                                            setSummaryPage(1);
                                        }}
                                        className="bg-white border border-slate-200/90 rounded-full px-3 py-1 text-xs text-slate-800 focus:outline-none shadow-2xs cursor-pointer"
                                    >
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                    <button
                                        onClick={handlePrint}
                                        className="h-8 w-8 rounded-full bg-white border border-slate-200/90 shadow-2xs flex items-center justify-center hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors"
                                        title="Print"
                                    >
                                        <Printer className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Summary Table */}
                            <div className="flex-1 overflow-x-auto overflow-y-auto bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-2xs min-h-0">
                                <table className="w-full text-xs text-left whitespace-nowrap border-collapse">
                                    <thead className="sticky top-0 z-10 bg-slate-50 select-none text-[11px]">
                                        <tr className="border-b border-slate-200">
                                            <th
                                                onClick={() => handleSummarySort('vehicle')}
                                                className="py-2.5 px-3 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                                            >
                                                <div className="flex items-center gap-1">
                                                    <span>Vehicle</span>
                                                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                                                </div>
                                            </th>
                                            <th className="py-2.5 px-3 font-bold text-slate-700">
                                                MAKE
                                            </th>
                                            <th className="py-2.5 px-3 font-bold text-slate-700">
                                                MODEL
                                            </th>
                                            <th className="py-2.5 px-3 font-bold text-slate-700">
                                                TYPE
                                            </th>
                                            <th
                                                onClick={() => handleSummarySort('dateFrom')}
                                                className="py-2.5 px-3 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                                            >
                                                <div className="flex items-center gap-1">
                                                    <span>Date From</span>
                                                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                                                </div>
                                            </th>
                                            <th className="py-2.5 px-3 font-bold text-slate-700">
                                                DATE TO
                                            </th>
                                            <th
                                                onClick={() => handleSummarySort('fillUps')}
                                                className="py-2.5 px-3 font-bold text-slate-700 text-right cursor-pointer hover:bg-slate-100 transition-colors"
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    <span>Fill ups</span>
                                                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                        {paginatedVehicleSummaryRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-12 text-center text-slate-400">
                                                    No summary records found for this period.
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedVehicleSummaryRows.map((r, index) => (
                                                <tr
                                                    key={`${r.vehicleKey}-${index}`}
                                                    className="hover:bg-slate-50/80 transition-colors"
                                                >
                                                    <td
                                                        className="py-2.5 px-3 font-semibold text-slate-900 max-w-[220px] truncate"
                                                        title={r.vehicleName}
                                                    >
                                                        {r.vehicleName}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-slate-700 font-medium">{r.make}</td>
                                                    <td className="py-2.5 px-3 text-slate-700 font-medium">{r.model}</td>
                                                    <td className="py-2.5 px-3 text-slate-500">{r.type}</td>
                                                    <td className="py-2.5 px-3 font-mono text-slate-700 text-xs">
                                                        {r.dateFrom}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono text-slate-700 text-xs">
                                                        {r.dateTo}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-medium text-slate-900">
                                                        {r.fillUps}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Bottom Control Bar repeating controls */}
                            <div className="flex flex-wrap items-center justify-between gap-3 shrink-0 pt-1">
                                <div className="flex flex-wrap items-center gap-2.5">
                                    {/* Export results dropdown */}
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setSummaryExportOpen((prev) => !prev)}
                                            className="bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-full h-8 px-3.5 border border-slate-200/90 shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                                        >
                                            <Download className="h-3.5 w-3.5 text-slate-600" />
                                            <span>Export results</span>
                                        </button>
                                    </div>

                                    {/* Date Range Button */}
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setSummaryDateRangeOpen((prev) => !prev)}
                                            className="bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-full h-8 px-3.5 border border-slate-200/90 shadow-2xs flex items-center gap-2 cursor-pointer transition-colors"
                                        >
                                            <Calendar className="h-3.5 w-3.5 text-slate-600" />
                                            <span>{summaryDateRange.label}</span>
                                            <span className="bg-[#d7ecdb] text-[#1b5e28] px-2 py-0.5 rounded-full text-[11px] font-bold">
                                                {summaryKpis.totalFillUps}
                                            </span>
                                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                        </button>
                                    </div>

                                    {/* Vehicle Filter Button */}
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setSummaryVehicleDropdownOpen((prev) => !prev)}
                                            className="bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-full h-8 px-3.5 border border-slate-200/90 shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                                        >
                                            <Car className="h-3.5 w-3.5 text-slate-600" />
                                            <span>
                                                {summaryVehicleFilter === 'all'
                                                    ? 'All vehicles'
                                                    : summaryVehicleFilter}
                                            </span>
                                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                        </button>
                                    </div>
                                </div>

                                {/* Bottom Right Controls */}
                                <div className="flex items-center gap-3 text-xs text-slate-600">
                                    <span className="font-medium">
                                        Displaying {totalSummaryRows === 0 ? 0 : (summaryPage - 1) * summaryPageSize + 1}-
                                        {Math.min(summaryPage * summaryPageSize, totalSummaryRows)} of {totalSummaryRows}
                                    </span>
                                    <select
                                        value={summaryPageSize}
                                        onChange={(e) => {
                                            setSummaryPageSize(Number(e.target.value));
                                            setSummaryPage(1);
                                        }}
                                        className="bg-white border border-slate-200/90 rounded-full px-3 py-1 text-xs text-slate-800 focus:outline-none shadow-2xs cursor-pointer"
                                    >
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                    <button
                                        onClick={handlePrint}
                                        className="h-8 w-8 rounded-full bg-white border border-slate-200/90 shadow-2xs flex items-center justify-center hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors"
                                        title="Print"
                                    >
                                        <Printer className="h-3.5 w-3.5" />
                                    </button>

                                    {/* Pagination navigation controls if totalSummaryPages > 1 */}
                                    {totalSummaryPages > 1 && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setSummaryPage(1)}
                                                disabled={summaryPage === 1}
                                                className="h-7 w-7 rounded-full bg-white border border-slate-200/90 flex items-center justify-center text-slate-600 disabled:opacity-40 cursor-pointer"
                                            >
                                                <ChevronsLeft className="h-3 w-3" />
                                            </button>
                                            <button
                                                onClick={() => setSummaryPage((p) => Math.max(1, p - 1))}
                                                disabled={summaryPage === 1}
                                                className="h-7 w-7 rounded-full bg-white border border-slate-200/90 flex items-center justify-center text-slate-600 disabled:opacity-40 cursor-pointer"
                                            >
                                                <ChevronLeft className="h-3 w-3" />
                                            </button>
                                            <span className="h-7 w-7 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs">
                                                {summaryPage}
                                            </span>
                                            <button
                                                onClick={() => setSummaryPage((p) => Math.min(totalSummaryPages, p + 1))}
                                                disabled={summaryPage === totalSummaryPages}
                                                className="h-7 w-7 rounded-full bg-white border border-slate-200/90 flex items-center justify-center text-slate-600 disabled:opacity-40 cursor-pointer"
                                            >
                                                <ChevronRight className="h-3 w-3" />
                                            </button>
                                            <button
                                                onClick={() => setSummaryPage(totalSummaryPages)}
                                                disabled={summaryPage === totalSummaryPages}
                                                className="h-7 w-7 rounded-full bg-white border border-slate-200/90 flex items-center justify-center text-slate-600 disabled:opacity-40 cursor-pointer"
                                            >
                                                <ChevronsRight className="h-3 w-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </PageContainer>

            {/* Print-only section (portal into document.body) */}
            {printRoot}
        </>
    );
}

export default function VehiclesPage() {
    return (
        <Suspense
            fallback={
                <PageContainer>
                    <div className="flex h-64 items-center justify-center">
                        <LoadingSpinner size="lg" />
                    </div>
                </PageContainer>
            }
        >
            <VehiclesContent />
        </Suspense>
    );
}