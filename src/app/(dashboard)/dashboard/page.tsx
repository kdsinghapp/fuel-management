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
    BarChart,
    Bar,
    ReferenceLine,
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
    const [activeTab, setActiveTab] = useState('total-site');

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

    // Department breakdown & averages state - dynamic from API
    const [departmentBreakdown, setDepartmentBreakdown] = useState<{ dept: string; amount: string; rawLitres: number }[]>([]);
    const [tenDayAvg, setTenDayAvg] = useState<number>(0);
    const [thirtyDayAvg, setThirtyDayAvg] = useState<number>(0);

    // Usage Comparison stacked chart state
    const [usageComparisonData, setUsageComparisonData] = useState<{
        points: any[];
        departments: string[];
        totalVolume: number;
        avgPerDay: number;
        peakDay: number;
    }>({
        points: [],
        departments: [],
        totalVolume: 0,
        avgPerDay: 0,
        peakDay: 0,
    });

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
            const [levelsRes, deliveriesRes, transactionsRes, vehiclesRes, dbVehiclesRes] = await Promise.allSettled([
                fuelLevelService.getFuelLevels({ pageSize: 10000, startDate: sevenDaysAgoStr, endDate: todayStr }),
                deliveryService.getDeliveries({ pageSize: 500, startDate: ninetyDaysAgoStr, endDate: todayStr }),
                fuelIssueService.getFuelIssues({ pageSize: 5000 }),
                vehicleService.getVehicles({ pageSize: 500 }),
                fetch('/api/vehicles').then((res) => res.json()).catch(() => null),
            ]);

            // Build vehicle -> department lookup map from Azure SQL vehicle database
            const vehicleDeptMap = new Map<string, string>();
            const knownDepartmentsSet = new Set<string>();

            if (dbVehiclesRes.status === 'fulfilled' && dbVehiclesRes.value?.success && Array.isArray(dbVehiclesRes.value.data)) {
                dbVehiclesRes.value.data.forEach((v: any) => {
                    const dept = (v.ModeOfUse || (v.Department && v.Department !== selectedClient?.name ? v.Department : '') || '').trim();
                    if (dept && dept !== '-') {
                        knownDepartmentsSet.add(dept);
                    }
                    if (v.Asset) vehicleDeptMap.set(v.Asset.toUpperCase(), dept || 'No Department');
                    if (v.FleetId) vehicleDeptMap.set(v.FleetId.toUpperCase(), dept || 'No Department');
                });
            }

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

                // Group dynamic department breakdown from live transactions API & vehicle department lookup
                const deptSummaryMap = new Map<string, number>();

                // Seed with all known vehicle departments
                knownDepartmentsSet.forEach((dept) => {
                    deptSummaryMap.set(dept, 0);
                });

                txs.forEach((t: any) => {
                    const vId = (t.vehicleId || t.asset || '').trim().toUpperCase();
                    const matchedDept = vehicleDeptMap.get(vId);
                    const deptName = (matchedDept && matchedDept !== 'No Department'
                        ? matchedDept
                        : (t.department || t.modeOfUse || t.depot || 'No Department')).trim();

                    const qty = Number(t.fuelQuantity) || 0;
                    deptSummaryMap.set(deptName, (deptSummaryMap.get(deptName) || 0) + qty);
                });

                const deptList = Array.from(deptSummaryMap.entries()).map(([dept, totalLtrs]) => ({
                    dept,
                    amount: `${formatNumber(Math.round(totalLtrs))} L`,
                    rawLitres: totalLtrs,
                })).sort((a, b) => b.rawLitres - a.rawLitres);

                setDepartmentBreakdown(deptList);

                // Build dynamic Usage Comparison stacked bar chart data grouped by date & department
                const usageDateMap = new Map<string, Record<string, number>>();
                const allDeptsSet = new Set<string>();

                txs.forEach((t: any) => {
                    const dStr = t.date || '';
                    if (!dStr) return;
                    const vId = (t.vehicleId || t.asset || '').trim().toUpperCase();
                    const matchedDept = vehicleDeptMap.get(vId);
                    const deptName = (matchedDept && matchedDept !== 'No Department'
                        ? matchedDept
                        : (t.department || t.modeOfUse || t.depot || 'No Department')).trim();

                    const qty = Number(t.fuelQuantity) || 0;
                    allDeptsSet.add(deptName);

                    if (!usageDateMap.has(dStr)) {
                        usageDateMap.set(dStr, {});
                    }
                    const dayRec = usageDateMap.get(dStr)!;
                    dayRec[deptName] = (dayRec[deptName] || 0) + qty;
                });

                const sortedUsageDates = Array.from(usageDateMap.keys()).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
                const uniqueDepts = Array.from(allDeptsSet);

                const stackedChartPoints = sortedUsageDates.map((dStr) => {
                    const dayRec = usageDateMap.get(dStr)!;
                    let dayTotal = 0;
                    const point: any = { date: dStr };

                    try {
                        const parts = dStr.split('-');
                        const month = parseInt(parts[1], 10) - 1;
                        const day = parseInt(parts[2], 10);
                        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        point.formattedDate = `${day} ${months[month]}`;
                    } catch {
                        point.formattedDate = dStr;
                    }

                    uniqueDepts.forEach((dept) => {
                        const val = Number((dayRec[dept] || 0).toFixed(2));
                        point[dept] = val;
                        dayTotal += val;
                    });
                    point.total = Number(dayTotal.toFixed(2));
                    return point;
                });

                const totalUsageVol = stackedChartPoints.reduce((acc, p) => acc + p.total, 0);
                const avgUsagePerDay = stackedChartPoints.length > 0 ? Math.round(totalUsageVol / stackedChartPoints.length) : 0;
                const peakUsageDay = stackedChartPoints.reduce((max, p) => p.total > max ? p.total : max, 0);

                setUsageComparisonData({
                    points: stackedChartPoints,
                    departments: uniqueDepts,
                    totalVolume: Math.round(totalUsageVol),
                    avgPerDay: avgUsagePerDay,
                    peakDay: Math.round(peakUsageDay),
                });

                // Calculate 10-day & 30-day average daily usage dynamically
                const last10DaysStr = getPastDateStr(10);
                const last30DaysStr = getPastDateStr(30);

                const sum10 = txs
                    .filter((t: any) => t.date >= last10DaysStr)
                    .reduce((acc: number, t: any) => acc + (Number(t.fuelQuantity) || 0), 0);
                const sum30 = txs
                    .filter((t: any) => t.date >= last30DaysStr)
                    .reduce((acc: number, t: any) => acc + (Number(t.fuelQuantity) || 0), 0);

                setTenDayAvg(Math.round(sum10 / 10));
                setThirtyDayAvg(Math.round(sum30 / 30));

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
            const levelHeaders = ['Date', 'Time', 'Fuel Level (L)', 'Percentage (%)', 'Status'];
            csvLines.push(levelHeaders.map(h => `"${h}"`).join(','));
            levels.forEach(lvl => {
                csvLines.push([
                    lvl.date,
                    lvl.time,
                    lvl.fuelLevel,
                    lvl.percentage !== undefined ? `${lvl.percentage}%` : '',
                    lvl.status || ''
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
            {/* Header / Sub-Navigation Bar matching exact Fuel Master designs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1 pb-2 border-b border-zinc-200/60">
                {/* Horizontal Navigation Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                    {[
                        { id: 'total-site', label: 'Total Site', icon: Fuel, active: activeTab === 'total-site' },
                        { id: 'usage-comparison', label: 'Usage Comparison', icon: PieChartIcon, active: activeTab === 'usage-comparison' },
                        { id: 'usage-overview', label: 'Usage Overview', icon: FileText, active: activeTab === 'usage-overview' },
                        { id: 'tank-levels', label: 'Tank Levels', icon: Fuel, active: activeTab === 'tank-levels' },
                        { id: 'transactions', label: 'Transactions', icon: Receipt, active: activeTab === 'transactions' },
                        { id: 'consumption', label: 'Consumption', icon: TrendingUp, active: activeTab === 'consumption' },
                        { id: 'consumption-line', label: 'Consumption – Line', icon: FileText, active: activeTab === 'consumption-line' },
                        { id: 'fuel-loss', label: 'Fuel Loss', icon: CheckCircle2, active: activeTab === 'fuel-loss' },
                        { id: 'deliveries', label: 'Deliveries', icon: Truck, active: activeTab === 'deliveries' },
                    ].map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                    tab.active
                                        ? 'bg-[#f26522] text-white shadow-sm'
                                        : 'bg-white text-zinc-700 hover:bg-zinc-100 border border-zinc-200/70'
                                }`}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>


            </div>

            {/* Tab 1: Total Site (Exact Match to Screenshot Design) */}
            {activeTab === 'total-site' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: Deliveries Summary (3 Cols) */}
                    <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-zinc-200/90 shadow-xs flex flex-col justify-between space-y-6">
                        <div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Truck className="h-4 w-4 text-zinc-700" />
                                    <h2 className="text-base font-bold text-zinc-900">Deliveries</h2>
                                </div>
                                <span className="text-[10px] font-extrabold bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded border border-zinc-200">FMA</span>
                            </div>
                            <p className="text-xs text-zinc-500 mt-0.5">Fuel received by the site</p>

                            <div className="mt-5 bg-[#fff8f5] border border-[#ffe5d9] rounded-xl p-4 space-y-1">
                                <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-[#f26522] uppercase tracking-wider">
                                    <Fuel className="h-3.5 w-3.5" />
                                    <span>RECEIVED THIS MONTH</span>
                                </div>
                                <div className="text-3xl font-black text-zinc-900 tracking-tight">
                                    {formatNumber(recentDeliveriesSum)} L
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-[#eefcf2]/60 border border-[#d6f2e1] rounded-xl p-3.5">
                                <span className="text-[11px] font-extrabold text-zinc-500 uppercase tracking-wider block">DELIVERIES</span>
                                <span className="text-lg font-black text-zinc-900 mt-1 block">{deliveriesCount}</span>
                            </div>
                            <div className="bg-[#eefcf2]/60 border border-[#d6f2e1] rounded-xl p-3.5">
                                <span className="text-[11px] font-extrabold text-zinc-500 uppercase tracking-wider block">THIS WEEK</span>
                                <span className="text-lg font-black text-zinc-900 mt-1 block">{formatNumber(recentDeliveriesSum)} L</span>
                            </div>
                        </div>
                    </div>

                    {/* Middle Column: Semi-Circle Gauge Fuel Stock Meter + Sparkline (6 Cols) */}
                    <div className="lg:col-span-6 bg-white rounded-2xl p-6 border border-zinc-200/90 shadow-xs flex flex-col justify-between space-y-6">
                        {/* Gauge Card Header */}
                        <div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Fuel className="h-4 w-4 text-[#f26522]" />
                                    <h2 className="text-base font-bold text-zinc-900">Fuel Stock</h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                                        stockCapacityPct < 20
                                            ? 'bg-rose-100 text-rose-700 border-rose-200'
                                            : stockCapacityPct < 50
                                            ? 'bg-amber-100 text-amber-700 border-amber-200'
                                            : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                    }`}>
                                        {stockCapacityPct < 20 ? 'Critical Level' : 'Above Critical Level'}
                                    </span>
                                    <span className="text-[10px] font-bold bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded">FMA</span>
                                </div>
                            </div>
                        </div>

                        {/* Semi-Circle SVG Speedometer Gauge Meter */}
                        <div className="flex flex-col items-center justify-center relative py-2">
                            <div className="relative w-64 h-36 flex items-end justify-center">
                                <svg viewBox="0 0 200 115" className="w-full h-full overflow-visible">
                                    {/* Green Base Arc (Right & Outer Round End) */}
                                    <path
                                        d="M 25 100 A 75 75 0 0 1 175 100"
                                        fill="none"
                                        stroke="#008037"
                                        strokeWidth="16"
                                        strokeLinecap="round"
                                    />
                                    {/* Red Segment (0-25% Low Level & Outer Round End) */}
                                    <path
                                        d="M 25 100 A 75 75 0 0 1 47 47"
                                        fill="none"
                                        stroke="#d9381e"
                                        strokeWidth="16"
                                        strokeLinecap="round"
                                    />
                                    {/* Amber Segment (25-66% Warning Level - Flat Seamless Joint) */}
                                    <path
                                        d="M 47 47 A 75 75 0 0 1 137.5 35.05"
                                        fill="none"
                                        stroke="#e08b00"
                                        strokeWidth="16"
                                        strokeLinecap="butt"
                                    />

                                    {/* Pointer Triangle mapped to stockCapacityPct */}
                                    <polygon
                                        points="96,7 104,7 100,19"
                                        fill="#18181b"
                                        className="transition-transform duration-500 ease-out"
                                        transform={`rotate(${(-90 + Math.min(Math.max(stockCapacityPct, 0), 100) * 1.8)} 100 100)`}
                                    />
                                </svg>

                                {/* Center Values */}
                                <div className="absolute bottom-1 text-center">
                                    <div className="text-3xl font-black text-zinc-900 tracking-tight">
                                        {formatNumber(currentStock)} L
                                    </div>
                                    <div className="flex items-center justify-center gap-1.5 mt-1">
                                        <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                                            {stockCapacityPct}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <span className="text-xs text-zinc-500 font-medium mt-3">
                                of 20,000 L capacity · <strong className={stockCapacityPct < 20 ? 'text-rose-600' : 'text-emerald-700'}>{stockCapacityPct < 20 ? 'Low Stock' : 'Normal'}</strong>
                            </span>
                        </div>

                        {/* Stock Last 20 Days Sparkline */}
                        <div className="space-y-2 pt-2 border-t border-zinc-100">
                            <div className="text-[11px] font-extrabold text-zinc-500 uppercase tracking-wider">
                                STOCK TREND
                            </div>
                            <div className="h-24 w-full">
                                {trendData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="stock20DaysGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#008080" stopOpacity={0.35} />
                                                    <stop offset="95%" stopColor="#008080" stopOpacity={0.02} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis dataKey="formattedDate" stroke="#94a3b8" fontSize={9} tickLine={false} />
                                            <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} tickFormatter={(v) => formatNumber(v)} />
                                            <Area type="monotone" dataKey="level" stroke="#008080" strokeWidth={2} fill="url(#stock20DaysGrad)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-xs text-zinc-400">Loading stock trend...</div>
                                )}
                            </div>
                        </div>

                        {/* Bottom Metric Cards */}
                        <div className="grid grid-cols-3 gap-2 bg-[#f4f6f8] rounded-xl p-3.5 text-center">
                            <div>
                                <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">CURRENT STOCK</span>
                                <span className="text-base font-black text-zinc-900 mt-0.5 block">{formatNumber(currentStock)} L</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">CAPACITY %</span>
                                <span className="text-base font-black text-zinc-900 mt-0.5 block">{stockCapacityPct}%</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">ACTIVE FLEET</span>
                                <span className="text-base font-black text-zinc-900 mt-0.5 block">{activeVehiclesCount}</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Dispensed by Department (3 Cols) */}
                    <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-zinc-200/90 shadow-xs flex flex-col justify-between space-y-4">
                        <div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Fuel className="h-4 w-4 text-emerald-600" />
                                    <h2 className="text-base font-bold text-zinc-900">Dispensed</h2>
                                </div>
                            </div>
                            <p className="text-xs text-zinc-500 mt-0.5">Fuel issued to vehicles, by department</p>

                            <div className="mt-4 bg-[#fff8f5] border border-[#ffe5d9] rounded-xl p-4 space-y-1">
                                <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-[#f26522] uppercase tracking-wider">
                                    <Truck className="h-3.5 w-3.5" />
                                    <span>{issuedLabel}</span>
                                </div>
                                <div className="text-3xl font-black text-zinc-900 tracking-tight">
                                    {formatNumber(todayIssuedLitres)} L
                                </div>
                                <div className="text-xs text-zinc-500">
                                    Across {departmentBreakdown.length} department{departmentBreakdown.length !== 1 ? 's' : ''}
                                </div>
                            </div>

                            {/* Live Department Breakdown List from API */}
                            <div className="mt-4 space-y-2 text-xs max-h-56 overflow-y-auto pr-1">
                                {departmentBreakdown.length > 0 ? (
                                    departmentBreakdown.map((item, i) => (
                                        <div key={i} className="flex items-center justify-between py-1 border-b border-zinc-100 last:border-0">
                                            <span className="font-semibold text-zinc-600 truncate max-w-[150px]">{item.dept}</span>
                                            <span className="font-black text-zinc-900 shrink-0">{item.amount}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center text-xs text-zinc-400 py-3">No department records</div>
                                )}
                            </div>
                        </div>

                        <div className="bg-[#f4f6f8] rounded-xl p-3.5 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-zinc-500 font-medium">10 day avg / day</span>
                                <span className="font-black text-zinc-900">{formatNumber(tenDayAvg)} L</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-zinc-500 font-medium">30 day avg / day</span>
                                <span className="font-black text-zinc-900">{formatNumber(thirtyDayAvg)} L</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab: Usage Comparison View */}
            {activeTab === 'usage-comparison' && (
                <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-100 gap-4">
                        <div>
                            <h2 className="text-lg font-extrabold text-zinc-900">Usage by date</h2>
                            <p className="text-xs text-zinc-500 mt-0.5">Fuel dispensed each day, split by department</p>
                        </div>
                        <div className="flex items-center gap-6 text-right shrink-0">
                            <div>
                                <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">TOTAL</span>
                                <span className="text-xl font-black text-zinc-900">{formatNumber(usageComparisonData.totalVolume)} L</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">AVERAGE / DAY</span>
                                <span className="text-xl font-black text-zinc-900">{formatNumber(usageComparisonData.avgPerDay)} L</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">PEAK DAY</span>
                                <span className="text-xl font-black text-zinc-900">{formatNumber(usageComparisonData.peakDay)} L</span>
                            </div>
                            <span className="text-[10px] font-extrabold bg-zinc-100 text-zinc-500 px-2.5 py-1 rounded">FMA</span>
                        </div>
                    </div>

                    <div className="h-96 w-full pt-2">
                        {usageComparisonData.points.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={usageComparisonData.points} margin={{ top: 25, right: 10, left: 0, bottom: 25 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis dataKey="formattedDate" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(val) => formatNumber(val)} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '0.5rem', color: '#fff', fontSize: '12px' }}
                                        formatter={(val: any, name: any) => [`${formatNumber(Number(val))} L`, name]}
                                    />
                                    {usageComparisonData.avgPerDay > 0 && (
                                        <ReferenceLine
                                            y={usageComparisonData.avgPerDay}
                                            stroke="#475569"
                                            strokeDasharray="4 4"
                                            label={{
                                                value: `Average ${usageComparisonData.avgPerDay} L`,
                                                fill: '#475569',
                                                fontSize: 11,
                                                position: 'insideBottomLeft',
                                            }}
                                        />
                                    )}

                                    {/* Palette matching exact image colors */}
                                    {usageComparisonData.departments.map((dept, index) => {
                                        const colors = ['#008080', '#c27ba0', '#76a5af', '#8e7cc3', '#674ea7', '#e69138', '#3d85c6'];
                                        const fill = colors[index % colors.length];
                                        return (
                                            <Bar
                                                key={dept}
                                                dataKey={dept}
                                                stackId="a"
                                                fill={fill}
                                                radius={index === usageComparisonData.departments.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                                                barSize={32}
                                            />
                                        );
                                    })}
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                                <Inbox className="h-8 w-8 text-zinc-300 mb-2" />
                                <span className="text-xs font-medium">No usage comparison data available</span>
                            </div>
                        )}
                    </div>

                    {/* Department Color Legend */}
                    {usageComparisonData.departments.length > 0 && (
                        <div className="flex flex-wrap items-center justify-center gap-4 pt-3 border-t border-zinc-100 text-xs font-semibold text-zinc-600">
                            {usageComparisonData.departments.map((dept, index) => {
                                const colors = ['#008080', '#c27ba0', '#76a5af', '#8e7cc3', '#674ea7', '#e69138', '#3d85c6'];
                                return (
                                    <div key={dept} className="flex items-center gap-1.5">
                                        <span className="h-3 w-3 rounded-xs" style={{ backgroundColor: colors[index % colors.length] }} />
                                        <span>{dept}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Tab 2: Tank Levels View */}
            {activeTab === 'tank-levels' && (
                <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
                        <div>
                            <h2 className="text-base font-bold text-zinc-900">Levels by date</h2>
                            <p className="text-xs text-zinc-500">Closing tank level each day with deliveries received</p>
                        </div>
                        <div className="flex items-center gap-6 text-right">
                            <div>
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">LATEST LEVEL</span>
                                <span className="text-base font-extrabold text-zinc-900">{formatNumber(currentStock)} L</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">DELIVERED</span>
                                <span className="text-base font-extrabold text-zinc-900">{formatNumber(recentDeliveriesSum)} L</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-80 w-full pt-2">
                        {trendData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="tankLevelsGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#008080" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#008080" stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="formattedDate" stroke="#94a3b8" fontSize={11} />
                                    <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => formatNumber(val)} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', color: '#fff', fontSize: '12px' }}
                                        formatter={(val: any) => [`${formatNumber(Number(val))} L`, 'Tank Level']}
                                    />
                                    <Area type="stepAfter" dataKey="level" stroke="#008080" strokeWidth={2.5} fill="url(#tankLevelsGrad)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                                <Inbox className="h-8 w-8 text-zinc-300 mb-2" />
                                <span className="text-xs font-medium">No tank level history available</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Tab 3: Transactions View */}
            {activeTab === 'transactions' && (
                <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
                        <div>
                            <h2 className="text-base font-bold text-zinc-900">Transactions by date</h2>
                            <p className="text-xs text-zinc-500">Litres issued each day over the selected period</p>
                        </div>
                        <div className="flex items-center gap-6 text-right">
                            <div>
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">RECORDS</span>
                                <span className="text-base font-extrabold text-zinc-900">{totalTransactions}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">ISSUED</span>
                                <span className="text-base font-extrabold text-[#008080]">{formatNumber(todayIssuedLitres)} L</span>
                            </div>
                        </div>
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
                                    latestTransactions.map((tx, idx) => (
                                        <tr key={tx.id} className={`hover:bg-zinc-50 ${idx % 2 === 1 ? 'bg-[#fff9f5]' : 'bg-white'}`}>
                                            <td className="py-3 px-5 text-zinc-600 font-medium">{tx.dateTime}</td>
                                            <td className="py-3 px-5 font-bold text-blue-600">{tx.vehicle}</td>
                                            <td className="py-3 px-5 font-bold text-zinc-900">{formatNumber(tx.litres)} L</td>
                                            <td className="py-3 px-5 text-center">
                                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 text-[#f26522] border border-orange-100">
                                                    {tx.demMethod}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-zinc-400">No transactions recorded</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Tab 4: Consumption / Usage Views (Fallback for remaining analytics views) */}
            {['usage-overview', 'consumption', 'consumption-line', 'fuel-loss', 'deliveries'].includes(activeTab) && (
                <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-xs space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
                        <div>
                            <h2 className="text-base font-bold text-zinc-900 capitalize">{activeTab.replace('-', ' ')} Analytics</h2>
                            <p className="text-xs text-zinc-500">Detailed breakdown and metrics for {activeTab.replace('-', ' ')}</p>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                            <div>
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">TOTAL DISPENSED</span>
                                <span className="text-base font-extrabold text-[#008080]">{formatNumber(todayIssuedLitres)} L</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-50 rounded-lg p-5 border border-slate-100 space-y-2">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fleet Summary</span>
                            <div className="text-xl font-extrabold text-slate-900">{activeVehiclesCount} Vehicles Monitored</div>
                            <p className="text-xs text-slate-500">Operational status running at {operationalPct}% capacity across all sites.</p>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-5 border border-slate-100 space-y-2">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recent Deliveries Volume</span>
                            <div className="text-xl font-extrabold text-emerald-700">{formatNumber(recentDeliveriesSum)} L</div>
                            <p className="text-xs text-slate-500">Total volume delivered into main site storage tanks.</p>
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    );
}
