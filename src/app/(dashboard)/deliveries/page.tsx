'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Calendar, Download, AlertTriangle, RefreshCw, RotateCcw, Sliders, ChevronDown, FileSpreadsheet, FileText, FileDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageContainer } from '@/components/layout/PageContainer';
import { deliveryService } from '@/services/deliveryService';
import { authService } from '@/lib/auth';
import { formatDate, formatFuel, exportToCSV, exportToExcel, exportToPDF } from '@/lib/utils';
import { FuelDelivery } from '@/types/fuel';
import { useClientStore } from '@/services/api';

import { CustomTable } from '@/components/ui/table';

import { DateRangePicker, DateRange, getDateRangeFromPreset } from '@/components/common/DateRangePicker';

export default function DeliveriesPage() {
    const router = useRouter();
    const selectedClient = useClientStore((state) => state.selectedClient);
    const [allDeliveries, setAllDeliveries] = useState<FuelDelivery[]>([]);
    const [deliveries, setDeliveries] = useState<FuelDelivery[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [dateRange, setDateRange] = useState<DateRange>(getDateRangeFromPreset('30days'));
    const [exportOpen, setExportOpen] = useState(false);
    const [isExporting, setIsExporting] = useState<string | null>(null);
    const exportRef = useRef<HTMLDivElement>(null);

    // Close export dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
                setExportOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const columns = [
        {
            key: "deliveryId",
            header: "Delivery ID",
            headerClassName: "bg-primary text-white",
            cellClassName: "font-bold text-slate-900",
        },
        {
            key: "date",
            header: "Date",
            headerClassName: "bg-[#137e19] text-white",
            cellClassName: "text-slate-600",
        },
        {
            key: "time",
            header: "Time",
            headerClassName: "bg-[#137e19] text-white",
            cellClassName: "text-slate-600",
        },
        {
            key: "quantity",
            header: "Quantity",
            headerClassName: "bg-[#222] text-white",
            cellClassName: "font-bold text-slate-900",
            render: (delivery: FuelDelivery) => formatFuel(delivery.quantity),
        },
        {
            key: "name",
            header: "Name",
            headerClassName: "bg-primary text-white",
            cellClassName: "text-slate-600",
            render: (delivery: FuelDelivery) => delivery.name || 'Calculated Delivery',
        },
        {
            key: "acronym",
            header: "Acronym",
            headerClassName: "bg-primary text-white",
            cellClassName: "text-slate-600",
            render: (delivery: FuelDelivery) => delivery.acronym || 'CD',
        },
    ];

    useEffect(() => {
        const checkAuth = async () => {
            const isAuthenticated = await authService.isAuthenticated();
            if (!isAuthenticated) {
                router.push('/login');
                return;
            }
            loadData();
        };
        checkAuth();
    }, [router, page, selectedClient, dateRange.startDate, dateRange.endDate, dateRange.preset]);

    const loadData = async (
        overrideSearch?: string,
        overrideDateRange?: DateRange
    ) => {
        try {
            setLoading(true);
            const currentRange = overrideDateRange || dateRange;
            const currentSearch = overrideSearch !== undefined ? overrideSearch : search;

            const response = await deliveryService.getDeliveries({
                page,
                pageSize,
                search: currentSearch || undefined,
                startDate: currentRange.startDate || undefined,
                endDate: currentRange.endDate || undefined,
            });
            setDeliveries(response.data);
            setTotal(response.total);
            setTotalPages(response.totalPages);

            // Fetch all records for badge counts in DateRangePicker if needed
            if (allDeliveries.length === 0 || currentRange.preset === 'all') {
                const allResponse = await deliveryService.getDeliveries({
                    page: 1,
                    pageSize: 100000,
                    startDate: undefined,
                    endDate: undefined
                });
                setAllDeliveries(allResponse.data);
            }

            setError(null);
        } catch (err) {
            setError('Failed to load deliveries');
        } finally {
            setLoading(false);
            useClientStore.getState().setClientLoading(false);
        }
    };

    const handleSearch = () => {
        setPage(1);
        loadData();
    };

    const handleReset = () => {
        const defaultRange = getDateRangeFromPreset('30days');
        setSearch('');
        setDateRange(defaultRange);
        setPage(1);
        loadData('', defaultRange);
    };

    const handleExport = async (format: 'excel' | 'csv' | 'pdf') => {
        try {
            setIsExporting(format);
            const response = await deliveryService.getDeliveries({
                page: 1,
                pageSize: 100000,
                search: search || undefined,
                startDate: dateRange.startDate || undefined,
                endDate: dateRange.endDate || undefined,
            });
            const exportDeliveries = response.data;
            if (exportDeliveries.length === 0) {
                setExportOpen(false);
                return;
            }
            const headers = ['Delivery ID', 'Date', 'Time', 'Quantity (L)', 'Name', 'Acronym'];
            const rows = exportDeliveries.map(d => [
                d.deliveryId,
                d.date,
                d.time,
                d.quantity,
                d.name || 'Calculated Delivery',
                d.acronym || 'CD',
            ]);

            const dateLabel = dateRange.preset || 'custom';

            if (format === 'csv') {
                exportToCSV(`deliveries_${dateLabel}.csv`, headers, rows);
            } else if (format === 'excel') {
                exportToExcel(`deliveries_${dateLabel}.xls`, headers, rows, 'Deliveries');
            } else if (format === 'pdf') {
                exportToPDF('Fuel Deliveries Report', headers, rows);
            }
        } catch (err) {
            console.error('Failed to export deliveries:', err);
        } finally {
            setIsExporting(null);
            setExportOpen(false);
        }
    };

    if (loading && deliveries.length === 0) {
        return (
            <PageContainer>
                <div className="flex items-center justify-center min-h-[400px]">
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
                    <Button onClick={() => loadData()}>Try Again</Button>
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            {/* Filters & Table Card wrapper */}
            <div className="flex-1 flex flex-col bg-white border border-slate-200 shadow-sm rounded p-4 mb-4">
                {/* Filter bar container matching the bootstrap grid structure */}
                <div className="mb-4 py-2.5 px-4 bg-[#eefcf2] border border-[#d6f2e1] rounded w-full shrink-0">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
                        <div className="flex flex-col sm:flex-row flex-1 gap-3 items-stretch sm:items-end">
                            {/* Search Input Group */}
                            <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Search Deliveries</label>
                                <div className="flex h-8">
                                    <span className="flex items-center px-3 border border-r-0 border-slate-200 bg-slate-50 rounded-l text-slate-400">
                                        <Search className="h-3 w-3" />
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="Search by ID..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        className="flex-1 border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] h-8 rounded-r rounded-l-none"
                                    />
                                </div>
                            </div>

                            {/* Date Range Selector */}
                            <DateRangePicker
                                value={dateRange}
                                onChange={(newRange) => {
                                    setDateRange(newRange);
                                    setPage(1);
                                }}
                                allRecords={allDeliveries as any}
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 justify-start md:justify-end h-8 shrink-0">
                            <Button
                                onClick={handleSearch}
                                className="bg-[#f26522] hover:bg-[#d94f12] text-xs font-semibold text-white px-4 rounded h-8 border border-[#f26522] transition-colors duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <Sliders className="h-3.5 w-3.5" />
                                Search
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleReset}
                                className="h-8 px-4 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer"
                                title="Reset filters"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Reset
                            </Button>

                            {/* Export with 3 options: Excel, CSV, PDF */}
                            <div className="relative" ref={exportRef}>
                                <Button
                                    type="button"
                                    onClick={() => setExportOpen((prev) => !prev)}
                                    className="bg-[#f26522] hover:bg-[#d94f12] text-white text-xs font-semibold rounded h-8 px-3 border border-[#f26522] transition-colors duration-200 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                                    title="Export Options"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    <span>Export</span>
                                    <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${exportOpen ? 'rotate-180' : ''}`} />
                                </Button>

                                {exportOpen && (
                                    <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                                        <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                                            Export Format
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleExport('excel')}
                                            disabled={!!isExporting}
                                            className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                            <div className="p-1.5 rounded bg-emerald-100 text-emerald-700">
                                                <FileSpreadsheet className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <div className="font-semibold text-slate-800">Excel</div>
                                                <div className="text-[10px] text-slate-400">Spreadsheet (.xls)</div>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleExport('csv')}
                                            disabled={!!isExporting}
                                            className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-sky-50 hover:text-sky-700 flex items-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                            <div className="p-1.5 rounded bg-sky-100 text-sky-700">
                                                <FileText className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <div className="font-semibold text-slate-800">CSV</div>
                                                <div className="text-[10px] text-slate-400">Comma-separated (.csv)</div>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleExport('pdf')}
                                            disabled={!!isExporting}
                                            className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                            <div className="p-1.5 rounded bg-rose-100 text-rose-700">
                                                <FileDown className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <div className="font-semibold text-slate-800">PDF</div>
                                                <div className="text-[10px] text-slate-400">Printable Document (.pdf)</div>
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <CustomTable
                    data={deliveries}
                    columns={columns}
                    keyExtractor={(d) => d.id}
                    emptyStateText="No deliveries found"
                    className="flex-1"
                />

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-auto pt-4 px-6 shrink-0">
                        <p className="text-sm text-muted-foreground">
                            Showing {deliveries.length} of {total} deliveries
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >
                                Previous
                            </Button>
                            <span className="flex items-center px-3 text-sm">
                                Page {page} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </PageContainer>
    );
}
