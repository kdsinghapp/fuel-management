'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Download, AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

export default function FuelLevelsPage() {
    const router = useRouter();
    const selectedClient = useClientStore((state) => state.selectedClient);
    const [levels, setLevels] = useState<FuelLevel[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const getPastDateStr = (daysAgo: number) => {
        const d = new Date();
        d.setDate(d.getDate() - daysAgo);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const [startDate, setStartDate] = useState(getPastDateStr(6));
    const [endDate, setEndDate] = useState(getPastDateStr(0));
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
    }, [router, selectedClient, startDate, endDate]);

    const loadData = async () => {
        try {
            setLoading(true);
            const response = await fuelLevelService.getFuelLevels({
                pageSize: 10000,
                startDate: startDate || undefined,
                endDate: endDate || undefined
            });

            const sortedData = [...response.data].sort((a, b) => {
                const timeA = new Date(`${a.date}T${a.time}Z`).getTime();
                const timeB = new Date(`${b.date}T${b.time}Z`).getTime();
                return timeA - timeB;
            });

            setLevels(sortedData);
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
            level.status.toLowerCase().includes(search);

        let matchesDateRange = true;
        if (startDate) {
            matchesDateRange = matchesDateRange && level.date >= startDate;
        }
        if (endDate) {
            matchesDateRange = matchesDateRange && level.date <= endDate;
        }

        return matchesSearch && matchesDateRange;
    });

    const getChartData = () => {
        if (startDate || endDate) {
            return filteredLevels;
        }
        if (filteredLevels.length === 0) {
            return [];
        }
        const latestDateStr = filteredLevels[filteredLevels.length - 1].date;
        const latestDate = new Date(latestDateStr);
        const sevenDaysAgo = new Date(latestDate);
        sevenDaysAgo.setDate(latestDate.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

        return filteredLevels.filter(level => level.date >= sevenDaysAgoStr);
    };

    const chartData = getChartData();

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
        exportToCSV(`fuel_levels_${startDate}_to_${endDate}.csv`, headers, rows);
    };

    const formatDateTick = (tickItem: string) => {
        try {
            const dateStr = tickItem.split('T')[0];
            const parts = dateStr.split('-');
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${months[month]} ${String(day).padStart(2, '0')}`;
        } catch {
            return tickItem;
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
            {/* Header section matching bootstrap layout exactly */}
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="font-semibold text-zinc-900 text-2xl leading-tight m-0">Fuel Levels</h2>
                    <span className="text-sm text-zinc-500 mt-1 inline-block">Monitor tank levels and historical data</span>
                </div>
                <Button
                    onClick={loadData}
                    className="bg-[#3c8e75] hover:bg-[#317561] text-sm font-semibold rounded px-4 py-2 flex items-center gap-1.5 transition-colors duration-200 border-0 h-10 shadow-sm"
                >
                    <RefreshCw className="h-4 w-4 mr-0.5" />
                    Refresh
                </Button>
            </div>

            {/* Filters & Chart Card wrapper */}
            <div className="bg-white border border-slate-200 shadow-sm rounded p-4 mb-4">
                {/* Filter bar container matching the bootstrap grid structure */}
                <div className="mb-4 py-2.5 px-4 bg-[#eefcf2] border border-[#d6f2e1] rounded w-full">
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

                            {/* FROM Date Selector */}
                            <div className="w-full sm:w-[150px] flex flex-col gap-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">From date</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="rounded border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] h-8 shadow-xs w-full"
                                />
                            </div>

                            {/* TO Date Selector */}
                            <div className="w-full sm:w-[150px] flex flex-col gap-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">To date</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="rounded border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] h-8 shadow-xs w-full"
                                />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 justify-start md:justify-end h-8 shrink-0">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setSearch('');
                                    setStartDate(getPastDateStr(6));
                                    setEndDate(getPastDateStr(0));
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

                {/* Area Chart matching the bootstrap design */}
                <div style={{ height: '380px' }} className="w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                            <defs>
                                <linearGradient id="colorFuel" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3498db" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#3498db" stopOpacity={0.0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="#f0f0f0" />
                            <XAxis
                                dataKey="createdAt"
                                tickFormatter={formatDateTick}
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

                                        return (
                                            <div className="bg-white border border-[#3498db]/40 p-3 rounded shadow-lg text-xs">
                                                <p className="font-bold text-slate-800">{formatDateTick(date)} {time}</p>
                                                <div className="flex items-center gap-1.5 mt-1 font-semibold text-[#2980b9]">
                                                    <span>🛢️ {formatNumber(val)} L</span>
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
                                stroke="#3498db"
                                strokeWidth={2.5}
                                fillOpacity={1}
                                fill="url(#colorFuel)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </PageContainer>
    );
}
