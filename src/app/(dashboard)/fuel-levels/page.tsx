'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Download, AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageContainer } from '@/components/layout/PageContainer';
import { fuelLevelService } from '@/services/fuelLevelService';
import { authService } from '@/lib/auth';
import { formatNumber, exportToCSV } from '@/lib/utils';
import { FuelLevel } from '@/types/fuel';
import { useClientStore } from '@/services/api';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

import { DateRangePicker, DateRange, getDateRangeFromPreset } from '@/components/common/DateRangePicker';

export default function FuelLevelsPage() {
    const router = useRouter();
    const selectedClient = useClientStore((state) => state.selectedClient);
    const [allLevels, setAllLevels] = useState<FuelLevel[]>([]);
    const [levels, setLevels] = useState<FuelLevel[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<DateRange>(getDateRangeFromPreset('30days'));
    const [search, setSearch] = useState('');

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

            // Fetch broad datasets (e.g., past 90 days or all data) to calculate counts correctly
            const response = await fuelLevelService.getFuelLevels({
                pageSize: 10000,
                startDate: dateRange.startDate || undefined,
                endDate: dateRange.endDate || undefined
            });

            const sortedData = [...response.data].sort((a, b) => {
                const timeA = new Date(`${a.date}T${a.time}Z`).getTime();
                const timeB = new Date(`${b.date}T${b.time}Z`).getTime();
                return timeA - timeB;
            });

            setLevels(sortedData);

            // If we don't have allLevels populated yet or full refresh requested, fetch complete set for badges
            if (allLevels.length === 0 || dateRange.preset === 'all') {
                if (dateRange.preset === 'all') {
                    setAllLevels(sortedData);
                } else {
                    const allResponse = await fuelLevelService.getFuelLevels({
                        pageSize: 10000,
                        startDate: undefined,
                        endDate: undefined
                    });
                    setAllLevels(allResponse.data);
                }
            } else {
                setAllLevels(prev => prev.length > 0 ? prev : sortedData);
            }

            setError(null);
        } catch (err) {
            setError('Failed to load fuel level data');
        } finally {
            setLoading(false);
            useClientStore.getState().setClientLoading(false);
        }
    };

    const filteredLevels = levels.filter((level) => {
        const matchesSearch =
            level.date.includes(search) ||
            level.time.includes(search) ||
            level.status.toLowerCase().includes(search);

        let matchesDate = true;
        if (dateRange.startDate && level.date < dateRange.startDate) matchesDate = false;
        if (dateRange.endDate && level.date > dateRange.endDate) matchesDate = false;

        return matchesSearch && matchesDate;
    });

    const chartData = filteredLevels;

    const handleExport = () => {
        if (filteredLevels.length === 0) return;
        const headers = ['Date', 'Time', 'Fuel Level (L)', 'Percentage (%)', 'Status'];
        const rows = filteredLevels.map(level => [
            level.date,
            level.time,
            level.fuelLevel,
            `${level.percentage}%`,
            level.status
        ]);
        exportToCSV(`fuel_levels_${dateRange.preset}.csv`, headers, rows);
    };

    const formatTimeTick = (timeStr: string) => {
        if (!timeStr) return '';
        try {
            // If timeStr is HH:MM:SS, format to HH:MM
            const parts = timeStr.split(':');
            if (parts.length >= 2) {
                return `${parts[0]}:${parts[1]}`;
            }
            return timeStr;
        } catch {
            return timeStr;
        }
    };

    if (loading) {
        return (
            <PageContainer>
                <div className="flex h-[50vh] items-center justify-center">
                    <LoadingSpinner size="lg" />
                </div>
            </PageContainer>
        );
    }

    if (error) {
        return (
            <PageContainer>
                <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
                    <AlertTriangle className="h-12 w-12 text-destructive" />
                    <p className="text-lg text-muted-foreground">{error}</p>
                    <Button onClick={loadData}>Try Again</Button>
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer>

            {/* Filters & Chart Card wrapper */}
            <div className="bg-white border border-slate-200 shadow-sm rounded p-4 mb-4 overflow-visible">
                {/* Filter bar container matching the bootstrap grid structure */}
                <div className="mb-4 py-2.5 px-4 bg-[#eefcf2] border border-[#d6f2e1] rounded w-full overflow-visible relative z-20">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
                        <div className="flex flex-col sm:flex-row flex-1 gap-3 items-stretch sm:items-end">
                            {/* Search Input Group */}
                            <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Search transactions</label>
                                <div className="flex h-8">
                                    <span className="flex items-center px-3 border border-r-0 border-slate-200 bg-slate-50 rounded-l text-slate-400">
                                        <Search className="h-3 w-3" />
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="Search by date or status..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="flex-1 border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] h-8 rounded-r rounded-l-none"
                                    />
                                </div>
                            </div>

                            {/* Date Range Selector */}
                            <DateRangePicker
                                value={dateRange}
                                onChange={(newRange) => setDateRange(newRange)}
                                allRecords={allLevels}
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 justify-start md:justify-end h-8 shrink-0">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setSearch('');
                                    setDateRange(getDateRangeFromPreset('30days'));
                                }}
                                className="h-8 px-4 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center justify-center gap-1.5 text-xs font-semibold"
                                title="Reset filters"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Reset
                            </Button>
                            <Button
                                onClick={handleExport}
                                className="bg-[#f26522] hover:bg-[#d94f12] text-white text-xs font-semibold rounded h-8 px-4 border border-[#f26522] transition-colors duration-200 flex items-center justify-center gap-1.5"
                                title="Export fuel levels"
                            >
                                <Download className="h-3.5 w-3.5" />
                                Export
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Area Chart matching the dashboard orange theme */}
                <div style={{ height: '380px' }} className="w-full">
                    {chartData.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-1">
                            <p className="font-semibold text-slate-600">No fuel level records found for {dateRange.label}</p>
                            <p className="text-xs text-slate-400">Please choose another date range or reset filters</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                                <defs>
                                    <linearGradient id="colorFuel" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f26522" stopOpacity={0.45} />
                                        <stop offset="95%" stopColor="#f26522" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="#f0f0f0" />
                                <XAxis
                                    dataKey="time"
                                    tickFormatter={formatTimeTick}
                                    tick={{ fill: '#666', fontSize: 11 }}
                                    axisLine={{ stroke: '#ccc' }}
                                />
                                <YAxis
                                    tickFormatter={(val) => formatNumber(val)}
                                    tick={{ fill: '#666', fontSize: 11 }}
                                    axisLine={{ stroke: '#ccc' }}
                                />
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const val = Number(payload[0].value);
                                            const date = payload[0].payload.date;
                                            const time = payload[0].payload.time;
                                            const pct = payload[0].payload.percentage;

                                            return (
                                                <div className="bg-white border border-[#f26522]/30 p-3 rounded-lg shadow-lg text-xs">
                                                    <p className="font-bold text-slate-800">{date} • {time}</p>
                                                    <div className="flex items-center gap-1.5 mt-1.5 font-bold text-[#f26522]">
                                                        <span>🛢️ {formatNumber(val)} L</span>
                                                        {pct !== undefined && <span className="text-slate-500 font-normal">({pct}%)</span>}
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="fuelLevel"
                                    stroke="#f26522"
                                    strokeWidth={2.5}
                                    fillOpacity={1}
                                    fill="url(#colorFuel)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </PageContainer>
    );
}
