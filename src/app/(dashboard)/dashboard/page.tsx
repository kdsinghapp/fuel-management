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
    PieChart as PieChartIcon,
    Receipt,
    RefreshCw,
    CheckCircle2,
    Package,
    Inbox,
    FileSpreadsheet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { fuelLevelService } from '@/services/fuelLevelService';
import { deliveryService } from '@/services/deliveryService';
import { fuelIssueService } from '@/services/fuelIssueService';
import { vehicleService } from '@/services/vehicleService';
import { reconciliationService } from '@/services/reconciliationService';
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

interface ConsumptionCategory {
    name: string;
    value: number;
    color: string;
}

export default function DashboardPage() {
    const router = useRouter();
    const selectedClient = useClientStore((state) => state.selectedClient);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // KPI stats state - initialized dynamically to 0
    const [currentStock, setCurrentStock] = useState<number>(0);
    const [stockCapacityPct, setStockCapacityPct] = useState<number>(0);
    const [recentDeliveriesSum, setRecentDeliveriesSum] = useState<number>(0);
    const [deliveriesCount, setDeliveriesCount] = useState<number>(0);
    const [totalTransactions, setTotalTransactions] = useState<number>(0);
    const [todayIssuedLitres, setTodayIssuedLitres] = useState<number>(0);
    const [issuedLabel, setIssuedLabel] = useState<string>('Issued Today');
    const [activeVehiclesCount, setActiveVehiclesCount] = useState<number>(0);
    const [operationalPct, setOperationalPct] = useState<number>(0);

    // Visualizations state - dynamic
    const [trendData, setTrendData] = useState<TrendPoint[]>([]);
    const [consumptionSpread, setConsumptionSpread] = useState<ConsumptionCategory[]>([]);

    // Table rows state - dynamic
    const [recentDeliveries, setRecentDeliveries] = useState<DeliveryRow[]>([]);
    const [latestTransactions, setLatestTransactions] = useState<TransactionRow[]>([]);

    const getPastDateStr = (daysAgo: number) => {
        const d = new Date();
        d.setDate(d.getDate() - daysAgo);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const loadDashboardData = useCallback(async () => {
        try {
            const todayStr = getPastDateStr(0);
            const sevenDaysAgoStr = getPastDateStr(6);
            const thirtyDaysAgoStr = getPastDateStr(30);
            const ninetyDaysAgoStr = getPastDateStr(90);

            // Fetch live API data in parallel
            const [levelsRes, deliveriesRes, transactionsRes, vehiclesRes] = await Promise.allSettled([
                fuelLevelService.getFuelLevels({ pageSize: 10000, startDate: sevenDaysAgoStr, endDate: todayStr }),
                deliveryService.getDeliveries({ pageSize: 500, startDate: ninetyDaysAgoStr, endDate: todayStr }),
                fuelIssueService.getFuelIssues({ pageSize: 5000 }),
                vehicleService.getVehicles({ pageSize: 500 }),
            ]);

            // Process Tank Levels
            if (levelsRes.status === 'fulfilled' && levelsRes.value.data.length > 0) {
                const levels = levelsRes.value.data;

                // Sort descending to get the latest reading for current stock KPI
                const descLevels = [...levels].sort((a, b) => {
                    const timeA = new Date(`${a.date}T${a.time}Z`).getTime();
                    const timeB = new Date(`${b.date}T${b.time}Z`).getTime();
                    return timeB - timeA;
                });

                const latestLevel = descLevels[0];
                if (latestLevel) {
                    setCurrentStock(latestLevel.fuelLevel || 0);
                    setStockCapacityPct(
                        latestLevel.percentage !== undefined
                            ? latestLevel.percentage
                            : Math.round(((latestLevel.fuelLevel || 0) / 20000) * 100)
                    );
                }

                // Group by date to get daily end-of-day reading for a clean 7-day trend
                const dailyMap = new Map<string, { date: string; level: number; time: string }>();

                levels.forEach((l) => {
                    const existing = dailyMap.get(l.date);
                    if (!existing || (l.time && l.time >= (existing.time || ''))) {
                        dailyMap.set(l.date, {
                            date: l.date,
                            level: l.fuelLevel,
                            time: l.time || '',
                        });
                    }
                });

                const points: TrendPoint[] = Array.from(dailyMap.values())
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((l) => {
                        let formattedDate = l.date;
                        try {
                            const parts = l.date.split('-');
                            const month = parseInt(parts[1], 10) - 1;
                            const day = parseInt(parts[2], 10);
                            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            formattedDate = `${months[month]} ${String(day).padStart(2, '0')}`;
                        } catch {
                            formattedDate = l.date;
                        }

                        return {
                            date: l.date,
                            level: l.level,
                            formattedDate,
                        };
                    });

                setTrendData(points);
            } else {
                setCurrentStock(0);
                setStockCapacityPct(0);
                setTrendData([]);
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
            } else {
                setRecentDeliveriesSum(0);
                setDeliveriesCount(0);
                setRecentDeliveries([]);
            }

            // Process Transactions
            if (transactionsRes.status === 'fulfilled' && transactionsRes.value.data.length > 0) {
                const txs = transactionsRes.value.data;
                setTotalTransactions(transactionsRes.value.total || txs.length);

                // Today's total issued litres or latest date total
                const todayTxs = txs.filter((t: any) => t.date === todayStr);
                const todaySum = todayTxs.reduce((acc: number, t: any) => acc + (t.fuelQuantity || 0), 0);
                if (todaySum > 0) {
                    setTodayIssuedLitres(Number(todaySum.toFixed(1)));
                    setIssuedLabel('Issued Today');
                } else if (txs.length > 0) {
                    const latestDate = txs[0].date;
                    const latestDayTxs = txs.filter((t: any) => t.date === latestDate);
                    const latestSum = latestDayTxs.reduce((acc: number, t: any) => acc + (t.fuelQuantity || 0), 0);
                    setTodayIssuedLitres(Number(latestSum.toFixed(1)));
                    setIssuedLabel(`Issued on ${latestDate}`);
                } else {
                    setTodayIssuedLitres(0);
                    setIssuedLabel('Issued Today');
                }

                // Latest 5 Transactions
                const topTxs: TransactionRow[] = txs.slice(0, 5).map((t: any) => {
                    const formattedDateTime = t.date && t.time
                        ? `${t.date.slice(5)} ${t.time.slice(0, 5)}`
                        : t.createdAt
                            ? `${t.createdAt.slice(5, 10)} ${t.createdAt.slice(11, 16)}`
                            : `${t.date || ''} ${t.time || ''}`.trim() || '—';

                    let method = t.dem || 'Standard';

                    return {
                        id: t.id || t.transactionId || String(Math.random()),
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
                    if (!v || v === 'unknown' || v === 'unassigned') {
                        unassignedL += q;
                    } else if (
                        v.includes('truck') ||
                        v.includes('bus') ||
                        v.includes('heavy') ||
                        v.includes('ht') ||
                        v.includes('semi')
                    ) {
                        heavyL += q;
                    } else {
                        lightL += q;
                    }
                });

                const totalVol = lightL + heavyL + unassignedL;
                if (totalVol > 0) {
                    setConsumptionSpread([
                        { name: 'Light Vehicles', value: Math.round((lightL / totalVol) * 100), color: '#1b5e20' },
                        { name: 'Heavy Fleet', value: Math.round((heavyL / totalVol) * 100), color: '#f26522' },
                        { name: 'Unassigned', value: Math.round((unassignedL / totalVol) * 100), color: '#1e3a5f' },
                    ]);
                } else {
                    setConsumptionSpread([]);
                }
            } else {
                setTotalTransactions(0);
                setTodayIssuedLitres(0);
                setLatestTransactions([]);
                setConsumptionSpread([]);
            }

            // Process Vehicles
            if (vehiclesRes.status === 'fulfilled' && vehiclesRes.value.data.length > 0) {
                const total = vehiclesRes.value.total || vehiclesRes.value.data.length;
                setActiveVehiclesCount(total);
                setOperationalPct(total > 0 ? 100 : 0);
            } else {
                setActiveVehiclesCount(0);
                setOperationalPct(0);
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

    const [isExportingCombined, setIsExportingCombined] = useState(false);

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadDashboardData();
    };

    const handleExportCombined = async () => {
        try {
            setIsExportingCombined(true);
            const clientName = selectedClient?.name || 'Client';
            const generatedDate = new Date().toLocaleString();

            const [levelsRes, deliveriesRes, issuesRes, reconRes] = await Promise.all([
                fuelLevelService.getFuelLevels({ pageSize: 100000 }),
                deliveryService.getDeliveries({ pageSize: 100000 }),
                fuelIssueService.getFuelIssues({ pageSize: 100000 }),
                reconciliationService.getReconciliationRecords({ pageSize: 100000 })
            ]);

            const levels = levelsRes.data || [];
            const deliveries = deliveriesRes.data || [];
            const issues = issuesRes.data || [];
            const reconRecords = reconRes.data || [];

            // Group vehicle fuel efficiency
            const vehicleMap = new Map<string, { ltrs: number; count: number; minOdo: number; maxOdo: number }>();
            issues.forEach(item => {
                const desc = item.vehicleId || item.driverAttendant || 'Unknown Vehicle';
                const current = vehicleMap.get(desc) || { ltrs: 0, count: 0, minOdo: Infinity, maxOdo: -Infinity };
                current.ltrs += Number(item.fuelQuantity) || 0;
                current.count += 1;
                const odo = Number(item.odometer) || 0;
                if (odo > 0) {
                    current.minOdo = Math.min(current.minOdo, odo);
                    current.maxOdo = Math.max(current.maxOdo, odo);
                }
                vehicleMap.set(desc, current);
            });

            const efficiencyList = Array.from(vehicleMap.entries()).map(([desc, v]) => {
                const distance = v.maxOdo > v.minOdo && v.minOdo !== Infinity ? v.maxOdo - v.minOdo : 0;
                const kmPerLtr = v.ltrs > 0 && distance > 0 ? distance / v.ltrs : 0;
                const ltrsPer100Km = distance > 0 ? (v.ltrs / distance) * 100 : 0;
                return {
                    description: desc,
                    ltrs: v.ltrs,
                    transactions: v.count,
                    distance,
                    kmPerLtr,
                    ltrsPer100Km,
                };
            });

            const csvLines: string[] = [];

            // 1. MASTER REPORT HEADER
            csvLines.push('"COMBINED MASTER FUEL MANAGEMENT & RECONCILIATION AUDIT REPORT"');
            csvLines.push(`"Client:","${clientName}"`);
            csvLines.push(`"Generated Timestamp:","${generatedDate}"`);
            csvLines.push('');

            // 2. DAILY RECONCILIATION AUDIT LOG
            csvLines.push('"SECTION 1: DAILY RECONCILIATION AUDIT LEDGER"');
            const reconHeaders = [
                'Date',
                'Opening Balance / Dip (L)',
                'Deliveries / Receipts (+L)',
                'Fuel Issues / Dispensed (-L)',
                'Expected Closing (L)',
                'Actual Closing Dip (L)',
                'Variance (L)',
                'Variance %',
                'Status'
            ];
            csvLines.push(reconHeaders.map(h => `"${h}"`).join(','));
            reconRecords.forEach(record => {
                const vPercent = record.expectedClosing > 0 ? (record.variance / record.expectedClosing) * 100 : 0;
                csvLines.push([
                    record.date,
                    record.openingBalance,
                    record.deliveries,
                    record.fuelIssues,
                    record.expectedClosing,
                    record.actualClosing,
                    record.variance,
                    `${vPercent.toFixed(1)}%`,
                    record.status
                ].map(val => typeof val === 'string' ? `"${val}"` : val).join(','));
            });
            csvLines.push('');

            // 3. FUEL DELIVERIES LOG
            csvLines.push('"SECTION 2: FUEL DELIVERIES AUDIT LOG"');
            const deliveryHeaders = ['Delivery ID', 'Date', 'Time', 'Quantity (L)', 'Supplier', 'Status'];
            csvLines.push(deliveryHeaders.map(h => `"${h}"`).join(','));
            deliveries.forEach(d => {
                csvLines.push([
                    d.deliveryId,
                    d.date,
                    d.time,
                    d.quantity,
                    d.supplier || '',
                    d.status || ''
                ].map(val => typeof val === 'string' ? `"${val}"` : val).join(','));
            });
            csvLines.push('');

            // 4. FUEL ISSUES / TRANSACTIONS LOG
            csvLines.push('"SECTION 3: FUEL ISSUES & DISPENSING TRANSACTIONS"');
            const issueHeaders = ['Date', 'Time', 'Transaction ID', 'Vehicle Req', 'Fleet Id', 'Vehicle Detail', 'Site', 'Litres (L)', 'Pump', 'Odo Meter', 'Hour Meter', 'DEM / Status'];
            csvLines.push(issueHeaders.map(h => `"${h}"`).join(','));
            issues.forEach(issue => {
                csvLines.push([
                    issue.date,
                    issue.time,
                    issue.transactionId,
                    issue.vehicleId,
                    issue.fleetId,
                    issue.driverAttendant,
                    issue.depot,
                    issue.fuelQuantity,
                    issue.pump,
                    issue.odometer,
                    issue.engineHours,
                    issue.dem || issue.status
                ].map(val => typeof val === 'string' ? `"${val}"` : val).join(','));
            });
            csvLines.push('');

            // 5. FUEL TANK LEVELS HISTORY
            csvLines.push('"SECTION 4: FUEL TANK LEVEL DIP READINGS"');
            const levelHeaders = ['Date', 'Time', 'Tank No', 'Fuel Level (L)', 'Water Level (mm)', 'Volume %', 'Temperature (°C)'];
            csvLines.push(levelHeaders.map(h => `"${h}"`).join(','));
            levels.forEach(lvl => {
                csvLines.push([
                    lvl.date,
                    lvl.time,
                    lvl.tankId,
                    lvl.fuelLevel,
                    lvl.waterLevel ?? '',
                    lvl.volumePercentage ? `${lvl.volumePercentage}%` : '',
                    lvl.temperature ?? ''
                ].map(val => typeof val === 'string' ? `"${val}"` : val).join(','));
            });
            csvLines.push('');

            // 6. VEHICLE FUEL EFFICIENCY SUMMARY
            csvLines.push('"SECTION 5: VEHICLE FUEL EFFICIENCY & USAGE SUMMARY"');
            const effHeaders = ['Vehicle Description', 'Total Litres (L)', 'Transactions Count', 'Total Distance (km)', 'Fuel Economy (km/L)', 'Consumption Rate (L/100km)'];
            csvLines.push(effHeaders.map(h => `"${h}"`).join(','));
            efficiencyList.forEach(eff => {
                csvLines.push([
                    eff.description,
                    eff.ltrs.toFixed(1),
                    eff.transactions,
                    eff.distance.toFixed(0),
                    eff.kmPerLtr > 0 ? eff.kmPerLtr.toFixed(2) : 'N/A',
                    eff.ltrsPer100Km > 0 ? eff.ltrsPer100Km.toFixed(2) : 'N/A'
                ].map(val => typeof val === 'string' ? `"${val}"` : val).join(','));
            });

            const csvContent = csvLines.join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `master_combined_fuel_report_${selectedClient?.name ? selectedClient.name.toLowerCase().replace(/\\s+/g, '_') : 'client'}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Failed to export combined master report:', err);
        } finally {
            setIsExportingCombined(false);
        }
    };

    if (loading) {
        return (
            <PageContainer className="bg-[#fcfaf7] min-h-[calc(100vh-4.5rem)]">
                <div className="flex h-[60vh] items-center justify-center">
                    <LoadingSpinner size="lg" />
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer className="bg-[#fcfaf7] min-h-[calc(100vh-4.5rem)] space-y-6 pb-12">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-zinc-900 tracking-tight">
                        System Overview
                    </h1>
                    <p className="text-xs text-zinc-500 font-medium mt-0.5">
                        Real-time stats across tank levels, deliveries, efficiency, and active transactions
                    </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
                    <Button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="bg-[#2d7a5b] hover:bg-[#236349] text-white text-xs font-semibold px-3.5 py-2 rounded flex items-center gap-2 shadow-xs transition-all shrink-0 cursor-pointer"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        <span>Refresh Data</span>
                    </Button>
                    <Button
                        onClick={handleExportCombined}
                        disabled={isExportingCombined}
                        className="bg-[#f26522] hover:bg-[#d45316] text-white text-xs font-semibold px-4 py-2 rounded flex items-center gap-2 shadow-xs transition-all shrink-0 cursor-pointer"
                        title="Download complete Master Combined Report across Fuel Levels, Deliveries, Transactions, Efficiency, and Reconciliation"
                    >
                        {isExportingCombined ? (
                            <>
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                <span>Generating Master Report...</span>
                            </>
                        ) : (
                            <>
                                <FileSpreadsheet className="h-3.5 w-3.5" />
                                <span>Export Report</span>
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* 4 KPI Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Current Fuel Stock */}
                <div className="relative bg-white rounded-tl-[28px] rounded-tr-[6px] rounded-bl-[6px] rounded-br-[28px] p-5 border border-zinc-200/80 shadow-xs flex flex-col justify-between overflow-hidden hover:shadow-md transition-all duration-200">
                    <div className="absolute top-0 left-0 w-24 h-1 bg-[#f26522] rounded-r-full" />
                    <div className="flex items-start justify-between gap-3 pt-1">
                        <div className="space-y-0.5">
                            <span className="text-xs font-semibold text-zinc-500">
                                Current Fuel Stock
                            </span>
                            <div className="text-2xl font-bold text-zinc-900 tracking-tight">
                                {formatNumber(currentStock)} L
                            </div>
                        </div>
                        <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/50">
                            <Fuel className="h-6 w-6" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-xs font-bold text-emerald-600">
                        <span className="text-sm leading-none">↑</span>
                        <span>Tank Capacity {stockCapacityPct}%</span>
                    </div>
                </div>

                {/* Card 2: Recent Deliveries (30D) */}
                <div className="relative bg-white rounded-tl-[28px] rounded-tr-[6px] rounded-bl-[6px] rounded-br-[28px] p-5 border border-zinc-200/80 shadow-xs flex flex-col justify-between overflow-hidden hover:shadow-md transition-all duration-200">
                    <div className="absolute top-0 left-0 w-24 h-1 bg-[#f26522] rounded-r-full" />
                    <div className="flex items-start justify-between gap-3 pt-1">
                        <div className="space-y-0.5">
                            <span className="text-xs font-semibold text-zinc-500">
                                Recent Deliveries
                            </span>
                            <div className="text-2xl font-bold text-zinc-900 tracking-tight">
                                {formatNumber(recentDeliveriesSum)} L
                            </div>
                        </div>
                        <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/50">
                            <Package className="h-6 w-6 text-emerald-600" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                        <Truck className="h-3.5 w-3.5 text-zinc-400" />
                        <span>{deliveriesCount} Deliveries Processed</span>
                    </div>
                </div>

                {/* Card 3: Total Transactions */}
                <div className="relative bg-white rounded-tl-[28px] rounded-tr-[6px] rounded-bl-[6px] rounded-br-[28px] p-5 border border-zinc-200/80 shadow-xs flex flex-col justify-between overflow-hidden hover:shadow-md transition-all duration-200">
                    <div className="absolute top-0 left-0 w-24 h-1 bg-[#f26522] rounded-r-full" />
                    <div className="flex items-start justify-between gap-3 pt-1">
                        <div className="space-y-0.5">
                            <span className="text-xs font-semibold text-zinc-500">
                                Total Transactions
                            </span>
                            <div className="text-2xl font-bold text-zinc-900 tracking-tight">
                                {formatNumber(totalTransactions)}
                            </div>
                        </div>
                        <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0 border border-amber-100/50">
                            <Receipt className="h-6 w-6 text-amber-500" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-xs font-bold text-rose-600">
                        <span className="text-sm leading-none">↓</span>
                        <span>{todayIssuedLitres} L {issuedLabel}</span>
                    </div>
                </div>

                {/* Card 4: Active Fleet Vehicles */}
                <div className="relative bg-white rounded-tl-[28px] rounded-tr-[6px] rounded-bl-[6px] rounded-br-[28px] p-5 border border-zinc-200/80 shadow-xs flex flex-col justify-between overflow-hidden hover:shadow-md transition-all duration-200">
                    <div className="absolute top-0 left-0 w-24 h-1 bg-[#f26522] rounded-r-full" />
                    <div className="flex items-start justify-between gap-3 pt-1">
                        <div className="space-y-0.5">
                            <span className="text-xs font-semibold text-zinc-500">
                                Active Fleet Vehicles
                            </span>
                            <div className="text-2xl font-bold text-zinc-900 tracking-tight">
                                {activeVehiclesCount}
                            </div>
                        </div>
                        <div className="h-12 w-12 rounded-2xl bg-cyan-50 text-cyan-500 flex items-center justify-center shrink-0 border border-cyan-100/50">
                            <Car className="h-6 w-6 text-cyan-500" />
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
                <div className="lg:col-span-2 bg-white rounded-xl p-5 md:p-6 border border-zinc-200/90 shadow-xs">
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

                    <div className="h-72 w-full">
                        {trendData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                        ) : (
                            <div className="h-full w-full flex flex-col items-center justify-center text-zinc-400 gap-2">
                                <Inbox className="h-8 w-8 text-zinc-300" />
                                <span className="text-xs font-medium">No fuel level history recorded</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Chart 2: Fleet Consumption Spread (1 Col) */}
                <div className="bg-white rounded-xl p-5 md:p-6 border border-zinc-200/90 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between pb-4 border-b border-zinc-100 mb-2">
                        <div className="flex items-center gap-2">
                            <PieChartIcon className="h-4 w-4 text-emerald-600" />
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

                    <div className="h-56 w-full flex items-center justify-center relative">
                        {consumptionSpread.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={consumptionSpread}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={80}
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
                        ) : (
                            <div className="flex flex-col items-center justify-center text-zinc-400 gap-2">
                                <Inbox className="h-7 w-7 text-zinc-300" />
                                <span className="text-xs font-medium">No consumption records available</span>
                            </div>
                        )}
                    </div>

                    {/* Bottom Custom Legend (matching screenshot row 1 & row 2 centered) */}
                    {consumptionSpread.length > 0 ? (
                        <div className="flex flex-col items-center justify-center gap-1.5 text-xs font-semibold text-zinc-600 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5">
                                    <span className="h-2.5 w-6 rounded-xs bg-[#1b5e20]" />
                                    <span>Light Vehicles</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="h-2.5 w-6 rounded-xs bg-[#f26522]" />
                                    <span>Heavy Fleet</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="h-2.5 w-6 rounded-xs bg-[#1e3a5f]" />
                                <span>Unassigned</span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-[11px] text-zinc-400 pt-2">
                            Awaiting transaction data
                        </div>
                    )}
                </div>
            </div>

            {/* Tables Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Table 1: Recent Deliveries */}
                <div className="bg-white rounded-xl border border-zinc-200/90 shadow-xs overflow-hidden">
                    <div className="flex items-center justify-between p-5 pb-4">
                        <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-amber-500" />
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
                                <tr className="bg-[#18181b] text-white text-[11px] font-bold tracking-wider">
                                    <th className="py-3 px-5">Delivery ID</th>
                                    <th className="py-3 px-5">Date</th>
                                    <th className="py-3 px-5 text-right">Quantity</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 text-xs">
                                {recentDeliveries.length > 0 ? (
                                    recentDeliveries.map((del, idx) => (
                                        <tr
                                            key={del.id}
                                            className={`transition-colors hover:bg-zinc-50 ${idx % 2 === 1 ? 'bg-[#fff9f5]' : 'bg-white'
                                                }`}
                                        >
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
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="py-8 text-center text-zinc-400 font-medium">
                                            No deliveries found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Table 2: Latest Transactions */}
                <div className="bg-white rounded-xl border border-zinc-200/90 shadow-xs overflow-hidden">
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
                                <tr className="bg-[#18181b] text-white text-[11px] font-bold tracking-wider">
                                    <th className="py-3 px-5">Date/Time</th>
                                    <th className="py-3 px-5">Vehicle</th>
                                    <th className="py-3 px-5">Litres</th>
                                    <th className="py-3 px-5 text-center">DEM Method</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 text-xs">
                                {latestTransactions.length > 0 ? (
                                    latestTransactions.map((tx, idx) => {
                                        const isST500 =
                                            tx.demMethod.toLowerCase().includes('st500') ||
                                            tx.demMethod.toLowerCase().includes('key');
                                        const isDriverTag =
                                            tx.demMethod.toLowerCase().includes('driver') ||
                                            tx.demMethod.toLowerCase().includes('tag');
                                        const isUnknown = tx.vehicle.toLowerCase() === 'unknown';

                                        return (
                                            <tr
                                                key={tx.id}
                                                className={`transition-colors hover:bg-zinc-50 ${idx % 2 === 1 ? 'bg-[#fff9f5]' : 'bg-white'
                                                    }`}
                                            >
                                                <td className="py-3 px-5 text-zinc-600 font-medium whitespace-nowrap">
                                                    {tx.dateTime}
                                                </td>
                                                <td className="py-3 px-5">
                                                    {isUnknown ? (
                                                        <span className="font-semibold text-zinc-400">Unknown</span>
                                                    ) : (
                                                        <Link
                                                            href={`/fuel-issues?search=${encodeURIComponent(tx.vehicle)}`}
                                                            className="font-bold text-blue-600 hover:text-blue-800 hover:underline"
                                                        >
                                                            {tx.vehicle}
                                                        </Link>
                                                    )}
                                                </td>
                                                <td className="py-3 px-5 font-bold text-zinc-900">
                                                    {formatNumber(tx.litres)} L
                                                </td>
                                                <td className="py-3 px-5 text-center">
                                                    <span
                                                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${isST500
                                                            ? 'bg-[#fff6f0] text-[#f26522] border-[#ffe3d1]'
                                                            : isDriverTag
                                                                ? 'bg-[#eefcf2] text-[#138024] border-[#d6f2e1]'
                                                                : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                                                            }`}
                                                    >
                                                        {tx.demMethod}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-zinc-400 font-medium">
                                            No transactions recorded
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </PageContainer>
    );
}
