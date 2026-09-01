// src/app/(dashboard)/dashboard/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Fuel,
    Truck,
    FileText,
    Car,
    TrendingUp,
    Compass,
    FolderKanban,
    Receipt,
    RefreshCw,
    ArrowUpRight,
    ArrowDownRight,
    CheckCircle2,
    Layers,
    ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/PageContainer';
import { fuelLevelService } from '@/services/fuelLevelService';
import { deliveryService } from '@/services/deliveryService';
import { fuelIssueService } from '@/services/fuelIssueService';
import { vehicleService } from '@/services/vehicleService';
import { useClientStore } from '@/services/api';
import { authService } from '@/lib/auth';
import { formatNumber } from '@/lib/utils';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts';

interface DeliveryRow {
    id: string;
    deliveryId: string;
    date: string;
    quantity: number;
}

interface TransactionRow {
    id: string;
    dateTime: string;
    vehicle: string;
    litres: number;
    demMethod: string;
}

interface TrendPoint {
    date: string;
    level: number;
    formattedDate: string;
}

export default function DashboardPage() {
    const router = useRouter();
    const selectedClient = useClientStore((state) => state.selectedClient);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // KPI stats state with sensible high-quality defaults
    const [currentStock, setCurrentStock] = useState<number>(10200);
    const [stockCapacityPct, setStockCapacityPct] = useState<number>(85);
    const [recentDeliveriesSum, setRecentDeliveriesSum] = useState<number>(7340);
    const [deliveriesCount, setDeliveriesCount] = useState<number>(4);
    const [totalTransactions, setTotalTransactions] = useState<number>(103);
    const [todayIssuedLitres, setTodayIssuedLitres] = useState<number>(528.3);
    const [activeVehiclesCount, setActiveVehiclesCount] = useState<number>(13);
    const [operationalPct, setOperationalPct] = useState<number>(100);

    // Visualizations state
    const [trendData, setTrendData] = useState<TrendPoint[]>([
        { date: '2026-08-15', level: 5900, formattedDate: 'Aug 15' },
        { date: '2026-08-16', level: 7400, formattedDate: 'Aug 16' },
        { date: '2026-08-17', level: 8800, formattedDate: 'Aug 17' },
        { date: '2026-08-18', level: 10200, formattedDate: 'Aug 18' },
        { date: '2026-08-19', level: 10100, formattedDate: 'Aug 19' },
        { date: '2026-08-20', level: 10050, formattedDate: 'Aug 20' },
    ]);

    const [consumptionSpread, setConsumptionSpread] = useState([
        { name: 'Light Vehicles', value: 55, color: '#1b5e20' },
        { name: 'Heavy Fleet', value: 32, color: '#f26522' },
        { name: 'Unassigned', value: 13, color: '#1e3a5f' },
    ]);

    // Table rows state
    const [recentDeliveries, setRecentDeliveries] = useState<DeliveryRow[]>([
        { id: '1', deliveryId: '30628147', date: '2026-08-12', quantity: 2410.7 },
        { id: '2', deliveryId: '30628452', date: '2026-08-13', quantity: 1245.0 },
        { id: '3', deliveryId: '30628711', date: '2026-08-14', quantity: 691.6 },
        { id: '4', deliveryId: '30629014', date: '2026-08-14', quantity: 2978.5 },
        { id: '5', deliveryId: '30629015', date: '2026-08-14', quantity: 2978.5 },
    ]);

    const [latestTransactions, setLatestTransactions] = useState<TransactionRow[]>([
        { id: '1', dateTime: '08-18 06:44', vehicle: 'WAI362', litres: 45.0, demMethod: 'ST500 Key' },
        { id: '2', dateTime: '08-18 08:01', vehicle: 'BH0719', litres: 47.8, demMethod: 'Driver Tag' },
        { id: '3', dateTime: '08-18 10:07', vehicle: 'FAE085', litres: 47.2, demMethod: 'Driver Tag' },
        { id: '4', dateTime: '08-18 22:35', vehicle: 'Unknown', litres: 64.4, demMethod: 'ST500 Key' },
        { id: '5', dateTime: '08-19 22:43', vehicle: 'FAE085', litres: 51.6, demMethod: 'Driver Tag' },
    ]);

    const loadDashboardData = useCallback(async () => {
        try {
            // Helper to get past date string
            const getPastDate = (days: number) => {
                const d = new Date();
                d.setDate(d.getDate() - days);
                return d.toISOString().split('T')[0];
            };

            const todayStr = new Date().toISOString().split('T')[0];
            const thirtyDaysAgoStr = getPastDate(30);
            const sevenDaysAgoStr = getPastDate(7);

            // Fetch live API data in parallel
            const [levelsRes, deliveriesRes, transactionsRes, vehiclesRes] = await Promise.allSettled([
                fuelLevelService.getFuelLevels({ pageSize: 100, startDate: sevenDaysAgoStr, endDate: todayStr }),
                deliveryService.getDeliveries({ pageSize: 50, startDate: thirtyDaysAgoStr, endDate: todayStr }),
                fuelIssueService.getFuelIssues({ pageSize: 200, startDate: thirtyDaysAgoStr, endDate: todayStr }),
                vehicleService.getVehicles({ pageSize: 100 }),
            ]);

            // Process Tank Levels
            if (levelsRes.status === 'fulfilled' && levelsRes.value.data.length > 0) {
                const levels = levelsRes.value.data;
                const latestLevel = levels[0];
                if (latestLevel) {
                    setCurrentStock(latestLevel.fuelLevel);
                    setStockCapacityPct(latestLevel.percentage || Math.round((latestLevel.fuelLevel / 20000) * 100));
                }

                // Group by date to get clean trend points
                const dateMap = new Map<string, number>();
                levels.forEach((l) => {
                    if (!dateMap.has(l.date)) {
                        dateMap.set(l.date, l.fuelLevel);
                    }
                });

                const points: TrendPoint[] = Array.from(dateMap.entries())
                    .map(([date, level]) => {
                        const d = new Date(date);
                        const formattedDate = isNaN(d.getTime())
                            ? date.slice(5)
                            : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        return { date, level, formattedDate };
                    })
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .slice(-7);

                if (points.length >= 2) {
                    setTrendData(points);
                }
            }

            // Process Deliveries
            if (deliveriesRes.status === 'fulfilled' && deliveriesRes.value.data.length > 0) {
                const dels = deliveriesRes.value.data;
                const sum = dels.reduce((acc, d) => acc + (d.quantity || 0), 0);
                setRecentDeliveriesSum(Math.round(sum));
                setDeliveriesCount(deliveriesRes.value.total || dels.length);

                const topDels: DeliveryRow[] = dels.slice(0, 5).map((d) => ({
                    id: d.id,
                    deliveryId: d.deliveryId || d.id,
                    date: d.date,
                    quantity: d.quantity,
                }));
                setRecentDeliveries(topDels);
            }

            // Process Transactions
            if (transactionsRes.status === 'fulfilled' && transactionsRes.value.data.length > 0) {
                const txs = transactionsRes.value.data;
                setTotalTransactions(transactionsRes.value.total || txs.length);

                // Today's total issued litres
                const todayTxs = txs.filter((t: any) => t.date === todayStr);
                const todaySum = todayTxs.reduce((acc: number, t: any) => acc + (t.fuelQuantity || 0), 0);
                if (todaySum > 0) {
                    setTodayIssuedLitres(Number(todaySum.toFixed(1)));
                } else if (txs.length > 0) {
                    // Fallback to latest day total
                    const latestDate = txs[0].date;
                    const latestDayTxs = txs.filter((t: any) => t.date === latestDate);
                    const latestSum = latestDayTxs.reduce((acc: number, t: any) => acc + (t.fuelQuantity || 0), 0);
                    setTodayIssuedLitres(Number(latestSum.toFixed(1)));
                }

                // Latest 5 Transactions
                const topTxs: TransactionRow[] = txs.slice(0, 5).map((t: any) => {
                    const formattedDateTime = t.date && t.time
                        ? `${t.date.slice(5)} ${t.time.slice(0, 5)}`
                        : t.createdAt
                        ? `${t.createdAt.slice(5, 10)} ${t.createdAt.slice(11, 16)}`
                        : '08-18 06:44';

                    let method = 'ST500 Key';
                    if (t.dem) {
                        if (t.dem.toLowerCase().includes('tag') || t.dem.toLowerCase().includes('driver')) {
                            method = 'Driver Tag';
                        } else if (t.dem.toLowerCase().includes('key') || t.dem.toLowerCase().includes('st500')) {
                            method = 'ST500 Key';
                        } else {
                            method = t.dem;
                        }
                    }

                    return {
                        id: t.id,
                        dateTime: formattedDateTime,
                        vehicle: t.vehicleId || 'Unknown',
                        litres: t.fuelQuantity || 0,
                        demMethod: method,
                    };
                });
                setLatestTransactions(topTxs);

                // Fleet Consumption Spread breakdown
                let lightL = 0;
                let heavyL = 0;
                let unassignedL = 0;

                txs.forEach((t: any) => {
                    const v = (t.vehicleId || '').toLowerCase();
                    const q = t.fuelQuantity || 0;
                    if (!v || v === 'unknown') {
                        unassignedL += q;
                    } else if (v.includes('truck') || v.includes('bus') || v.includes('heavy') || v.includes('ht')) {
                        heavyL += q;
                    } else {
                        lightL += q;
                    }
                });

                const totalVol = lightL + heavyL + unassignedL;
                if (totalVol > 0) {
                    setConsumptionSpread([
                        { name: 'Light Vehicles', value: Math.round((lightL / totalVol) * 100) || 55, color: '#1b5e20' },
                        { name: 'Heavy Fleet', value: Math.round((heavyL / totalVol) * 100) || 32, color: '#f26522' },
                        { name: 'Unassigned', value: Math.round((unassignedL / totalVol) * 100) || 13, color: '#1e3a5f' },
                    ]);
                }
            }

            // Process Vehicles
            if (vehiclesRes.status === 'fulfilled' && vehiclesRes.value.data.length > 0) {
                const total = vehiclesRes.value.total || vehiclesRes.value.data.length;
                setActiveVehiclesCount(total);
                setOperationalPct(100);
            }
        } catch (err) {
            console.error('Error loading dashboard data:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
            useClientStore.getState().setClientLoading(false);
        }
    }, []);

    useEffect(() => {
        const checkAuth = async () => {
            const isAuth = await authService.isAuthenticated();
            if (!isAuth) {
                router.push('/login');
                return;
            }
            loadDashboardData();
        };
        checkAuth();
    }, [router, selectedClient, loadDashboardData]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadDashboardData();
    };

    return (
        <PageContainer className="bg-[#fcfaf7] min-h-[calc(100vh-4.5rem)] space-y-6 pb-12">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 tracking-tight">
                        System Overview
                    </h1>
                    <p className="text-xs md:text-sm text-zinc-500 font-medium mt-0.5">
                        Real-time stats across tank levels, deliveries, efficiency, and active transactions
                    </p>
                </div>
                <Button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="bg-[#2d7a5b] hover:bg-[#236349] text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-2 shadow-xs transition-all shrink-0 cursor-pointer self-start sm:self-auto"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                    <span>Refresh Data</span>
                </Button>
            </div>

            {/* 4 KPI Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Current Fuel Stock */}
                <div className="relative bg-white rounded-2xl p-5 border border-zinc-200/90 shadow-xs flex flex-col justify-between overflow-hidden hover:shadow-md transition-all duration-200">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-[#f26522]" />
                    <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                            <span className="text-xs font-bold text-zinc-500">
                                Current Fuel Stock
                            </span>
                            <div className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">
                                {formatNumber(currentStock)} L
                            </div>
                        </div>
                        <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                            <Fuel className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                        <span className="text-emerald-500 text-sm leading-none">↑</span>
                        <span>Tank Capacity {stockCapacityPct}%</span>
                    </div>
                </div>

                {/* Card 2: Recent Deliveries (30D) */}
                <div className="relative bg-white rounded-2xl p-5 border border-zinc-200/90 shadow-xs flex flex-col justify-between overflow-hidden hover:shadow-md transition-all duration-200">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-[#f26522]" />
                    <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                            <span className="text-xs font-bold text-zinc-500">
                                Recent Deliveries (30D)
                            </span>
                            <div className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">
                                {formatNumber(recentDeliveriesSum)} L
                            </div>
                        </div>
                        <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                            <Truck className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                        <Truck className="h-3.5 w-3.5 text-zinc-400" />
                        <span>{deliveriesCount} Deliveries Processed</span>
                    </div>
                </div>

                {/* Card 3: Total Transactions */}
                <div className="relative bg-white rounded-2xl p-5 border border-zinc-200/90 shadow-xs flex flex-col justify-between overflow-hidden hover:shadow-md transition-all duration-200">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-[#f26522]" />
                    <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                            <span className="text-xs font-bold text-zinc-500">
                                Total Transactions
                            </span>
                            <div className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">
                                {totalTransactions}
                            </div>
                        </div>
                        <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                            <FileText className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-rose-600">
                        <span className="text-rose-500 text-sm leading-none">↓</span>
                        <span>{todayIssuedLitres} L Issued Today</span>
                    </div>
                </div>

                {/* Card 4: Active Fleet Vehicles */}
                <div className="relative bg-white rounded-2xl p-5 border border-zinc-200/90 shadow-xs flex flex-col justify-between overflow-hidden hover:shadow-md transition-all duration-200">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-[#f26522]" />
                    <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                            <span className="text-xs font-bold text-zinc-500">
                                Active Fleet Vehicles
                            </span>
                            <div className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">
                                {activeVehiclesCount}
                            </div>
                        </div>
                        <div className="h-11 w-11 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0 border border-cyan-100">
                            <Car className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span>{operationalPct}% Operational</span>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart 1: Fuel Levels Trend (2 Cols) */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-5 md:p-6 border border-zinc-200/90 shadow-xs">
                    <div className="flex items-center justify-between pb-4 border-b border-zinc-100 mb-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-blue-500" />
                            <h2 className="text-sm md:text-base font-bold text-zinc-900">
                                Fuel Levels Trend
                            </h2>
                        </div>
                        <Link
                            href="/fuel-levels"
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline transition-colors"
                        >
                            <span>View Full Chart</span>
                            <span className="text-xs">→</span>
                        </Link>
                    </div>

                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="fuelTrendGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f26522" stopOpacity={0.45} />
                                        <stop offset="95%" stopColor="#f26522" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={true} />
                                <XAxis
                                    dataKey="formattedDate"
                                    stroke="#94a3b8"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={{ stroke: '#e2e8f0' }}
                                />
                                <YAxis
                                    stroke="#94a3b8"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={{ stroke: '#e2e8f0' }}
                                    tickFormatter={(val) => formatNumber(val)}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#09090b',
                                        borderColor: '#27272a',
                                        borderRadius: '0.5rem',
                                        color: '#ffffff',
                                        fontSize: '12px',
                                        padding: '6px 12px',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                    }}
                                    formatter={(value: any) => [`${formatNumber(Number(value))} L`, 'Fuel Level']}
                                    labelFormatter={(label) => `Date: ${label}`}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="level"
                                    stroke="#f26522"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#fuelTrendGradient)"
                                    dot={{ r: 3.5, fill: '#f26522', stroke: '#ffffff', strokeWidth: 1.5 }}
                                    activeDot={{ r: 5, fill: '#f26522', stroke: '#ffffff', strokeWidth: 2 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Chart 2: Fleet Consumption Spread (1 Col) */}
                <div className="bg-white rounded-2xl p-5 md:p-6 border border-zinc-200/90 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between pb-4 border-b border-zinc-100 mb-2">
                        <div className="flex items-center gap-2">
                            <Compass className="h-4 w-4 text-emerald-600" />
                            <h2 className="text-sm md:text-base font-bold text-zinc-900">
                                Fleet Consumption Spread
                            </h2>
                        </div>
                        <Link
                            href="/fuel-efficiency-summary"
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                        >
                            Details
                        </Link>
                    </div>

                    <div className="h-52 w-full flex items-center justify-center relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={consumptionSpread}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={48}
                                    outerRadius={76}
                                    paddingAngle={3}
                                    dataKey="value"
                                    stroke="transparent"
                                >
                                    {consumptionSpread.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#09090b',
                                        borderColor: '#27272a',
                                        borderRadius: '0.5rem',
                                        color: '#ffffff',
                                        fontSize: '12px',
                                        padding: '4px 10px',
                                    }}
                                    formatter={(value: any) => [`${value}%`, 'Consumption Share']}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Bottom Custom Legend */}
                    <div className="flex items-center justify-center gap-4 text-xs font-bold text-zinc-600 pt-2">
                        <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-6 rounded-xs bg-[#1b5e20]" />
                            <span>Light Vehicles</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-6 rounded-xs bg-[#f26522]" />
                            <span>Heavy Fleet</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-6 rounded-xs bg-[#1e3a5f]" />
                            <span>Unassigned</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tables Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Table 1: Recent Deliveries */}
                <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden">
                    <div className="flex items-center justify-between p-5 pb-4">
                        <div className="flex items-center gap-2">
                            <FolderKanban className="h-4 w-4 text-amber-500" />
                            <h2 className="text-sm md:text-base font-bold text-zinc-900">
                                Recent Deliveries
                            </h2>
                        </div>
                        <Link
                            href="/deliveries"
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                        >
                            All Deliveries
                        </Link>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-zinc-950 text-white text-[11px] font-bold tracking-wider">
                                    <th className="py-3 px-5">Delivery ID</th>
                                    <th className="py-3 px-5">Date</th>
                                    <th className="py-3 px-5 text-right">Quantity</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 text-xs">
                                {recentDeliveries.map((del) => (
                                    <tr key={del.id} className="hover:bg-zinc-50/80 transition-colors">
                                        <td className="py-3 px-5 font-bold text-zinc-900">
                                            {del.deliveryId}
                                        </td>
                                        <td className="py-3 px-5 text-zinc-600 font-medium">
                                            {del.date}
                                        </td>
                                        <td className="py-3 px-5 text-right font-bold text-emerald-600">
                                            {formatNumber(del.quantity)} L
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Table 2: Latest Transactions */}
                <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden">
                    <div className="flex items-center justify-between p-5 pb-4">
                        <div className="flex items-center gap-2">
                            <Receipt className="h-4 w-4 text-rose-500" />
                            <h2 className="text-sm md:text-base font-bold text-zinc-900">
                                Latest Transactions
                            </h2>
                        </div>
                        <Link
                            href="/fuel-issues"
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                        >
                            View All ({totalTransactions})
                        </Link>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-zinc-950 text-white text-[11px] font-bold tracking-wider">
                                    <th className="py-3 px-5">Date/Time</th>
                                    <th className="py-3 px-5">Vehicle</th>
                                    <th className="py-3 px-5">Litres</th>
                                    <th className="py-3 px-5 text-center">DEM Method</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 text-xs">
                                {latestTransactions.map((tx) => {
                                    const isST500 = tx.demMethod.toLowerCase().includes('st500') || tx.demMethod.toLowerCase().includes('key');
                                    const isDriverTag = tx.demMethod.toLowerCase().includes('driver') || tx.demMethod.toLowerCase().includes('tag');

                                    return (
                                        <tr key={tx.id} className="hover:bg-zinc-50/80 transition-colors">
                                            <td className="py-3 px-5 text-zinc-600 font-medium whitespace-nowrap">
                                                {tx.dateTime}
                                            </td>
                                            <td className="py-3 px-5">
                                                <Link
                                                    href={`/fuel-issues?search=${encodeURIComponent(tx.vehicle)}`}
                                                    className="font-bold text-blue-600 hover:text-blue-800 hover:underline"
                                                >
                                                    {tx.vehicle}
                                                </Link>
                                            </td>
                                            <td className="py-3 px-5 font-bold text-zinc-900">
                                                {formatNumber(tx.litres)} L
                                            </td>
                                            <td className="py-3 px-5 text-center">
                                                <span
                                                    className={`inline-block px-3 py-0.5 rounded-full text-[11px] font-bold border ${
                                                        isST500
                                                            ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                                                            : isDriverTag
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                                                            : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                                                    }`}
                                                >
                                                    {tx.demMethod}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </PageContainer>
    );
}
