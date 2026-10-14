// src/app/(dashboard)/vehicle-summary/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
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
    Check,
    CheckCircle2,
    AlertTriangle,
    Calendar,
    Car,
    ArrowUpDown,
} from 'lucide-react';
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

function VehicleSummaryContent() {
    const router = useRouter();
    const selectedClient = useClientStore((state) => state.selectedClient);

    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    // Data states
    const [transactions, setTransactions] = useState<FuelEfficiencyTransaction[]>([]);
    const [vehicleMetadata, setVehicleMetadata] = useState<Map<string, VehicleMeta>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Search filter
    const [searchTerm, setSearchTerm] = useState('');

    // Summary view states
    const [summaryPage, setSummaryPage] = useState(1);
    const [summaryPageSize, setSummaryPageSize] = useState<number>(25);

    // Filters & dropdowns
    const [summaryDateRange, setSummaryDateRange] = useState<DateRange>(() => getDateRangeFromPreset('monthToDate'));
    const [summaryDateRangeOpen, setSummaryDateRangeOpen] = useState(false);
    const [summaryVehicleFilter, setSummaryVehicleFilter] = useState<string>('all');
    const [summaryVehicleDropdownOpen, setSummaryVehicleDropdownOpen] = useState(false);
    const [summaryVehicleSearch, setSummaryVehicleSearch] = useState('');
    const [summaryCustomStart, setSummaryCustomStart] = useState('');
    const [summaryCustomEnd, setSummaryCustomEnd] = useState('');
    const [summaryCustomTabActive, setSummaryCustomTabActive] = useState(false);

    // Sorting state
    const [summarySortField, setSummarySortField] = useState<
        'vehicle' | 'dateFrom' | 'fillUps' | 'distance' | 'litresUsed' | 'litresExpected' | 'difference' | 'consumption'
    >('litresUsed');
    const [summarySortDirection, setSummarySortDirection] = useState<'asc' | 'desc'>('desc');

    // Export dropdown
    const [summaryExportOpen, setSummaryExportOpen] = useState(false);
    const [isExporting, setIsExporting] = useState<string | null>(null);
    const summaryExportRef = useRef<HTMLDivElement>(null);
    const summaryDateRangeRef = useRef<HTMLDivElement>(null);
    const summaryVehicleRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
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
            setError(null);
        } catch (err) {
            console.error('Failed to load vehicles data:', err);
            setError('Failed to load vehicle transactions and efficiency data.');
        } finally {
            setLoading(false);
            useClientStore.getState().setClientLoading(false);
        }
    };

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

    const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
        setIsExporting(format);
        try {
            const headers = [
                'Vehicle',
                'Make',
                'Model',
                'Type',
                'Date From',
                'Date To',
                'Fill ups',
                'Distance (km)',
                'Litres Used',
                'Litres Expected',
                'Difference',
                'Consumption (km/L)',
                'Expected (km/L)',
                'Details',
            ];
            const rows = vehicleSummaryData.map((r) => [
                r.vehicleName,
                r.make,
                r.model,
                r.type,
                r.dateFrom,
                r.dateTo,
                r.fillUps,
                r.distance != null ? formatSpaceNumber(r.distance, 0) : '—',
                formatSpaceNumber(r.litresUsed, 0),
                r.litresExpected != null ? formatSpaceNumber(r.litresExpected, 0) : '—',
                r.difference != null
                    ? r.difference > 0
                        ? `+${formatSpaceNumber(r.difference, 0)}`
                        : formatSpaceNumber(r.difference, 0)
                    : '—',
                r.consumption != null ? r.consumption.toFixed(2) : '—',
                r.expectedConsumption != null ? r.expectedConsumption.toFixed(2) : '—',
                r.detailsPercent != null && r.detailsType != null
                    ? `${r.detailsPercent}% ${r.detailsType === 'under' ? 'Under' : 'Over'}`
                    : '—',
            ]);
            if (format === 'csv') exportToCSV('vehicle_summary.csv', headers, rows);
            else if (format === 'excel') exportToExcel('vehicle_summary.xlsx', headers, rows, 'Vehicle Summary');
            else if (format === 'pdf') exportToPDF('Vehicle Summary Report', headers, rows);
        } catch (err) {
            console.error('Failed export:', err);
        } finally {
            setIsExporting(null);
            setSummaryExportOpen(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const printRoot = mounted
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
                          #vehicles-print-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                      }
                  `}</style>

                <h1>Vehicle Summary Report</h1>
                <div className="meta">
                    Date range: {summaryDateRange.label} · Vehicles: {vehicleSummaryData.length} · Fill ups: {summaryKpis.totalFillUps}
                    {' · '}Generated: {new Date().toLocaleString()}
                </div>

                <table>
                    <thead>
                        <tr>
                            <th rowSpan={2}>Vehicle</th>
                            <th rowSpan={2}>Make</th>
                            <th rowSpan={2}>Model</th>
                            <th rowSpan={2}>Type</th>
                            <th rowSpan={2}>Date From</th>
                            <th rowSpan={2}>Date To</th>
                            <th rowSpan={2} className="r">Fill ups</th>
                            <th colSpan={4} style={{ background: '#d7ecdb', textAlign: 'center' }}>Distance and Litres</th>
                            <th colSpan={3} style={{ background: '#fcecd7', textAlign: 'center' }}>Fuel Consumption km/L</th>
                        </tr>
                        <tr>
                            <th className="r" style={{ background: '#d7ecdb' }}>Distance</th>
                            <th className="r" style={{ background: '#d7ecdb' }}>Litres Used</th>
                            <th className="r" style={{ background: '#d7ecdb' }}>Litres Expected</th>
                            <th className="r" style={{ background: '#d7ecdb' }}>Difference</th>
                            <th className="r" style={{ background: '#fcecd7' }}>Consumption</th>
                            <th className="r" style={{ background: '#fcecd7' }}>Expected</th>
                            <th style={{ background: '#fcecd7', textAlign: 'center' }}>Details</th>
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
                                <td className="r">{r.distance != null ? formatSpaceNumber(r.distance, 0) : '—'}</td>
                                <td className="r">{formatSpaceNumber(r.litresUsed, 0)}</td>
                                <td className="r">{r.litresExpected != null ? formatSpaceNumber(r.litresExpected, 0) : '—'}</td>
                                <td className="r">
                                    {r.difference != null
                                        ? r.difference > 0
                                            ? `+${formatSpaceNumber(r.difference, 0)}`
                                            : formatSpaceNumber(r.difference, 0)
                                        : '—'}
                                </td>
                                <td className="r">{r.consumption != null ? r.consumption.toFixed(2) : '—'}</td>
                                <td className="r">{r.expectedConsumption != null ? r.expectedConsumption.toFixed(2) : '—'}</td>
                                <td style={{ textAlign: 'center' }}>
                                    {r.detailsPercent != null && r.detailsType != null
                                        ? `${r.detailsPercent}% ${r.detailsType === 'under' ? 'Under' : 'Over'}`
                                        : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
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
                <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
                    <p className="text-sm font-semibold text-rose-600 mb-3">{error}</p>
                    <Button onClick={loadAllData} className="bg-[#1b2e23] text-white text-xs">
                        Retry
                    </Button>
                </div>
            </PageContainer>
        );
    }

    return (
        <>
            <PageContainer className="p-3 sm:p-4 space-y-3 h-[calc(100vh-64px)] flex flex-col overflow-hidden">
                {/* Top Navigation Bar with Title and Search */}
                <div className="flex flex-wrap items-center justify-between gap-3 shrink-0 pb-1">
                    <div className="flex items-center gap-6">
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                            Vehicle Summary
                        </h1>
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

                {/* MAIN CONTENT: SUMMARY VIEW */}
                <div className="flex-1 min-h-0 flex flex-col">
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

                                {/* Date Range Picker with Fill-up count badge */}
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

                                {/* Vehicle Filter */}
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

                                {/* KPI text: LITRES ISSUED and TOTAL DIFFERENCE */}
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

                            {/* Top Right Controls: Displaying count, Page Size, Print */}
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
                                    {/* Header Level 1 */}
                                    <tr className="border-b border-slate-200">
                                        <th
                                            rowSpan={2}
                                            onClick={() => handleSummarySort('vehicle')}
                                            className="py-2.5 px-3 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>Vehicle</span>
                                                <ArrowUpDown className="h-3 w-3 text-slate-400" />
                                            </div>
                                        </th>
                                        <th rowSpan={2} className="py-2.5 px-3 font-bold text-slate-700">
                                            MAKE
                                        </th>
                                        <th rowSpan={2} className="py-2.5 px-3 font-bold text-slate-700">
                                            MODEL
                                        </th>
                                        <th rowSpan={2} className="py-2.5 px-3 font-bold text-slate-700">
                                            TYPE
                                        </th>
                                        <th
                                            rowSpan={2}
                                            onClick={() => handleSummarySort('dateFrom')}
                                            className="py-2.5 px-3 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>Date From</span>
                                                <ArrowUpDown className="h-3 w-3 text-slate-400" />
                                            </div>
                                        </th>
                                        <th rowSpan={2} className="py-2.5 px-3 font-bold text-slate-700">
                                            DATE TO
                                        </th>
                                        <th
                                            rowSpan={2}
                                            onClick={() => handleSummarySort('fillUps')}
                                            className="py-2.5 px-3 font-bold text-slate-700 text-right cursor-pointer hover:bg-slate-100 transition-colors"
                                        >
                                            <div className="flex items-center justify-end gap-1">
                                                <span>Fill ups</span>
                                                <ArrowUpDown className="h-3 w-3 text-slate-400" />
                                            </div>
                                        </th>
                                    </tr>

                                    {/* Header Level 2 */}
                                    <tr className="border-b border-slate-200">
                                        <th
                                            onClick={() => handleSummarySort('distance')}
                                            className="py-2 px-3 font-bold text-slate-700 text-right  border-l border-[#c4e3c9] cursor-pointer hover:bg-[#d5eed9] transition-colors"
                                        >
                                            <div className="flex items-center justify-end gap-1">
                                                <span>Distance</span>
                                                <ArrowUpDown className="h-3 w-3 text-slate-400" />
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSummarySort('litresUsed')}
                                            className="py-2 px-3 font-bold text-slate-700 text-right cursor-pointer hover:bg-[#d5eed9] transition-colors"
                                        >
                                            <div className="flex items-center justify-end gap-1">
                                                <span>Litres Used</span>
                                                <ArrowUpDown className="h-3 w-3 text-slate-400" />
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSummarySort('litresExpected')}
                                            className="py-2 px-3 font-bold text-slate-700 text-right cursor-pointer hover:bg-[#d5eed9] transition-colors"
                                        >
                                            LITRES EXPECTED
                                        </th>
                                        <th
                                            onClick={() => handleSummarySort('difference')}
                                            className="py-2 px-3 font-bold text-slate-700 text-right border-r border-[#c4e3c9] cursor-pointer hover:bg-[#d5eed9] transition-colors"
                                        >
                                            <div className="flex items-center justify-end gap-1">
                                                <span>Difference</span>
                                                <ArrowUpDown className="h-3 w-3 text-slate-400" />
                                            </div>
                                        </th>
                                        <th
                                            onClick={() => handleSummarySort('consumption')}
                                            className="py-2 px-3 font-bold text-slate-700 text-right cursor-pointer hover:bg-[#fae6ce] transition-colors"
                                        >
                                            <div className="flex items-center justify-end gap-1">
                                                <span>Consumption</span>
                                                <ArrowUpDown className="h-3 w-3 text-slate-400" />
                                            </div>
                                        </th>
                                        <th className="py-2 px-3 font-bold text-slate-700 text-right">
                                            EXPECTED
                                        </th>
                                        <th className="py-2 px-3 font-bold text-slate-700 text-center">
                                            DETAILS
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {paginatedVehicleSummaryRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={14} className="py-12 text-center text-slate-400">
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

                                                {/* Distance & Litres columns */}
                                                <td className="py-2.5 px-3 text-right font-mono text-slate-800 font-medium bg-[#f5fbf6]/40">
                                                    {r.distance != null ? formatSpaceNumber(r.distance, 0) : '—'}
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-mono text-slate-900 font-bold bg-[#f5fbf6]/40">
                                                    {formatSpaceNumber(r.litresUsed, 0)}
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-mono text-slate-800 font-semibold bg-[#f5fbf6]/40">
                                                    {r.litresExpected != null
                                                        ? formatSpaceNumber(r.litresExpected, 0)
                                                        : '—'}
                                                </td>
                                                <td
                                                    className={cn(
                                                        'py-2.5 px-3 text-right font-mono font-bold bg-[#f5fbf6]/40',
                                                        r.difference == null
                                                            ? 'text-slate-400'
                                                            : r.difference > 0
                                                                ? 'text-[#16a34a]'
                                                                : 'text-[#dc2626]'
                                                    )}
                                                >
                                                    {r.difference != null
                                                        ? r.difference > 0
                                                            ? `+${formatSpaceNumber(r.difference, 0)}`
                                                            : formatSpaceNumber(r.difference, 0)
                                                        : '—'}
                                                </td>

                                                {/* Fuel Consumption columns */}
                                                <td className="py-2.5 px-3 text-right font-mono text-slate-900 font-bold bg-[#fffaf4]/50">
                                                    {r.consumption != null ? r.consumption.toFixed(2) : '—'}
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-mono text-slate-700 bg-[#fffaf4]/50">
                                                    {r.expectedConsumption != null
                                                        ? r.expectedConsumption.toFixed(2)
                                                        : '—'}
                                                </td>
                                                <td className="py-2.5 px-3 text-center bg-[#fffaf4]/50">
                                                    {r.detailsPercent != null && r.detailsType != null ? (
                                                        r.detailsType === 'under' ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#e8f7ec] text-[#166534] border border-[#bbf7d0]">
                                                                <CheckCircle2 className="h-3 w-3 text-[#166534]" />
                                                                <span>{r.detailsPercent}% Under</span>
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#fef2f2] text-[#991b1b] border border-[#fecaca]">
                                                                <AlertTriangle className="h-3 w-3 text-[#dc2626]" />
                                                                <span>{r.detailsPercent}% Over</span>
                                                            </span>
                                                        )
                                                    ) : (
                                                        <span className="text-slate-400 font-mono">—</span>
                                                    )}
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

                                {/* Pagination navigation controls */}
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
                </div>
            </PageContainer>

            {/* Print-only section */}
            {printRoot}
        </>
    );
}

export default function VehicleSummaryPage() {
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
            <VehicleSummaryContent />
        </Suspense>
    );
}
