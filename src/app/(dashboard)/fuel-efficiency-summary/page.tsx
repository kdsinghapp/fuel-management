// src/app/(dashboard)/fuel-efficiency-summary/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Download, AlertTriangle, RotateCcw, Sliders } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageContainer } from '@/components/layout/PageContainer';
import { fuelIssueService } from '@/services/fuelIssueService';
import { authService } from '@/lib/auth';
import { formatNumber, exportToCSV } from '@/lib/utils';
import { useClientStore } from '@/services/api';
import { DateRangePicker, DateRange, getDateRangeFromPreset } from '@/components/common/DateRangePicker';

interface VehicleSummary {
    id: string;
    vehicleDetail: string;
    litres: number;
    date: string;
    distance: number;
    consumption: number;
}

export default function FuelEfficiencySummaryPage() {
    const router = useRouter();
    const selectedClient = useClientStore((state) => state.selectedClient);
    const [allRecords, setAllRecords] = useState<any[]>([]);
    const [data, setData] = useState<VehicleSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [dateRange, setDateRange] = useState<DateRange>(getDateRangeFromPreset('30days'));

    // Pagination & Dynamic display size state
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(8);
    const [pageSizeMode, setPageSizeMode] = useState<'auto' | number>('auto');

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
    }, [pageSizeMode, loading]);

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
    }, [router, selectedClient, dateRange.startDate, dateRange.endDate, dateRange.preset]);

    const loadData = async () => {
        try {
            setLoading(true);
            const response = await fuelIssueService.getFuelIssues({
                page: 1,
                pageSize: 100000,
                startDate: dateRange.startDate || undefined,
                endDate: dateRange.endDate || undefined,
            });

            if (!response.data || response.data.length === 0) {
                setData([]);
                setError(null);
                return;
            }

            // Group transactions by Vehicle Detail
            const vehicleMap = new Map<string, {
                vehicleDetail: string;
                litres: number;
                lastDate: string;
                odometers: { odo: number; date: string; time: string }[];
            }>();

            response.data.forEach((tx: any) => {
                const vehicleDetail = (tx.driverAttendant || tx.vehicleId || tx.fleetId || 'Unknown Vehicle').toString().trim();
                if (!vehicleDetail) return;

                const key = vehicleDetail.toLowerCase();
                const qty = Number(tx.fuelQuantity) || 0;
                const odo = Number(tx.odometer) || 0;
                const date = tx.date || '';
                const time = tx.time || '';

                if (!vehicleMap.has(key)) {
                    vehicleMap.set(key, {
                        vehicleDetail,
                        litres: 0,
                        lastDate: date,
                        odometers: []
                    });
                }

                const entry = vehicleMap.get(key)!;
                entry.litres += qty;
                if (date && (!entry.lastDate || date > entry.lastDate)) {
                    entry.lastDate = date;
                }
                if (odo > 0) {
                    entry.odometers.push({ odo, date, time });
                }
            });

            const computed: VehicleSummary[] = [];

            vehicleMap.forEach((val, key) => {
                let distance = 0;
                if (val.odometers.length >= 2) {
                    val.odometers.sort((a, b) => {
                        const timeA = new Date(`${a.date}T${a.time || '00:00:00'}`).getTime();
                        const timeB = new Date(`${b.date}T${b.time || '00:00:00'}`).getTime();
                        return timeA - timeB;
                    });

                    const minOdo = val.odometers[0].odo;
                    const maxOdo = val.odometers[val.odometers.length - 1].odo;
                    if (maxOdo > minOdo) {
                        distance = maxOdo - minOdo;
                    }
                }

                const litres = Number(val.litres.toFixed(2));
                const consumption = distance > 0 && litres > 0 ? Number((distance / litres).toFixed(2)) : 0;

                computed.push({
                    id: key,
                    vehicleDetail: val.vehicleDetail,
                    litres,
                    date: val.lastDate,
                    distance: Number(distance.toFixed(2)),
                    consumption
                });
            });

            // Sort alphabetically by vehicle detail
            computed.sort((a, b) => a.vehicleDetail.localeCompare(b.vehicleDetail));

            setData(computed);

            if (allRecords.length === 0 || dateRange.preset === 'all') {
                setAllRecords(response.data);
            }
            setError(null);
        } catch (err) {
            console.error(err);
            setError('Failed to compute fuel efficiency metrics from live data.');
        } finally {
            setLoading(false);
            useClientStore.getState().setClientLoading(false);
        }
    };

    const handleSearch = () => {
        setSearch(searchInput);
        setPage(1);
    };

    const handleReset = () => {
        const defaultRange = getDateRangeFromPreset('30days');
        setSearchInput('');
        setSearch('');
        setDateRange(defaultRange);
        setPage(1);
    };

    const filteredData = data.filter(item => {
        const query = search.toLowerCase();
        return item.vehicleDetail.toLowerCase().includes(query) || (item.date && item.date.toLowerCase().includes(query));
    });

    const totalLtrs = filteredData.reduce((sum, item) => sum + (Number(item.litres) || 0), 0);

    // Pagination calculations
    const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
    const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize);

    const handleExport = () => {
        if (filteredData.length === 0) return;
        const headers = ['Vehicle Detail', 'Litres', 'Date', 'Distance', 'Consumption (km/l)'];
        const rows = filteredData.map(item => [
            item.vehicleDetail,
            item.litres,
            item.date || '-',
            item.distance > 0 ? item.distance : '-',
            item.consumption > 0 ? item.consumption.toFixed(2) : '0.00'
        ]);
        exportToCSV('fuel_efficiency_summary.csv', headers, rows);
    };

    if (loading) {
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
                    <Button onClick={loadData}>Try Again</Button>
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
                                {/* Total Ltrs Field */}
                                <div className="flex flex-col gap-1 shrink-0">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Total Ltrs</label>
                                    <div className="flex items-center px-3 border border-slate-200 bg-white rounded h-8 shadow-xs">
                                        <span className="text-xs font-bold text-[#138024] whitespace-nowrap">
                                            {formatNumber(totalLtrs, 2)} L
                                        </span>
                                    </div>
                                </div>

                                {/* Search Input Group */}
                                <div className="flex flex-col gap-1 w-[200px] sm:w-[250px] shrink-0">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Search vehicles</label>
                                    <div className="flex h-8">
                                        <span className="flex items-center px-2.5 border border-r-0 border-slate-200 bg-slate-50 rounded-l text-slate-400">
                                            <Search className="h-3 w-3" />
                                        </span>
                                        <input
                                            type="text"
                                            placeholder="Search by vehicle..."
                                            value={searchInput}
                                            onChange={(e) => setSearchInput(e.target.value)}
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
                                        allRecords={allRecords as any}
                                    />
                                </div>
                            </div>

                            {/* Right Action Buttons Group */}
                            <div className="flex items-end gap-1.5 shrink-0">
                                {/* Search Button */}
                                <Button
                                    onClick={handleSearch}
                                    className="bg-[#f26522] hover:bg-[#d94f12] text-xs font-semibold text-white px-3.5 rounded h-8 border border-[#f26522] transition-colors duration-200 flex items-center justify-center gap-1.5"
                                >
                                    <Sliders className="h-3.5 w-3.5" />
                                    Search
                                </Button>

                                {/* Reset Button */}
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

                                {/* Export Button */}
                                <Button
                                    onClick={handleExport}
                                    className="bg-[#f26522] hover:bg-[#d94f12] text-white text-xs font-semibold rounded h-8 px-3.5 border border-[#f26522] transition-colors duration-200 flex items-center justify-center gap-1.5"
                                    title="Export"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    Export
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div ref={tableContainerRef} className="overflow-x-auto overflow-y-auto border border-slate-200 shadow-xs rounded mb-1.5 flex-1 min-h-0">
                        <table className="w-full text-sm border-collapse whitespace-nowrap">
                            <thead className="sticky top-0 z-10 shadow-xs">
                                <tr>
                                    <th className="bg-[#f26522] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">Vehicle Detail</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">Litres</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">Date</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">Distance</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">Consumption (km/l)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-400 bg-slate-50">
                                            No vehicle data found
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedData.map((item, idx) => (
                                        <tr key={item.id || idx} className="border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors odd:bg-white even:bg-[#fff9f5]">
                                            <td className="py-1.5 px-3 font-semibold text-slate-800 align-middle">{item.vehicleDetail}</td>
                                            <td className="py-1.5 px-3 font-semibold text-[#138024] align-middle">{formatNumber(item.litres, 2)}</td>
                                            <td className="py-1.5 px-3 text-slate-600 align-middle">{item.date || '—'}</td>
                                            <td className="py-1.5 px-3 text-slate-600 align-middle">{item.distance > 0 ? formatNumber(item.distance, 2) : '—'}</td>
                                            <td className="py-1.5 px-3 font-bold text-slate-900 align-middle">
                                                {item.consumption > 0 ? item.consumption.toFixed(2) : '0.00'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {filteredData.length > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 pb-0.5 px-2 shrink-0 border-t border-slate-100">
                            <div className="flex items-center gap-4 flex-wrap">
                                <p className="text-xs sm:text-sm text-slate-500">
                                    Showing <span className="font-semibold text-slate-800">{paginatedData.length}</span> of <span className="font-semibold text-slate-800">{filteredData.length}</span> vehicles
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
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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


