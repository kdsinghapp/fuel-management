// src/app/(dashboard)/fuel-issues/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Download, AlertTriangle, RefreshCw, RotateCcw, Sliders, ChevronDown, FileSpreadsheet, FileText, FileDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageContainer } from '@/components/layout/PageContainer';
import { fuelIssueService } from '@/services/fuelIssueService';
import { vehicleService } from '@/services/vehicleService';
import { authService } from '@/lib/auth';
import { formatFuel, exportToCSV, exportToExcel, exportToPDF } from '@/lib/utils';
import { useClientStore } from '@/services/api';
import { DateRangePicker, DateRange, getDateRangeFromPreset } from '@/components/common/DateRangePicker';

export default function FuelIssuesPage() {
    const router = useRouter();
    const selectedClient = useClientStore((state) => state.selectedClient);
    const [allIssues, setAllIssues] = useState<any[]>([]);
    const [issues, setIssues] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter states
    const [search, setSearch] = useState('');
    const [selectedVehicle, setSelectedVehicle] = useState('');
    const [dateRange, setDateRange] = useState<DateRange>(getDateRangeFromPreset('30days'));

    const [vehicles, setVehicles] = useState<string[]>([]);
    const [total, setTotal] = useState(0);
    const [exportOpen, setExportOpen] = useState(false);
    const [isExporting, setIsExporting] = useState<string | null>(null);
    const exportRef = useRef<HTMLDivElement>(null);

    // Pagination & Dynamic display size state
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(8);
    const [pageSizeMode, setPageSizeMode] = useState<'auto' | number>('auto');
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
                setExportOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (pageSizeMode !== 'auto') {
            setPageSize(pageSizeMode);
            return;
        }

        const computeRows = () => {
            if (tableContainerRef.current) {
                const containerHeight = tableContainerRef.current.clientHeight;
                const headerHeight = 34; // <thead> height
                const scrollbarHeight = 10; // horizontal scrollbar allowance
                const rowHeight = 33; // precise <tr> height with py-1.5
                const availableForRows = containerHeight - headerHeight - scrollbarHeight;
                if (availableForRows > 0) {
                    const exactFit = Math.max(5, Math.floor(availableForRows / rowHeight));
                    setPageSize(exactFit);
                }
            } else if (typeof window !== 'undefined') {
                const overhead = 280;
                const availableHeight = window.innerHeight - overhead;
                const rowHeight = 33;
                const calculatedRows = Math.max(5, Math.floor(availableHeight / rowHeight));
                setPageSize(calculatedRows);
            }
        };

        computeRows();

        let observer: ResizeObserver | null = null;
        if (typeof ResizeObserver !== 'undefined' && tableContainerRef.current) {
            observer = new ResizeObserver(() => {
                computeRows();
            });
            observer.observe(tableContainerRef.current);
        }

        window.addEventListener('resize', computeRows);
        return () => {
            if (observer) observer.disconnect();
            window.removeEventListener('resize', computeRows);
        };
    }, [pageSizeMode]);

    // Initial load and reload on page/client change
    useEffect(() => {
        const checkAuth = async () => {
            const isAuthenticated = await authService.isAuthenticated();
            if (!isAuthenticated) {
                router.push('/login');
                return;
            }
            loadData();
            loadVehicles();
        };
        checkAuth();
    }, [router, page, pageSize, selectedClient, dateRange.startDate, dateRange.endDate, dateRange.preset]);

    const loadData = async (
        overrideSearch?: string,
        overrideVehicle?: string,
        overrideDateRange?: DateRange
    ) => {
        try {
            setLoading(true);
            const currentRange = overrideDateRange || dateRange;
            const currentSearch = overrideSearch !== undefined ? overrideSearch : search;
            const currentVehicle = overrideVehicle !== undefined ? overrideVehicle : selectedVehicle;

            const response = await fuelIssueService.getFuelIssues({
                page,
                pageSize,
                search: currentSearch || undefined,
                vehicleId: currentVehicle || undefined,
                startDate: currentRange.startDate || undefined,
                endDate: currentRange.endDate || undefined,
            });
            setIssues(response.data);
            setTotal(response.total);
            setTotalPages(response.totalPages);

            if (allIssues.length === 0 || currentRange.preset === 'all') {
                const allResponse = await fuelIssueService.getFuelIssues({
                    page: 1,
                    pageSize: 100000,
                    startDate: undefined,
                    endDate: undefined,
                });
                setAllIssues(allResponse.data);
            }

            setError(null);
        } catch (err) {
            setError('Failed to load transactions');
        } finally {
            setLoading(false);
            useClientStore.getState().setClientLoading(false);
        }
    };

    const loadVehicles = async () => {
        try {
            const response = await vehicleService.getVehicles({ pageSize: 100 });
            setVehicles(response.data.map(v => v.vehicleId));
        } catch {
            // Ignore
        }
    };

    const handleSearch = () => {
        setPage(1);
        loadData();
    };

    const handleReset = () => {
        const defaultRange = getDateRangeFromPreset('30days');
        setSearch('');
        setSelectedVehicle('');
        setDateRange(defaultRange);
        setPage(1);
        loadData('', '', defaultRange);
    };

    const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
        try {
            setIsExporting(format);
            const response = await fuelIssueService.getFuelIssues({
                page: 1,
                pageSize: 100000,
                search: search || undefined,
                vehicleId: selectedVehicle || undefined,
                startDate: dateRange.startDate || undefined,
                endDate: dateRange.endDate || undefined,
            });
            const exportIssues = response.data;
            if (exportIssues.length === 0) {
                setExportOpen(false);
                return;
            }
            const headers = ['Date', 'Time', 'ID', 'Vehicle Req', 'Fleet Id', 'Site', 'Litres', 'Pump', 'Odo Meter', 'DEM/Status'];
            const rows = exportIssues.map(issue => [
                issue.date,
                issue.time,
                issue.transactionId,
                issue.vehicleId,
                issue.fleetId,
                issue.siteId || issue.depot,
                issue.fuelQuantity,
                issue.pump,
                issue.odometer,
                issue.dem || issue.status
            ]);
            const dateLabel = dateRange.preset || 'custom';

            if (format === 'csv') {
                exportToCSV(`fuel_issues_${dateLabel}.csv`, headers, rows);
            } else if (format === 'excel') {
                exportToExcel(`fuel_issues_${dateLabel}.xlsx`, headers, rows, 'Fuel Issues');
            } else if (format === 'pdf') {
                exportToPDF('Fuel Issues Report', headers, rows);
            }
        } catch (err) {
            console.error('Failed to export fuel issues:', err);
        } finally {
            setIsExporting(null);
            setExportOpen(false);
        }
    };

    if (loading && issues.length === 0) {
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
        <PageContainer className="p-2 sm:p-3 space-y-0 h-full flex flex-col overflow-hidden">
            <Card className="rounded border border-slate-200 shadow-sm p-2.5 mb-0 flex-1 flex flex-col overflow-hidden">
                <CardContent className="p-0 flex-1 flex flex-col overflow-hidden justify-between">
                    {/* Filter bar container matching single horizontal row structure */}
                    <div className="mb-2 py-1.5 px-3 bg-[#eefcf2] border border-[#d6f2e1] rounded w-full shrink-0 relative z-20 overflow-visible">
                        <div className="flex flex-wrap items-end justify-between gap-2.5">
                            {/* Left Filters Group - All in 1 line */}
                            <div className="flex flex-wrap items-end gap-2.5 shrink-0">
                                {/* Search Input Group */}
                                <div className="flex flex-col gap-1 w-[200px] sm:w-[240px] shrink-0">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Search transactions</label>
                                    <div className="flex h-8">
                                        <span className="flex items-center px-2.5 border border-r-0 border-slate-200 bg-slate-50 rounded-l text-slate-400">
                                            <Search className="h-3 w-3" />
                                        </span>
                                        <input
                                            type="text"
                                            placeholder="Search by ID, vehicle..."
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                            className="w-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] h-8 rounded-r rounded-l-none"
                                        />
                                    </div>
                                </div>

                                {/* Date Range Selector */}
                                <div className="w-[130px] shrink-0">
                                    <DateRangePicker
                                        value={dateRange}
                                        onChange={(newRange) => {
                                            setDateRange(newRange);
                                            setPage(1);
                                        }}
                                        allRecords={allIssues}
                                    />
                                </div>
                            </div>

                            {/* Right Action Buttons Group */}
                            <div className="flex items-end gap-1.5 shrink-0">
                                <Button
                                    onClick={handleSearch}
                                    className="bg-[#f26522] hover:bg-[#d94f12] text-xs font-semibold text-white px-3.5 rounded h-8 border border-[#f26522] transition-colors duration-200 flex items-center justify-center gap-1.5"
                                >
                                    <Sliders className="h-3.5 w-3.5" />
                                    Search
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleReset}
                                    className="h-8 px-3.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center justify-center gap-1.5 text-xs font-semibold"
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
                                                    <div className="text-[10px] text-slate-400">Spreadsheet (.xlsx)</div>
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

                    <div ref={tableContainerRef} className="overflow-x-auto overflow-y-auto border border-slate-200 shadow-xs rounded mb-1.5 flex-1 min-h-0">
                        <table className="w-full text-sm border-collapse whitespace-nowrap">
                            <thead className="sticky top-0 z-10 shadow-xs">
                                <tr>
                                    <th className="bg-[#f26522] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">Date / Time</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">ID</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">Vehicle Req</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">Fleet Id</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">Site</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">Litres</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">Pump</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">Odo Meter</th>
                                    <th className="bg-[#222222] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">DEM</th>
                                </tr>
                            </thead>
                            <tbody>
                                {issues.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="p-8 text-center text-slate-400 bg-slate-50">
                                            No transactions found
                                        </td>
                                    </tr>
                                ) : (
                                    issues.map((issue, idx) => (
                                        <tr key={issue.id || issue.transactionId || idx} className="border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors odd:bg-white even:bg-[#fff9f5]">
                                            <td className="py-1.5 px-3 text-slate-600 align-middle">{issue.date} {issue.time}</td>
                                            <td className="py-1.5 px-3 font-bold text-slate-900 align-middle">{issue.transactionId}</td>
                                            <td className="py-1.5 px-3 font-bold text-green-600 align-middle">{issue.vehicleId}</td>
                                            <td className="py-1.5 px-3 text-slate-600 align-middle">{issue.fleetId || '—'}</td>
                                            <td className="py-1.5 px-3 text-slate-600 align-middle">{issue.siteId || issue.depot || '—'}</td>
                                            <td className="py-1.5 px-3 font-bold text-slate-900 align-middle">{formatFuel(issue.fuelQuantity)}</td>
                                            <td className="py-1.5 px-3 text-slate-600 align-middle">{issue.pump || '—'}</td>
                                            <td className="py-1.5 px-3 text-slate-600 align-middle">{issue.odometer || '—'}</td>
                                            <td className="py-1.5 px-3 align-middle">
                                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${issue.status === 'Matched'
                                                    ? 'bg-[#eefcf2] border-[#d6f2e1] text-[#138024]'
                                                    : 'bg-[#fff6f0] border-[#ffe3d1] text-[#f26522]'
                                                    }`}>
                                                    <span className={`h-1.5 w-1.5 rounded-full bg-current`} />
                                                    {issue.dem || issue.status || '—'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {total > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 pb-0.5 px-2 shrink-0 border-t border-slate-100">
                            <div className="flex items-center gap-4 flex-wrap">
                                <p className="text-xs sm:text-sm text-slate-500">
                                    Showing <span className="font-semibold text-slate-800">{issues.length}</span> of <span className="font-semibold text-slate-800">{total}</span> transactions
                                </p>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <span>Rows:</span>
                                    <select
                                        value={pageSizeMode}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === 'auto') {
                                                setPageSizeMode('auto');
                                            } else {
                                                setPageSizeMode(Number(val));
                                            }
                                            setPage(1);
                                        }}
                                        className="border border-slate-200 rounded px-2 py-1 bg-white text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#f26522] cursor-pointer"
                                    >
                                        <option value="auto">Auto ({pageSizeMode === 'auto' ? pageSize : 'Fit screen'})</option>
                                        <option value={10}>10</option>
                                        <option value={15}>15</option>
                                        <option value={20}>20</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="h-8 px-3 text-xs"
                                >
                                    Previous
                                </Button>
                                <span className="flex items-center px-2 text-xs font-medium text-slate-600">
                                    Page {page} of {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages || totalPages === 0}
                                    className="h-8 px-3 text-xs"
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </PageContainer>
    );
}
