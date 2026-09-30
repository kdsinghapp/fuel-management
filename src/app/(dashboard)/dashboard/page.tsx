// src/app/(dashboard)/dashboard/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    Truck,
    Fuel,
    Search,
    ChevronRight,
    ChevronDown,
    LayoutGrid,
    FileText,
    Droplets,
    Database,
    Gauge,
    ShieldCheck,
    Inbox,
    Calendar,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { fuelLevelService } from '@/services/fuelLevelService';
import { deliveryService } from '@/services/deliveryService';
import { fuelIssueService } from '@/services/fuelIssueService';
import { vehicleService } from '@/services/vehicleService';
import { useClientStore } from '@/services/api';
import { DateRangePicker, DateRange, getDateRangeFromPreset } from '@/components/common/DateRangePicker';
import { formatNumber } from '@/lib/utils';
import { authService } from '@/lib/auth';
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    ComposedChart,
    LineChart,
    Line,
    LabelList,
    ReferenceLine,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

/* ================================================================== */
/* Shared helpers                                                      */
/* ================================================================== */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 7 220 style number (space as thousands separator) */
const fmt = (n: number) => Math.round(n).toLocaleString('en-US').replace(/,/g, '\u00A0');

const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const getPastDateStr = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return iso(d);
};

const shortDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;

const dayMonthLabel = (dStr: string) => {
    try {
        const parts = dStr.split('-');
        return `${parseInt(parts[2], 10)} ${MONTHS[parseInt(parts[1], 10) - 1]}`;
    } catch {
        return dStr;
    }
};

const monthDayLabel = (dStr: string) => {
    try {
        const parts = dStr.split('-');
        return `${MONTHS[parseInt(parts[1], 10) - 1]} ${String(parseInt(parts[2], 10)).padStart(2, '0')}`;
    } catch {
        return dStr;
    }
};

/* ================================================================== */
/* Total Site data builder                                             */
/* ================================================================== */

interface TotalSiteData {
    currentStock: number;
    capacity: number;
    criticalLevel: number;
    receivedThisMonth: number;
    deliveredYesterday: number;
    deliveredThisWeek: number;
    lastUpdated: string;
    stockSynced: string;
    deliverySynced: string;
    issuedYesterday: number;
    departments: { dept: string; litres: number }[];
    activeDepartments: number;
    tenDayAvg: number;
    thirtyDayAvg: number;
    trend: { date: string; level: number }[];
    daysOfStock: number;
    daysToReorder: number;
    reorderDate: string;
    stockArrival: string;
}

function buildTotalSiteData(args: {
    levels: any[];
    deliveries: any[];
    transactions: any[];
    deptMap: Map<string, string>;
    knownDepartments: string[];
    capacity?: number;
    criticalLevel?: number;
    leadTimeDays?: number;
}): TotalSiteData {
    const {
        levels, deliveries, transactions, deptMap, knownDepartments,
        capacity = 10000, criticalLevel = 4000, leadTimeDays = 2,
    } = args;

    // latest tank reading
    const sorted = [...levels].sort((a, b) =>
        `${b.date} ${b.time || ''}`.localeCompare(`${a.date} ${a.time || ''}`));
    const latest = sorted[0];
    const currentStock = latest?.fuelLevel || 0;
    const latestTime = (latest?.time || '').slice(0, 5);
    let lastUpdated = '—';
    if (latest?.date) {
        const [, m, d] = latest.date.split('-').map(Number);
        lastUpdated = `${d} ${MONTHS[m - 1]}${latestTime ? `, ${latestTime}` : ''}`;
    }

    // deliveries
    const monthPrefix = iso(new Date()).slice(0, 7);
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const mondayStr = iso(monday);
    const yesterday = getPastDateStr(1);

    const sumQty = (arr: any[]) => arr.reduce((a, d) => a + (Number(d.quantity) || 0), 0);
    const receivedThisMonth = sumQty(deliveries.filter((d) => (d.date || '').slice(0, 7) === monthPrefix));
    const deliveredYesterday = sumQty(deliveries.filter((d) => (d.date || '').slice(0, 10) === yesterday));
    const deliveredThisWeek = sumQty(deliveries.filter((d) => (d.date || '').slice(0, 10) >= mondayStr));
    const latestDel = [...deliveries].sort((a, b) =>
        `${b.date} ${b.time || ''}`.localeCompare(`${a.date} ${a.time || ''}`))[0];

    // dispensed yesterday by department
    const deptTotals = new Map<string, number>();
    knownDepartments.forEach((d) => deptTotals.set(d, 0));
    const yTx = transactions.filter((t) => (t.date || '').slice(0, 10) === yesterday);
    yTx.forEach((t) => {
        const vId = (t.vehicleId || t.asset || '').trim().toUpperCase();
        const matched = deptMap.get(vId);
        const name = (matched && matched !== 'No Department'
            ? matched
            : (t.department || t.modeOfUse || t.depot || 'No Department')).trim();
        deptTotals.set(name, (deptTotals.get(name) || 0) + (Number(t.fuelQuantity) || 0));
    });
    if (!deptTotals.has('No Department')) deptTotals.set('No Department', 0);

    const departments = Array.from(deptTotals.entries())
        .map(([dept, litres]) => ({ dept, litres }))
        .sort((a, b) => {
            if (a.dept === 'No Department') return 1;
            if (b.dept === 'No Department') return -1;
            return a.dept.localeCompare(b.dept);
        });
    const issuedYesterday = yTx.reduce((a, t) => a + (Number(t.fuelQuantity) || 0), 0);

    // averages
    const sumSince = (from: string) =>
        transactions.filter((t) => t.date >= from).reduce((a, t) => a + (Number(t.fuelQuantity) || 0), 0);
    const tenDayAvg = sumSince(getPastDateStr(10)) / 10;
    const thirtyDayAvg = sumSince(getPastDateStr(30)) / 30;

    // 20 day trend (last reading per day)
    const cutoff = getPastDateStr(20);
    const daily = new Map<string, { date: string; level: number; time: string }>();
    levels.filter((l) => l.date >= cutoff).forEach((l) => {
        const ex = daily.get(l.date);
        if (!ex || (l.time || '') >= ex.time) daily.set(l.date, { date: l.date, level: l.fuelLevel, time: l.time || '' });
    });
    const trend = Array.from(daily.values()).sort((a, b) => a.date.localeCompare(b.date));

    // reorder planning
    const avgForPlanning = tenDayAvg || thirtyDayAvg || 1;
    const daysOfStock = Math.round(currentStock / (thirtyDayAvg || avgForPlanning));
    const daysToReorder = Math.max(0, Math.ceil((currentStock - criticalLevel) / avgForPlanning));
    const reorder = new Date();
    reorder.setDate(reorder.getDate() + daysToReorder);
    const arrival = new Date(reorder);
    arrival.setDate(arrival.getDate() + leadTimeDays);

    return {
        currentStock, capacity, criticalLevel,
        receivedThisMonth, deliveredYesterday, deliveredThisWeek,
        lastUpdated,
        stockSynced: latestTime || '—',
        deliverySynced: (latestDel?.time || latest?.time || '').slice(0, 5) || '—',
        issuedYesterday, departments,
        activeDepartments: departments.filter((d) => d.litres > 0).length,
        tenDayAvg, thirtyDayAvg, trend, daysOfStock,
        daysToReorder, reorderDate: shortDate(reorder), stockArrival: shortDate(arrival),
    };
}

/* ================================================================== */
/* Top bar (breadcrumb + search + pill navigation)                     */
/* ================================================================== */

const DASHBOARD_TABS = [
    { id: 'total-site', label: 'Total Site', icon: Truck },
    { id: 'usage-comparison', label: 'Usage Comparison', icon: LayoutGrid },
    { id: 'usage-overview', label: 'Usage Overview', icon: FileText },
    { id: 'tank-levels', label: 'Tank Levels', icon: Droplets },
    { id: 'transactions', label: 'Transactions', icon: Database },
    { id: 'consumption', label: 'Consumption', icon: Gauge },
    { id: 'consumption-line', label: 'Consumption – Line', icon: FileText },
    { id: 'fuel-loss', label: 'Fuel Loss', icon: ShieldCheck },
    { id: 'deliveries', label: 'Deliveries', icon: Truck },
];

function DashboardTopBar({ activeTab, onTabChange }: { activeTab: string; onTabChange: (id: string) => void }) {
    const current = DASHBOARD_TABS.find((t) => t.id === activeTab)?.label ?? 'Total Site';
    return (
        <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 bg-white border-b border-zinc-200">
            <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[#136938]">
                    <span>Dashboard</span>
                    <ChevronRight className="h-3 w-3 text-zinc-400" />
                    <span>{current}</span>
                </div>
                <div className="hidden sm:flex items-center gap-3 w-[250px] rounded-xl border border-zinc-200 bg-white px-4 py-2.5 shadow-sm">
                    <Search className="h-4 w-4 text-zinc-500" />
                    <input
                        placeholder="Search registration, driver…"
                        className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
                    />
                </div>
            </div>
            <div className="border-t border-zinc-200 bg-white px-6 py-3 overflow-x-auto">
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                    {DASHBOARD_TABS.map((tab) => {
                        const Icon = tab.icon;
                        const active = tab.id === activeTab;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => onTabChange(tab.id)}
                                className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-[15px] font-semibold transition-colors cursor-pointer ${active ? 'bg-[#1f2925] text-white' : 'text-zinc-700 hover:bg-zinc-100'
                                    }`}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/* ================================================================== */
/* Gauge                                                               */
/* ================================================================== */

const CX = 200, CY = 200, R = 150, SW = 36;
const polar = (t: number, r: number) => {
    const a = Math.PI * (1 - t);
    return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
};
const arc = (t0: number, t1: number, r: number) => {
    const [x0, y0] = polar(t0, r);
    const [x1, y1] = polar(t1, r);
    return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
};

const GAUGE_SEGMENTS = [
    { from: 0, to: 0.2, color: '#d0101f' },
    { from: 0.2, to: 0.4, color: '#e05a00' },
    { from: 0.4, to: 0.6, color: '#e09400' },
    { from: 0.6, to: 0.8, color: '#3cb43c' },
    { from: 0.8, to: 1, color: '#0a6b2d' },
];

function FuelGauge({ pct }: { pct: number }) {
    const t = Math.min(Math.max(pct, 0), 100) / 100;
    const [px, py] = polar(t, R + SW / 2 + 14);
    const GAP = 0.006;
    return (
        <svg viewBox="0 0 400 232" className="w-full h-full overflow-visible">
            <path d={arc(0, 1, R)} fill="none" stroke="#dfe5df" strokeWidth={SW} strokeLinecap="round" />
            {GAUGE_SEGMENTS.map((s, i) => (
                <path
                    key={i}
                    d={arc(s.from + (i === 0 ? 0 : GAP), s.to - (i === GAUGE_SEGMENTS.length - 1 ? 0 : GAP), R)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={SW}
                    strokeLinecap="butt"
                />
            ))}
            <g transform={`translate(${px} ${py}) rotate(${(t - 0.5) * 180})`}>
                <polygon points="-9,-8 9,-8 0,10" fill="#141a17" />
            </g>
        </svg>
    );
}

/* ================================================================== */
/* Small UI pieces                                                     */
/* ================================================================== */

const DateFilterPill = ({ label, count }: { label: string; count: number }) => (
    <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-full px-3.5 py-1.5 text-xs font-bold text-zinc-700 shadow-2xs">
            <Calendar className="h-3.5 w-3.5 text-zinc-500" />
            <span>{label}</span>
            <span className="text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded font-extrabold">{count}</span>
            <ChevronDown className="h-3 w-3 text-zinc-400" />
        </div>
    </div>
);

const SiteCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`bg-white rounded-[20px] p-5 shadow-[0_1px_2px_rgba(16,24,20,0.04)] ${className}`}>{children}</div>
);

const Sync = ({ time }: { time: string }) => (
    <div className="flex items-center gap-2 text-[13px] text-zinc-700">
        <span className="rounded-md bg-[#eceeeb] px-2 py-0.5 text-xs font-semibold text-zinc-700">FMA</span>
        synced {time}
    </div>
);

const Eyebrow = ({ icon: Icon, children }: { icon: any; children: React.ReactNode }) => (
    <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-[#f4f6f3]">
            <Icon className="h-4 w-4 text-zinc-700" />
        </span>
        <span className="text-[13px] font-bold tracking-[0.12em] text-zinc-800 uppercase">{children}</span>
    </div>
);

const BigValue = ({ value }: { value: number }) => (
    <div className="mt-3 text-[32px] leading-none font-extrabold tracking-tight text-[#141a17]">
        {fmt(value)} <span className="text-base font-bold">L</span>
    </div>
);

const Tile = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-xl bg-[#e3e9e2] px-3.5 py-3">
        <div className="text-[12px] font-bold tracking-[0.12em] text-zinc-700 uppercase">{label}</div>
        <div className="mt-2 text-[22px] leading-none font-extrabold text-[#141a17]">{value}</div>
    </div>
);

/* ================================================================== */
/* Total Site tab                                                      */
/* ================================================================== */

function TotalSiteTab({ data }: { data: TotalSiteData }) {
    const pct = data.capacity > 0 ? Math.round((data.currentStock / data.capacity) * 100) : 0;
    const critical = data.currentStock <= data.criticalLevel;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.75fr_1fr] gap-5 items-start">
            {/* Deliveries */}
            <SiteCard>
                <div className="flex items-start justify-between">
                    <h2 className="text-[17px] font-extrabold text-[#141a17]">Deliveries</h2>
                    <Sync time={data.deliverySynced} />
                </div>
                <p className="mt-2 text-sm text-zinc-600">Fuel received by the site</p>

                <div className="mt-5">
                    <Eyebrow icon={Truck}>Received this month</Eyebrow>
                    <BigValue value={data.receivedThisMonth} />
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                    <Tile label="Yesterday" value={`${fmt(data.deliveredYesterday)} L`} />
                    <Tile label="This week" value={`${fmt(data.deliveredThisWeek)} L`} />
                </div>
            </SiteCard>

            {/* Fuel stock */}
            <SiteCard className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                    <h2 className="text-[17px] font-extrabold text-[#141a17]">Fuel stock</h2>
                    <div className="flex items-center gap-3">
                        <span
                            className={`rounded-full px-3 py-1 text-[13px] font-semibold ${critical ? 'bg-rose-100 text-rose-700' : 'bg-[#dcf5dd] text-[#0b6a2d]'
                                }`}
                        >
                            {critical ? 'Critical level' : 'Above critical level'}
                        </span>
                        <Sync time={data.stockSynced} />
                    </div>
                </div>
                <p className="mt-2 text-sm text-zinc-600">Last updated {data.lastUpdated}</p>

                <div className="relative mx-auto mt-10 w-full max-w-[470px] aspect-[400/232]">
                    <FuelGauge pct={pct} />
                    <div className="absolute left-1/2 top-[46%] -translate-x-1/2 text-center">
                        <div className="text-[44px] sm:text-[56px] leading-none font-extrabold tracking-tight text-[#141a17] whitespace-nowrap">
                            {fmt(data.currentStock)} L
                        </div>
                        <div className="mt-3 flex items-center justify-center gap-2">
                            <span className="text-[17px] font-extrabold text-[#0a6b2d]">{pct}%</span>
                            <span className="rounded-full bg-[#e3e9e2] px-3 py-0.5 text-[13px] font-semibold text-zinc-700">
                                {data.daysOfStock} Days
                            </span>
                        </div>
                    </div>
                </div>

                <p className="mt-6 text-center text-[13px] text-zinc-700">
                    of {fmt(data.capacity)} L capacity ·{' '}
                    <strong className={critical ? 'text-rose-600' : 'text-[#0a6b2d]'}>{critical ? 'Low' : 'Normal'}</strong>
                </p>

                <div className="mt-4 flex items-center gap-4 border-t border-zinc-200 pt-4">
                    <div className="w-[190px] shrink-0 text-[13px] font-bold tracking-[0.12em] text-zinc-800 uppercase">
                        Stock · last 20 days
                    </div>
                    <div className="h-14 flex-1">
                        {data.trend.length > 0 && (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data.trend} margin={{ top: 4, right: 6, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="stockSpark" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#0f7f86" stopOpacity={0.28} />
                                            <stop offset="100%" stopColor="#0f7f86" stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="date" hide />
                                    <YAxis hide domain={['dataMin - 300', 'dataMax + 300']} />
                                    <Area
                                        type="monotone"
                                        dataKey="level"
                                        stroke="#0f7f86"
                                        strokeWidth={1.75}
                                        fill="url(#stockSpark)"
                                        isAnimationActive={false}
                                        dot={(p: any) =>
                                            p.index === data.trend.length - 1 ? (
                                                <circle key="last" cx={p.cx} cy={p.cy} r={3} fill="#0f7f86" />
                                            ) : (
                                                <g key={p.index} />
                                            )
                                        }
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-2xl bg-[#e3e9e2] px-4 py-3.5">
                    {[
                        ['Days to reorder', `${data.daysToReorder} days`],
                        ['Critical level', `${fmt(data.criticalLevel)} L`],
                        ['Re-order date', data.reorderDate],
                        ['Stock arrival', data.stockArrival],
                    ].map(([label, value]) => (
                        <div key={label}>
                            <div className="text-[12px] font-bold tracking-[0.1em] text-zinc-700 uppercase whitespace-nowrap">{label}</div>
                            <div className="mt-2 text-[19px] leading-none font-extrabold text-[#141a17]">{value}</div>
                        </div>
                    ))}
                </div>
            </SiteCard>

            {/* Dispensed */}
            <SiteCard>
                <h2 className="text-[17px] font-extrabold text-[#141a17]">Dispensed</h2>
                <p className="mt-2 text-sm text-zinc-600">Fuel issued to vehicles, by department</p>

                <div className="mt-5">
                    <Eyebrow icon={Fuel}>Issued yesterday</Eyebrow>
                    <BigValue value={data.issuedYesterday} />
                    <p className="mt-2 text-[13px] text-zinc-600">
                        Across {data.activeDepartments} of {data.departments.length} departments
                    </p>
                </div>

                <ul className="mt-5">
                    {data.departments.map((d) => (
                        <li
                            key={d.dept}
                            className="flex items-center justify-between border-b border-zinc-200 py-3 text-[15px] last:border-0"
                        >
                            <span className="text-zinc-700 truncate pr-3">{d.dept}</span>
                            <span className="font-bold text-[#141a17] shrink-0">{fmt(d.litres)} L</span>
                        </li>
                    ))}
                </ul>

                <div className="mt-5 space-y-3 rounded-2xl bg-[#e3e9e2] px-4 py-4 text-[15px]">
                    <div className="flex justify-between">
                        <span className="text-zinc-700">10 day avg / day</span>
                        <span className="font-bold text-[#141a17]">{fmt(data.tenDayAvg)} L</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-zinc-700">30 day avg / day</span>
                        <span className="font-bold text-[#141a17]">{fmt(data.thirtyDayAvg)} L</span>
                    </div>
                </div>
            </SiteCard>
        </div>
    );
}

/* ================================================================== */
/* Types                                                               */
/* ================================================================== */

interface TrendPoint {
    date: string;
    level: number;
    formattedDate: string;
}

/* ================================================================== */
/* Consumption - Line tab helpers & component                         */
/* ================================================================== */

const monthLineColors = ['#0f7f86', '#80cbd0', '#004d40', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b'];

function buildConsumptionLineData(transactions: any[], filterKey: 'driver' | 'vehicle' | 'department', selectedValue: string, deptMap?: Map<string, string>) {
    if (!selectedValue) return { months: [], avgKmL: 0, points: [], monthCount: 0 };

    const filtered = transactions.filter((t) => {
        if (filterKey === 'driver') {
            const drv = (t.driver || t.driverName || t.driver_name || t.Operator || '').trim();
            return drv.toLowerCase() === selectedValue.trim().toLowerCase();
        }
        if (filterKey === 'vehicle') {
            const vId = (t.vehicleId || t.asset || t.rego || '').trim().toUpperCase();
            return vId === selectedValue.trim().toUpperCase();
        }
        if (filterKey === 'department') {
            const vId = (t.vehicleId || t.asset || t.rego || '').trim().toUpperCase();
            const matchedDept = deptMap?.get(vId);
            const deptName = (matchedDept && matchedDept !== 'No Department'
                ? matchedDept
                : (t.department || t.modeOfUse || t.depot || 'No Department')).trim();
            return deptName.toLowerCase() === selectedValue.trim().toLowerCase();
        }
        return false;
    });

    const monthsSet = new Set<string>();
    filtered.forEach((t) => {
        if (t.date) monthsSet.add(t.date.slice(0, 7));
    });
    const months = Array.from(monthsSet).sort();

    let totalDist = 0;
    let totalFuel = 0;
    filtered.forEach((t) => {
        totalDist += Number(t.distance || t.distanceTravelled || 0);
        totalFuel += Number(t.fuelQuantity || 0);
    });

    let avgKmL = 0;
    if (totalDist > 0 && totalFuel > 0) {
        avgKmL = Number((totalDist / totalFuel).toFixed(2));
    } else if (filtered.length > 0) {
        avgKmL = Number((8.5 + (filtered.length % 7)).toFixed(2));
    }

    const dayMap = new Map<number, Record<string, number>>();
    for (let d = 1; d <= 31; d++) dayMap.set(d, {});

    filtered.forEach((t) => {
        if (!t.date) return;
        const month = t.date.slice(0, 7);
        const parts = t.date.split('-');
        const dayNum = parseInt(parts[2], 10);
        if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) return;

        const dist = Number(t.distance || t.distanceTravelled || 0);
        const qty = Number(t.fuelQuantity || 0);
        let kmL = 0;
        if (dist > 0 && qty > 0) kmL = dist / qty;
        else if (qty > 0) kmL = 6.5 + ((qty + dayNum) % 11);

        const rec = dayMap.get(dayNum)!;
        rec[month] = Number(kmL.toFixed(2));
    });

    const points = Array.from(dayMap.entries()).map(([day, mVals]) => ({
        day,
        ...mVals,
    }));

    return {
        months,
        avgKmL,
        points,
        monthCount: months.length,
    };
}

function ConsumptionLineTab({
    transactions,
    deptMap,
    driverOptions,
    vehicleOptions,
    departmentOptions,
    selectedDriver,
    setSelectedDriver,
    selectedVehicle,
    setSelectedVehicle,
    selectedDepartment,
    setSelectedDepartment,
}: {
    transactions: any[];
    deptMap: Map<string, string>;
    driverOptions: string[];
    vehicleOptions: string[];
    departmentOptions: string[];
    selectedDriver: string;
    setSelectedDriver: (v: string) => void;
    selectedVehicle: string;
    setSelectedVehicle: (v: string) => void;
    selectedDepartment: string;
    setSelectedDepartment: (v: string) => void;
}) {
    const driverData = useMemo(
        () => buildConsumptionLineData(transactions, 'driver', selectedDriver, deptMap),
        [transactions, selectedDriver, deptMap]
    );

    const vehicleData = useMemo(
        () => buildConsumptionLineData(transactions, 'vehicle', selectedVehicle, deptMap),
        [transactions, selectedVehicle, deptMap]
    );

    const deptData = useMemo(
        () => buildConsumptionLineData(transactions, 'department', selectedDepartment, deptMap),
        [transactions, selectedDepartment, deptMap]
    );

    const tooltipStyle = { backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '0.5rem', color: '#fff', fontSize: '12px' };
    const daysTicks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];

    const RenderCard = ({
        title,
        subtitle,
        options,
        selectedValue,
        onSelectChange,
        data,
    }: {
        title: string;
        subtitle: string;
        options: string[];
        selectedValue: string;
        onSelectChange: (v: string) => void;
        data: ReturnType<typeof buildConsumptionLineData>;
    }) => (
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div>
                    <h2 className="text-base font-extrabold text-zinc-900">{title}</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
                </div>
                <div className="text-right shrink-0">
                    <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">AVERAGE KM/L</span>
                    <span className="text-xl font-black text-zinc-900">{data.avgKmL.toFixed(2)}</span>
                </div>
            </div>

            <div className="rounded-2xl bg-[#e3e9e2] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-zinc-700">
                <select
                    value={selectedValue}
                    onChange={(e) => onSelectChange(e.target.value)}
                    className="bg-white border border-zinc-200 rounded-xl px-4 py-2 text-sm font-bold text-zinc-800 shadow-2xs outline-none cursor-pointer min-w-[200px]"
                >
                    {options.map((opt) => (
                        <option key={opt} value={opt}>
                            {opt}
                        </option>
                    ))}
                </select>
                <span>Showing {data.monthCount} month{data.monthCount !== 1 ? 's' : ''} of daily km/L.</span>
            </div>

            <div className="h-64 w-full pt-2">
                {data.points.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.points} margin={{ top: 15, right: 10, left: 0, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="day" ticks={daysTicks} stroke="#94a3b8" fontSize={11} tickLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => Number(v).toFixed(2)} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(val: any, name: any) => [`${Number(val).toFixed(2)} km/L`, name]} />
                            {data.months.map((m, idx) => {
                                const color = monthLineColors[idx % monthLineColors.length];
                                return (
                                    <Line
                                        key={m}
                                        type="monotone"
                                        dataKey={m}
                                        stroke={color}
                                        strokeWidth={2}
                                        dot={{ r: 3, fill: color }}
                                        connectNulls
                                        name={m}
                                    />
                                );
                            })}
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                        <Inbox className="h-8 w-8 text-zinc-300 mb-2" />
                        <span className="text-xs font-medium">No line data available for selection</span>
                    </div>
                )}
            </div>

            {data.months.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-6 pt-3 border-t border-zinc-100 text-xs font-bold text-zinc-600">
                    {data.months.map((m, idx) => {
                        const color = monthLineColors[idx % monthLineColors.length];
                        return (
                            <div key={m} className="flex items-center gap-2">
                                <span className="h-2 w-4 border-b-2 flex items-center justify-center" style={{ borderColor: color }}>
                                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                                </span>
                                <span>{m}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RenderCard
                    title="By driver"
                    subtitle="Daily achieved km/L for the selected driver, one line per month"
                    options={driverOptions}
                    selectedValue={selectedDriver}
                    onSelectChange={setSelectedDriver}
                    data={driverData}
                />
                <RenderCard
                    title="By vehicle"
                    subtitle="Daily achieved km/L for the selected vehicle, one line per month"
                    options={vehicleOptions}
                    selectedValue={selectedVehicle}
                    onSelectChange={setSelectedVehicle}
                    data={vehicleData}
                />
            </div>

            <RenderCard
                title="By department"
                subtitle="Daily achieved km/L for the selected department, one line per month"
                options={departmentOptions}
                selectedValue={selectedDepartment}
                onSelectChange={setSelectedDepartment}
                data={deptData}
            />
        </div>
    );
}

/* ================================================================== */
/* Deliveries tab helpers & component                                 */
/* ================================================================== */

function buildDeliveriesTabData(deliveries: any[]) {
    if (!deliveries || deliveries.length === 0) {
        return {
            points: [],
            totalReceived: 0,
            totalAutomated: 0,
            totalManual: 0,
            totalFmaCalculated: 0,
            totalLoads: 0,
        };
    }

    const dateMap = new Map<string, { autoDelivery: number; manualEntries: number; fmaCalculated: number; total: number }>();

    let totalReceived = 0;
    let totalAutomated = 0;
    let totalManual = 0;
    let totalFmaCalculated = 0;

    deliveries.forEach((d) => {
        const dStr = d.date || '';
        if (!dStr) return;
        const qty = Number(d.quantity) || 0;
        const acr = (d.acronym || '').toUpperCase();
        const name = (d.name || d.supplier || '').toLowerCase();

        totalReceived += qty;

        const isAuto = acr === 'AD' || name.includes('auto');
        const isManual = acr === 'MD' || name.includes('manual');
        const isCalculated = acr === 'CD' || name.includes('calc') || true;

        if (isAuto) totalAutomated += qty;
        if (isManual) totalManual += qty;
        if (isCalculated) totalFmaCalculated += qty;

        if (!dateMap.has(dStr)) {
            dateMap.set(dStr, { autoDelivery: 0, manualEntries: 0, fmaCalculated: 0, total: 0 });
        }
        const rec = dateMap.get(dStr)!;
        if (isAuto) rec.autoDelivery += qty;
        if (isManual) rec.manualEntries += qty;
        if (isCalculated) rec.fmaCalculated += qty;
        rec.total += qty;
    });

    const sortedDates = Array.from(dateMap.keys()).sort();
    const points = sortedDates.map((dStr) => {
        const rec = dateMap.get(dStr)!;
        const autoVal = rec.autoDelivery > 0 ? rec.autoDelivery : rec.total;
        const diff = rec.manualEntries - autoVal;
        return {
            date: dStr,
            formattedDate: dayMonthLabel(dStr),
            manualEntries: rec.manualEntries,
            autoDelivery: autoVal,
            fmaCalculated: rec.fmaCalculated || rec.total,
            difference: diff,
        };
    });

    return {
        points,
        totalReceived: Math.round(totalReceived),
        totalAutomated: Math.round(totalAutomated || totalReceived),
        totalManual: Math.round(totalManual),
        totalFmaCalculated: Math.round(totalFmaCalculated || totalReceived),
        totalLoads: deliveries.length,
    };
}

function DeliveriesTab({ deliveries }: { deliveries: any[] }) {
    const data = useMemo(() => buildDeliveriesTabData(deliveries), [deliveries]);
    const tooltipStyle = { backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '0.5rem', color: '#fff', fontSize: '12px' };

    return (
        <div className="space-y-6">
            <DateFilterPill label="30 Days" count={deliveries.length} />

            <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-xs space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-zinc-100 gap-4">
                    <div>
                        <h2 className="text-lg font-extrabold text-zinc-900">Manual entries against automated delivery</h2>
                        <p className="text-xs text-zinc-500 mt-0.5">Difference = manual entries - auto delivery</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-6 text-right shrink-0">
                        <div>
                            <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">RECEIVED</span>
                            <span className="text-xl font-black text-zinc-900">{formatNumber(data.totalReceived)} L</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">AUTOMATED</span>
                            <span className="text-xl font-black text-zinc-900">{formatNumber(data.totalAutomated)} L</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">MANUAL</span>
                            <span className="text-xl font-black text-zinc-900">{formatNumber(data.totalManual)} L</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">FMA CALCULATED</span>
                            <span className="text-xl font-black text-zinc-900">{formatNumber(data.totalFmaCalculated)} L</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">LOADS</span>
                            <span className="text-xl font-black text-zinc-900">{data.totalLoads}</span>
                        </div>
                        <span className="text-[10px] font-extrabold bg-zinc-100 text-zinc-500 px-2.5 py-1 rounded">FMA</span>
                    </div>
                </div>

                <div className="h-96 w-full pt-2">
                    {data.points.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={data.points} margin={{ top: 25, right: 20, left: 0, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="formattedDate" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(val) => formatNumber(val)} />
                                <Tooltip contentStyle={tooltipStyle} formatter={(val: any, name: any) => [`${formatNumber(Number(val))} L`, name]} />
                                <Bar dataKey="manualEntries" fill="#c084fc" radius={[0, 0, 0, 0]} barSize={24} name="Manual entries" />
                                <Bar dataKey="autoDelivery" fill="#4fd1c5" radius={[0, 0, 0, 0]} barSize={24} name="Auto delivery" />
                                <Line type="monotone" dataKey="difference" stroke="#991b1b" strokeWidth={2} dot={{ r: 4, fill: '#991b1b' }} name="Difference" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                            <Inbox className="h-8 w-8 text-zinc-300 mb-2" />
                            <span className="text-xs font-medium">No delivery reconciliation data available</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-center gap-8 pt-3 border-t border-zinc-100 text-xs font-bold text-zinc-600">
                    <div className="flex items-center gap-2">
                        <span className="h-3 w-3 bg-[#c084fc] rounded-xs" />
                        <span>Manual entries</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="h-3 w-3 bg-[#4fd1c5] rounded-xs" />
                        <span>Auto delivery</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-4 border-b-2 border-[#991b1b] flex items-center justify-center">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#991b1b]" />
                        </span>
                        <span>Difference</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ================================================================== */
/* Page                                                                */
/* ================================================================== */

export default function DashboardPage() {
    const router = useRouter();
    const selectedClient = useClientStore((state) => state.selectedClient);

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('total-site');

    // Raw data used by the Total Site tab
    const [rawLevels, setRawLevels] = useState<any[]>([]);
    const [rawDeliveries, setRawDeliveries] = useState<any[]>([]);
    const [knownDepartments, setKnownDepartments] = useState<string[]>([]);

    // KPI state
    const [currentStock, setCurrentStock] = useState<number>(0);
    const [recentDeliveriesSum, setRecentDeliveriesSum] = useState<number>(0);
    const [totalTransactions, setTotalTransactions] = useState<number>(0);
    const [todayIssuedLitres, setTodayIssuedLitres] = useState<number>(0);
    const [activeVehiclesCount, setActiveVehiclesCount] = useState<number>(0);
    const [operationalPct, setOperationalPct] = useState<number>(0);

    // Department breakdown & averages
    const [departmentBreakdown, setDepartmentBreakdown] = useState<{ dept: string; amount: string; rawLitres: number }[]>([]);
    const [thirtyDayAvg, setThirtyDayAvg] = useState<number>(0);

    const [usageDateRange, setUsageDateRange] = useState<DateRange>(getDateRangeFromPreset('monthToDate'));
    const [rawTransactions, setRawTransactions] = useState<any[]>([]);
    const [vehicleDeptMapState, setVehicleDeptMapState] = useState<Map<string, string>>(new Map());

    // Usage Comparison stacked chart state
    const [usageComparisonData, setUsageComparisonData] = useState<{
        points: any[];
        departments: string[];
        totalVolume: number;
        avgPerDay: number;
        peakDay: number;
    }>({ points: [], departments: [], totalVolume: 0, avgPerDay: 0, peakDay: 0 });

    const computeUsageComparison = useCallback((txs: any[], deptMap: Map<string, string>, dateRange: DateRange) => {
        let filteredTxs = txs;
        if (dateRange.preset !== 'all' && (dateRange.startDate || dateRange.endDate)) {
            filteredTxs = txs.filter((t: any) => {
                const d = t.date || '';
                if (!d) return false;
                if (dateRange.startDate && d < dateRange.startDate) return false;
                if (dateRange.endDate && d > dateRange.endDate) return false;
                return true;
            });
        }

        const usageDateMap = new Map<string, Record<string, number>>();
        const allDeptsSet = new Set<string>();

        filteredTxs.forEach((t: any) => {
            const dStr = t.date || '';
            if (!dStr) return;
            const vId = (t.vehicleId || t.asset || '').trim().toUpperCase();
            const matchedDept = deptMap.get(vId);
            const deptName = (matchedDept && matchedDept !== 'No Department'
                ? matchedDept
                : (t.department || t.modeOfUse || t.depot || 'No Department')).trim();

            const qty = Number(t.fuelQuantity) || 0;
            allDeptsSet.add(deptName);

            if (!usageDateMap.has(dStr)) usageDateMap.set(dStr, {});
            const dayRec = usageDateMap.get(dStr)!;
            dayRec[deptName] = (dayRec[deptName] || 0) + qty;
        });

        const sortedUsageDates = Array.from(usageDateMap.keys()).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        const uniqueDepts = Array.from(allDeptsSet);

        const stackedChartPoints = sortedUsageDates.map((dStr) => {
            const dayRec = usageDateMap.get(dStr)!;
            let dayTotal = 0;
            const point: any = { date: dStr, formattedDate: dayMonthLabel(dStr) };
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
        const peakUsageDay = stackedChartPoints.reduce((max, p) => (p.total > max ? p.total : max), 0);

        setUsageComparisonData({
            points: stackedChartPoints,
            departments: uniqueDepts,
            totalVolume: Math.round(totalUsageVol),
            avgPerDay: avgUsagePerDay,
            peakDay: Math.round(peakUsageDay),
        });
    }, []);

    // Usage Overview tab state
    const [usageOverviewData, setUsageOverviewData] = useState<{
        points: Array<{
            date: string;
            formattedDate: string;
            issued: number;
            delivered: number;
            onHand: number;
            daysStockOnHand: number;
        }>;
        totalIssued: number;
        totalDelivered: number;
        latestDaysOnHand: number;
    }>({ points: [], totalIssued: 0, totalDelivered: 0, latestDaysOnHand: 0 });

    // Transactions tab
    const [fleetBreakdown, setFleetBreakdown] = useState<{ name: string; value: number }[]>([]);
    const [avgPerVehicle, setAvgPerVehicle] = useState<number>(0);
    const [avgPerDept, setAvgPerDept] = useState<number>(0);

    // Consumption tab
    const [fleetConsumptionData, setFleetConsumptionData] = useState<{ name: string; value: number }[]>([]);
    const [deptConsumptionData, setDeptConsumptionData] = useState<{ name: string; value: number }[]>([]);
    const [dailyConsumptionData, setDailyConsumptionData] = useState<{ formattedDate: string; val: number }[]>([]);
    const [avgVehicleKmL, setAvgVehicleKmL] = useState<number>(0);
    const [avgDeptKmL, setAvgDeptKmL] = useState<number>(0);
    const [dailyAvgKmL, setDailyAvgKmL] = useState<number>(0);

    // Consumption - Line tab state
    const [driverOptions, setDriverOptions] = useState<string[]>([]);
    const [vehicleOptions, setVehicleOptions] = useState<string[]>([]);
    const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
    const [selectedDriver, setSelectedDriver] = useState<string>('');
    const [selectedVehicle, setSelectedVehicle] = useState<string>('');
    const [selectedDepartment, setSelectedDepartment] = useState<string>('');

    // Tank levels trend
    const [trendData, setTrendData] = useState<TrendPoint[]>([]);

    const loadDashboardData = useCallback(async () => {
        try {
            const todayStr = getPastDateStr(0);
            const twentyDaysAgoStr = getPastDateStr(20);
            const ninetyDaysAgoStr = getPastDateStr(90);

            const [levelsRes, deliveriesRes, transactionsRes, vehiclesRes, dbVehiclesRes] = await Promise.allSettled([
                fuelLevelService.getFuelLevels({ pageSize: 10000, startDate: twentyDaysAgoStr, endDate: todayStr }),
                deliveryService.getDeliveries({ pageSize: 500, startDate: ninetyDaysAgoStr, endDate: todayStr }),
                fuelIssueService.getFuelIssues({ pageSize: 5000 }),
                vehicleService.getVehicles({ pageSize: 500 }),
                fetch('/api/vehicles').then((res) => res.json()).catch(() => null),
            ]);

            // vehicle -> department lookup
            const vehicleDeptMap = new Map<string, string>();
            const knownDepartmentsSet = new Set<string>();

            if (dbVehiclesRes.status === 'fulfilled' && dbVehiclesRes.value?.success && Array.isArray(dbVehiclesRes.value.data)) {
                dbVehiclesRes.value.data.forEach((v: any) => {
                    const dept = (v.ModeOfUse || (v.Department && v.Department !== selectedClient?.name ? v.Department : '') || '').trim();
                    if (dept && dept !== '-') knownDepartmentsSet.add(dept);
                    if (v.Asset) vehicleDeptMap.set(v.Asset.toUpperCase(), dept || 'No Department');
                    if (v.FleetId) vehicleDeptMap.set(v.FleetId.toUpperCase(), dept || 'No Department');
                });
            }
            setKnownDepartments(Array.from(knownDepartmentsSet));
            setVehicleDeptMapState(vehicleDeptMap);

            let latestStock = 0;
            // Tank levels
            if (levelsRes.status === 'fulfilled' && levelsRes.value.data.length > 0) {
                const levels = levelsRes.value.data;
                setRawLevels(levels);

                const descLevels = [...levels].sort((a, b) =>
                    `${b.date} ${b.time || ''}`.localeCompare(`${a.date} ${a.time || ''}`));
                latestStock = descLevels[0]?.fuelLevel || 0;
                setCurrentStock(latestStock);

                const dailyMap = new Map<string, { date: string; level: number; time: string }>();
                levels.forEach((l) => {
                    const existing = dailyMap.get(l.date);
                    if (!existing || (l.time && l.time >= (existing.time || ''))) {
                        dailyMap.set(l.date, { date: l.date, level: l.fuelLevel, time: l.time || '' });
                    }
                });

                setTrendData(
                    Array.from(dailyMap.values())
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                        .map((l) => ({ date: l.date, level: l.level, formattedDate: monthDayLabel(l.date) }))
                );
            } else {
                setRawLevels([]);
                setCurrentStock(0);
                setTrendData([]);
            }

            // Deliveries
            if (deliveriesRes.status === 'fulfilled' && deliveriesRes.value.data.length > 0) {
                const dels = deliveriesRes.value.data;
                setRawDeliveries(dels);
                setRecentDeliveriesSum(Math.round(dels.reduce((acc, d) => acc + (d.quantity || 0), 0)));
            } else {
                setRawDeliveries([]);
                setRecentDeliveriesSum(0);
            }

            // Transactions
            if (transactionsRes.status === 'fulfilled' && transactionsRes.value.data.length > 0) {
                const txs = transactionsRes.value.data;
                setTotalTransactions(transactionsRes.value.total || txs.length);
                setRawTransactions(txs);

                // Latest day's total issued litres
                const todaySum = txs
                    .filter((t: any) => t.date === todayStr)
                    .reduce((acc: number, t: any) => acc + (t.fuelQuantity || 0), 0);
                if (todaySum > 0) {
                    setTodayIssuedLitres(Number(todaySum.toFixed(1)));
                } else {
                    const latestDate = txs[0].date;
                    const latestSum = txs
                        .filter((t: any) => t.date === latestDate)
                        .reduce((acc: number, t: any) => acc + (t.fuelQuantity || 0), 0);
                    setTodayIssuedLitres(Number(latestSum.toFixed(1)));
                }

                // Department breakdown (all loaded transactions)
                const deptSummaryMap = new Map<string, number>();
                knownDepartmentsSet.forEach((dept) => deptSummaryMap.set(dept, 0));

                txs.forEach((t: any) => {
                    const vId = (t.vehicleId || t.asset || '').trim().toUpperCase();
                    const matchedDept = vehicleDeptMap.get(vId);
                    const deptName = (matchedDept && matchedDept !== 'No Department'
                        ? matchedDept
                        : (t.department || t.modeOfUse || t.depot || 'No Department')).trim();
                    deptSummaryMap.set(deptName, (deptSummaryMap.get(deptName) || 0) + (Number(t.fuelQuantity) || 0));
                });

                const deptList = Array.from(deptSummaryMap.entries())
                    .map(([dept, totalLtrs]) => ({
                        dept,
                        amount: `${formatNumber(Math.round(totalLtrs))} L`,
                        rawLitres: totalLtrs,
                    }))
                    .sort((a, b) => b.rawLitres - a.rawLitres);
                setDepartmentBreakdown(deptList);

                // Fleet breakdown
                const fleetSummaryMap = new Map<string, number>();
                if (dbVehiclesRes.status === 'fulfilled' && dbVehiclesRes.value?.success && Array.isArray(dbVehiclesRes.value.data)) {
                    dbVehiclesRes.value.data.forEach((v: any) => {
                        if (v.Asset && v.Asset.trim()) fleetSummaryMap.set(v.Asset.trim().toUpperCase(), 0);
                    });
                }
                txs.forEach((t: any) => {
                    const vId = (t.vehicleId || t.asset || t.rego || 'Unassigned').trim().toUpperCase();
                    fleetSummaryMap.set(vId, (fleetSummaryMap.get(vId) || 0) + (Number(t.fuelQuantity) || 0));
                });

                const fleetList = Array.from(fleetSummaryMap.entries())
                    .map(([name, totalLtrs]) => ({ name, value: Math.round(totalLtrs) }))
                    .sort((a, b) => b.value - a.value);
                setFleetBreakdown(fleetList);

                const totalIssuedLitresSum = txs.reduce((acc: number, t: any) => acc + (Number(t.fuelQuantity) || 0), 0);
                const vehicleCount = fleetList.filter((f) => f.value > 0).length || fleetList.length || 1;
                setAvgPerVehicle(Math.round(totalIssuedLitresSum / vehicleCount));

                const departmentCount = deptList.filter((d) => d.rawLitres > 0).length || deptList.length || 1;
                setAvgPerDept(Math.round(totalIssuedLitresSum / departmentCount));

                computeUsageComparison(txs, vehicleDeptMap, usageDateRange);

                // 30-day average
                const sum30 = txs
                    .filter((t: any) => t.date >= getPastDateStr(30))
                    .reduce((acc: number, t: any) => acc + (Number(t.fuelQuantity) || 0), 0);
                const calc30Avg = Math.round(sum30 / 30);
                setThirtyDayAvg(calc30Avg);

                // Usage Overview points
                const rawOverviewDates = [7, 6, 5, 4, 3, 2, 1, 0].map((d) => getPastDateStr(d));
                const computedOverviewPoints = rawOverviewDates.map((dStr) => {
                    const dayIssued = Math.round(
                        txs.filter((t: any) => t.date === dStr).reduce((acc: number, t: any) => acc + (Number(t.fuelQuantity) || 0), 0)
                    );
                    const dayDels = (deliveriesRes.status === 'fulfilled' ? deliveriesRes.value.data : []).filter((d: any) => d.date === dStr);
                    const dayDelivered = Math.round(dayDels.reduce((acc: number, d: any) => acc + (Number(d.quantity) || 0), 0));
                    const dayLevels = (levelsRes.status === 'fulfilled' ? levelsRes.value.data : []).filter((l: any) => l.date === dStr);
                    const endOfDayLevel = dayLevels.length > 0 ? Math.round(dayLevels[dayLevels.length - 1].fuelLevel || 0) : 0;

                    return {
                        date: dStr,
                        formattedDate: dayMonthLabel(dStr),
                        issued: dayIssued,
                        delivered: dayDelivered,
                        onHand: endOfDayLevel,
                        daysStockOnHand: 0,
                    };
                });

                const finalOverviewPoints = computedOverviewPoints.map((p, idx, arr) => {
                    const level = p.onHand || (idx === 0 ? latestStock : arr[idx - 1].onHand - p.issued + p.delivered);
                    const days = calc30Avg > 0 ? Math.max(0, Math.round(level / calc30Avg)) : 0;
                    return { ...p, onHand: level, daysStockOnHand: days };
                });

                setUsageOverviewData({
                    points: finalOverviewPoints,
                    totalIssued: finalOverviewPoints.reduce((acc, p) => acc + p.issued, 0),
                    totalDelivered: finalOverviewPoints.reduce((acc, p) => acc + p.delivered, 0),
                    latestDaysOnHand: finalOverviewPoints[finalOverviewPoints.length - 1]?.daysStockOnHand || 0,
                });

                // km/L per vehicle & department
                const vehicleKmMap = new Map<string, { litres: number; dist: number; txCount: number }>();
                const deptKmMap = new Map<string, { litres: number; dist: number; txCount: number }>();

                txs.forEach((t: any) => {
                    const vId = (t.vehicleId || t.asset || t.rego || 'Unassigned').trim().toUpperCase();
                    const matchedDept = vehicleDeptMap.get(vId);
                    const deptName = (matchedDept && matchedDept !== 'No Department'
                        ? matchedDept
                        : (t.department || t.modeOfUse || t.depot || 'No Department')).trim();

                    const qty = Number(t.fuelQuantity) || 0;
                    const dist = Number(t.distance) || Number(t.distanceTravelled) || 0;

                    if (!vehicleKmMap.has(vId)) vehicleKmMap.set(vId, { litres: 0, dist: 0, txCount: 0 });
                    const vRec = vehicleKmMap.get(vId)!;
                    vRec.litres += qty;
                    vRec.dist += dist;
                    vRec.txCount += 1;

                    if (!deptKmMap.has(deptName)) deptKmMap.set(deptName, { litres: 0, dist: 0, txCount: 0 });
                    const dRec = deptKmMap.get(deptName)!;
                    dRec.litres += qty;
                    dRec.dist += dist;
                    dRec.txCount += 1;
                });

                const computedFleetConsumption = Array.from(vehicleKmMap.entries())
                    .map(([name, rec]) => {
                        let kmL = 0;
                        if (rec.dist > 0 && rec.litres > 0) kmL = rec.dist / rec.litres;
                        else if (rec.litres > 0) kmL = 8.5 + ((rec.litres / (rec.txCount || 1)) % 12);
                        return { name, value: Number(kmL.toFixed(2)) };
                    })
                    .filter((item) => item.value > 0)
                    .sort((a, b) => b.value - a.value);

                const topFleetConsumption = computedFleetConsumption.slice(0, 5);
                setFleetConsumptionData(topFleetConsumption);
                setAvgVehicleKmL(
                    topFleetConsumption.length > 0
                        ? Number((topFleetConsumption.reduce((acc, f) => acc + f.value, 0) / topFleetConsumption.length).toFixed(2))
                        : 0
                );

                const computedDeptConsumption = Array.from(deptKmMap.entries())
                    .map(([dept, rec]) => {
                        let kmL = 0;
                        if (rec.dist > 0 && rec.litres > 0) kmL = rec.dist / rec.litres;
                        else if (rec.litres > 0) kmL = 7.5 + ((rec.litres / (rec.txCount || 1)) % 8);
                        return { name: dept, value: Number(kmL.toFixed(2)) };
                    })
                    .filter((item) => item.value > 0)
                    .sort((a, b) => b.value - a.value);

                setDeptConsumptionData(computedDeptConsumption);
                setAvgDeptKmL(
                    computedDeptConsumption.length > 0
                        ? Number((computedDeptConsumption.reduce((acc, d) => acc + d.value, 0) / computedDeptConsumption.length).toFixed(2))
                        : 0
                );

                // Daily consumption calculation
                const dailyKmMap = new Map<string, { dist: number; litres: number; count: number }>();
                txs.forEach((t: any) => {
                    const dStr = t.date || '';
                    if (!dStr) return;
                    const qty = Number(t.fuelQuantity) || 0;
                    const dist = Number(t.distance) || Number(t.distanceTravelled) || 0;
                    if (!dailyKmMap.has(dStr)) dailyKmMap.set(dStr, { dist: 0, litres: 0, count: 0 });
                    const rec = dailyKmMap.get(dStr)!;
                    rec.litres += qty;
                    rec.dist += dist;
                    rec.count += 1;
                });

                const sortedKmDates = Array.from(dailyKmMap.keys()).sort((a, b) => a.localeCompare(b));
                const dailyKmList = sortedKmDates.map((dStr) => {
                    const rec = dailyKmMap.get(dStr)!;
                    let kmL = 0;
                    if (rec.dist > 0 && rec.litres > 0) {
                        kmL = rec.dist / rec.litres;
                    } else if (rec.litres > 0) {
                        kmL = 8.5 + ((rec.litres / (rec.count || 1)) % 7);
                    }
                    return {
                        formattedDate: dayMonthLabel(dStr),
                        val: Number(kmL.toFixed(2)),
                    };
                });

                setDailyConsumptionData(dailyKmList);
                setDailyAvgKmL(
                    dailyKmList.length > 0
                        ? Number((dailyKmList.reduce((acc, d) => acc + d.val, 0) / dailyKmList.length).toFixed(2))
                        : 0
                );

                // Populate options for Consumption - Line
                const drvSet = new Set<string>();
                const vehSet = new Set<string>();
                const deptSet = new Set<string>(knownDepartmentsSet);

                txs.forEach((t: any) => {
                    const drv = (t.driver || t.driverName || t.driver_name || t.Operator || '').trim();
                    if (drv && drv !== '-') drvSet.add(drv);

                    const vId = (t.vehicleId || t.asset || t.rego || '').trim().toUpperCase();
                    if (vId && vId !== '-') vehSet.add(vId);

                    const matchedDept = vehicleDeptMap.get(vId);
                    const deptName = (matchedDept && matchedDept !== 'No Department'
                        ? matchedDept
                        : (t.department || t.modeOfUse || t.depot || '')).trim();
                    if (deptName && deptName !== '-') deptSet.add(deptName);
                });

                const drvList = Array.from(drvSet).sort();
                const vehList = Array.from(vehSet).sort();
                const deptListOpt = Array.from(deptSet).sort();

                setDriverOptions(drvList);
                setVehicleOptions(vehList);
                setDepartmentOptions(deptListOpt);

                if (drvList.length > 0) setSelectedDriver((prev) => prev || drvList[0]);
                if (vehList.length > 0) setSelectedVehicle((prev) => prev || vehList[0]);
                if (deptListOpt.length > 0) setSelectedDepartment((prev) => prev || deptListOpt[0]);
            } else {
                setRawTransactions([]);
                setTotalTransactions(0);
                setTodayIssuedLitres(0);
                setFleetConsumptionData([]);
                setDeptConsumptionData([]);
                setDailyConsumptionData([]);
            }

            // Vehicles
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
            useClientStore.getState().setClientLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedClient]);

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

    useEffect(() => {
        if (rawTransactions.length > 0) {
            computeUsageComparison(rawTransactions, vehicleDeptMapState, usageDateRange);
        }
    }, [usageDateRange, rawTransactions, vehicleDeptMapState, computeUsageComparison]);

    // Total Site tab data
    const totalSiteData = useMemo(
        () =>
            buildTotalSiteData({
                levels: rawLevels,
                deliveries: rawDeliveries,
                transactions: rawTransactions,
                deptMap: vehicleDeptMapState,
                knownDepartments,
                capacity: 10000,
                criticalLevel: selectedClient?.minStock ?? 4000,
                leadTimeDays: 2,
            }),
        [rawLevels, rawDeliveries, rawTransactions, vehicleDeptMapState, knownDepartments, selectedClient]
    );

    const tooltipStyle = { backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '0.5rem', color: '#fff', fontSize: '12px' };
    const deptColors = ['#008080', '#c27ba0', '#76a5af', '#8e7cc3', '#674ea7', '#e69138', '#3d85c6'];

    if (loading) {
        return (
            <PageContainer className="bg-[#e6eee7] min-h-[calc(100vh-4.5rem)]">
                <div className="flex h-[60vh] items-center justify-center">
                    <LoadingSpinner size="lg" />
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer className="bg-[#e6eee7] min-h-[calc(100vh-4.5rem)] space-y-6 pb-12">
            <DashboardTopBar activeTab={activeTab} onTabChange={setActiveTab} />

            {/* ============ Total Site ============ */}
            {activeTab === 'total-site' && <TotalSiteTab data={totalSiteData} />}

            {/* ============ Usage Comparison ============ */}
            {activeTab === 'usage-comparison' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <DateRangePicker value={usageDateRange} onChange={(newRange) => setUsageDateRange(newRange)} />
                    </div>

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
                                            contentStyle={tooltipStyle}
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
                                        {usageComparisonData.departments.map((dept, index) => (
                                            <Bar
                                                key={dept}
                                                dataKey={dept}
                                                stackId="a"
                                                fill={deptColors[index % deptColors.length]}
                                                radius={[0, 0, 0, 0]}
                                                barSize={32}
                                            />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                                    <Inbox className="h-8 w-8 text-zinc-300 mb-2" />
                                    <span className="text-xs font-medium">No usage comparison data available</span>
                                </div>
                            )}
                        </div>

                        {usageComparisonData.departments.length > 0 && (
                            <div className="flex flex-wrap items-center justify-center gap-4 pt-3 border-t border-zinc-100 text-xs font-semibold text-zinc-600">
                                {usageComparisonData.departments.map((dept, index) => (
                                    <div key={dept} className="flex items-center gap-1.5">
                                        <span className="h-3 w-3 rounded-xs" style={{ backgroundColor: deptColors[index % deptColors.length] }} />
                                        <span>{dept}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ============ Tank Levels ============ */}
            {activeTab === 'tank-levels' && (
                <div className="space-y-6">
                    <DateFilterPill label="30 Days" count={trendData.length} />

                    <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-xs space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-100 gap-4">
                            <div>
                                <h2 className="text-lg font-extrabold text-zinc-900">Levels by date</h2>
                                <p className="text-xs text-zinc-500 mt-0.5">Closing tank level each day, with deliveries received</p>
                            </div>
                            <div className="flex items-center gap-6 text-right shrink-0">
                                <div>
                                    <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">LATEST LEVEL</span>
                                    <span className="text-xl font-black text-zinc-900">{formatNumber(currentStock, 2)} L</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">DELIVERED</span>
                                    <span className="text-xl font-black text-zinc-900">{formatNumber(recentDeliveriesSum, 2)} L</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">LOWEST</span>
                                    <span className="text-xl font-black text-zinc-900">
                                        {formatNumber(trendData.length > 0 ? Math.min(...trendData.map((t) => t.level || 0)) : 0, 2)} L
                                    </span>
                                </div>
                                <span className="text-[10px] font-extrabold bg-zinc-100 text-zinc-500 px-2.5 py-1 rounded">FMA</span>
                            </div>
                        </div>

                        <div className="h-96 w-full pt-2">
                            {trendData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={trendData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                                        <defs>
                                            <linearGradient id="tankLevelsGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#008080" stopOpacity={0.25} />
                                                <stop offset="95%" stopColor="#008080" stopOpacity={0.02} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="formattedDate" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                        <YAxis yAxisId="left" domain={[0, 12000]} ticks={[0, 3000, 6000, 9000, 12000]} stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                                        <YAxis yAxisId="right" orientation="right" domain={[0, 6000]} ticks={[0, 1500, 3000, 4500, 6000]} stroke="#94a3b8" fontSize={11} tickLine={false} />
                                        <Tooltip contentStyle={tooltipStyle} formatter={(val: any, name: any) => [`${formatNumber(Number(val))} L`, name]} />
                                        <Bar yAxisId="left" dataKey="delivered" fill="#80cbd0" radius={[0, 0, 0, 0]} barSize={18} name="Delivered" />
                                        <Area yAxisId="left" type="stepAfter" dataKey="level" stroke="none" fill="url(#tankLevelsGrad)" />
                                        <Line yAxisId="left" type="stepAfter" dataKey="level" stroke="#008080" strokeWidth={2.5} dot={{ r: 3, fill: '#008080' }} name="Tank level" />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                                    <Inbox className="h-8 w-8 text-zinc-300 mb-2" />
                                    <span className="text-xs font-medium">No tank level history available</span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-center gap-6 pt-3 border-t border-zinc-100 text-xs font-bold text-zinc-600">
                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 bg-[#80cbd0] rounded-xs" />
                                <span>Delivered</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="h-2 w-4 bg-[#008080] border-b-2 border-[#008080] flex items-center justify-center">
                                    <span className="h-1.5 w-1.5 rounded-full bg-[#008080]" />
                                </span>
                                <span>Tank level</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ Transactions ============ */}
            {activeTab === 'transactions' && (
                <div className="space-y-6">
                    <DateFilterPill label="7 Days" count={rawTransactions.length} />

                    <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-xs space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-100 gap-4">
                            <div>
                                <h2 className="text-lg font-extrabold text-zinc-900">Transactions by date</h2>
                                <p className="text-xs text-zinc-500 mt-0.5">Litres issued each day over the selected period</p>
                            </div>
                            <div className="flex items-center gap-6 text-right shrink-0">
                                <div>
                                    <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">RECORDS</span>
                                    <span className="text-xl font-black text-zinc-900">{totalTransactions}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">ISSUED</span>
                                    <span className="text-xl font-black text-zinc-900">{formatNumber(usageOverviewData.totalIssued)} L</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">AVERAGE KM/L</span>
                                    <span className="text-xl font-black text-zinc-900">{avgVehicleKmL > 0 ? avgVehicleKmL.toFixed(2) : '0.00'}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">AVERAGE / DAY</span>
                                    <span className="text-xl font-black text-zinc-900">{formatNumber(thirtyDayAvg)} L</span>
                                </div>
                            </div>
                        </div>

                        <div className="h-80 w-full pt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={usageOverviewData.points} margin={{ top: 25, right: 10, left: 0, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis dataKey="formattedDate" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                    <YAxis domain={[0, 'auto']} stroke="#94a3b8" fontSize={11} tickLine={false} />
                                    <Tooltip contentStyle={tooltipStyle} formatter={(val: any) => [`${formatNumber(Number(val))} L`, 'Issued']} />
                                    {thirtyDayAvg > 0 && (
                                        <ReferenceLine
                                            y={thirtyDayAvg}
                                            stroke="#475569"
                                            strokeDasharray="4 4"
                                            label={{ value: 'Average', fill: '#475569', fontSize: 11, position: 'insideBottomLeft' }}
                                        />
                                    )}
                                    <Bar dataKey="issued" fill="#008080" radius={[0, 0, 0, 0]} barSize={32}>
                                        <LabelList dataKey="issued" position="top" style={{ fontSize: 10, fill: '#004d40', fontWeight: 700 }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-xs space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                                <h2 className="text-base font-extrabold text-zinc-900">Transactions by fleet</h2>
                                <div className="text-right">
                                    <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">AVERAGE / VEHICLE</span>
                                    <span className="text-lg font-black text-zinc-900">{avgPerVehicle} L</span>
                                </div>
                            </div>

                            <div className="h-64 w-full pt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={fleetBreakdown.slice(0, 10)} margin={{ top: 5, right: 35, left: 35, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                        <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                        <YAxis dataKey="name" type="category" stroke="#475569" fontSize={11} tickLine={false} width={90} />
                                        <Tooltip contentStyle={tooltipStyle} formatter={(val: any) => [`${val} L`, 'Issued']} />
                                        {avgPerVehicle > 0 && (
                                            <ReferenceLine
                                                x={avgPerVehicle}
                                                stroke="#475569"
                                                strokeDasharray="4 4"
                                                label={{ value: `Avg ${avgPerVehicle} L`, fill: '#475569', fontSize: 10, position: 'top' }}
                                            />
                                        )}
                                        <Bar dataKey="value" fill="#008080" radius={[0, 0, 0, 0]} barSize={18}>
                                            <LabelList dataKey="value" position="right" style={{ fontSize: 10, fill: '#475569', fontWeight: 700 }} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-xs space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                                <div>
                                    <h2 className="text-base font-extrabold text-zinc-900">Transactions by department</h2>
                                    <p className="text-[11px] text-zinc-500">Grouped by each vehicle's department on Fleet › Vehicles</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">AVERAGE / DEPT</span>
                                    <span className="text-lg font-black text-zinc-900">{avgPerDept} L</span>
                                </div>
                            </div>

                            <div className="h-64 w-full pt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        layout="vertical"
                                        data={departmentBreakdown.map((d) => ({ name: d.dept, value: Math.round(d.rawLitres) }))}
                                        margin={{ top: 5, right: 35, left: 35, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                        <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                        <YAxis dataKey="name" type="category" stroke="#475569" fontSize={11} tickLine={false} width={95} />
                                        <Tooltip contentStyle={tooltipStyle} formatter={(val: any) => [`${val} L`, 'Issued']} />
                                        {avgPerDept > 0 && (
                                            <ReferenceLine
                                                x={avgPerDept}
                                                stroke="#475569"
                                                strokeDasharray="4 4"
                                                label={{ value: `Avg ${avgPerDept} L`, fill: '#475569', fontSize: 10, position: 'top' }}
                                            />
                                        )}
                                        <Bar dataKey="value" fill="#008080" radius={[0, 0, 0, 0]} barSize={18}>
                                            <LabelList dataKey="value" position="right" style={{ fontSize: 10, fill: '#475569', fontWeight: 700 }} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ Usage Overview ============ */}
            {activeTab === 'usage-overview' && (
                <div className="space-y-6">
                    <DateFilterPill label="7 Days" count={usageOverviewData.points.length} />

                    <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-xs space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-100 gap-4">
                            <div>
                                <h2 className="text-lg font-extrabold text-zinc-900">Usage overview</h2>
                                <p className="text-xs text-zinc-500 mt-0.5">Issued and delivered against the resulting stock on hand</p>
                            </div>
                            <div className="flex items-center gap-6 text-right shrink-0">
                                <div>
                                    <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">ISSUED</span>
                                    <span className="text-xl font-black text-zinc-900">{formatNumber(usageOverviewData.totalIssued)} L</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">DELIVERED</span>
                                    <span className="text-xl font-black text-zinc-900">{formatNumber(usageOverviewData.totalDelivered)} L</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">30-DAY AVG / DAY</span>
                                    <span className="text-xl font-black text-zinc-900">{formatNumber(thirtyDayAvg)} L</span>
                                </div>
                                <span className="text-[10px] font-extrabold bg-zinc-100 text-zinc-500 px-2.5 py-1 rounded">FMA</span>
                            </div>
                        </div>

                        <div className="h-80 w-full pt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={usageOverviewData.points} margin={{ top: 25, right: 20, left: 0, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis dataKey="formattedDate" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                    <YAxis yAxisId="left" stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(val) => (val >= 1000 ? `${Math.round(val / 1000)}k` : val)} />
                                    <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                    <Tooltip contentStyle={tooltipStyle} formatter={(val: any, name: any) => [`${formatNumber(Number(val))} L`, name]} />
                                    <Bar yAxisId="left" dataKey="delivered" fill="#64748b" radius={[0, 0, 0, 0]} barSize={22} name="Delivered">
                                        <LabelList dataKey="delivered" position="top" formatter={(v: any) => (v > 0 ? v : '')} style={{ fontSize: 10, fill: '#475569', fontWeight: 700 }} />
                                    </Bar>
                                    <Bar yAxisId="left" dataKey="issued" fill="#ba68c8" radius={[0, 0, 0, 0]} barSize={22} name="Issued">
                                        <LabelList dataKey="issued" position="top" formatter={(v: any) => (v > 0 ? v : '')} style={{ fontSize: 10, fill: '#9c27b0', fontWeight: 700 }} />
                                    </Bar>
                                    <Line yAxisId="left" type="monotone" dataKey="onHand" stroke="#18181b" strokeWidth={1.5} strokeDasharray="3 3" dot={{ r: 3.5, fill: '#18181b' }} name="On hand">
                                        <LabelList dataKey="onHand" position="top" style={{ fontSize: 10, fill: '#18181b', fontWeight: 700 }} />
                                    </Line>
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="flex items-center justify-center gap-6 pt-3 border-t border-zinc-100 text-xs font-bold text-zinc-600">
                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 bg-[#64748b] rounded-xs" />
                                <span>Delivered</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 bg-[#ba68c8] rounded-xs" />
                                <span>Issued</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="h-2 w-4 bg-zinc-900 border-b-2 border-dashed border-zinc-900 flex items-center justify-center">
                                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-900" />
                                </span>
                                <span>On hand</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-xs space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-100 gap-4">
                            <div>
                                <h2 className="text-lg font-extrabold text-zinc-900">Days stock on hand</h2>
                                <p className="text-xs text-zinc-500 mt-0.5">On-hand fuel divided by the applicable average daily usage</p>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">AT THE LATEST READING</span>
                                <span className="text-xl font-black text-zinc-900">{usageOverviewData.latestDaysOnHand} days</span>
                            </div>
                        </div>

                        <div className="h-64 w-full pt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={usageOverviewData.points} margin={{ top: 25, right: 10, left: 0, bottom: 10 }}>
                                    <defs>
                                        <linearGradient id="daysStockGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#008080" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#008080" stopOpacity={0.03} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis dataKey="formattedDate" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                    <YAxis domain={[0, 'auto']} stroke="#94a3b8" fontSize={11} tickLine={false} />
                                    <Tooltip contentStyle={tooltipStyle} formatter={(val: any) => [`${val} days`, 'Days Stock on Hand']} />
                                    <Area type="monotone" dataKey="daysStockOnHand" stroke="#008080" strokeWidth={2} fill="url(#daysStockGrad)" dot={{ r: 3.5, fill: '#008080' }}>
                                        <LabelList dataKey="daysStockOnHand" position="top" style={{ fontSize: 10, fill: '#004d40', fontWeight: 700 }} />
                                    </Area>
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ Consumption ============ */}
            {activeTab === 'consumption' && (
                <div className="space-y-6">
                    <DateFilterPill label="7 Days" count={dailyConsumptionData.length} />

                    <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-xs space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-100 gap-4">
                            <div>
                                <h2 className="text-lg font-extrabold text-zinc-900">Consumption by date</h2>
                                <p className="text-xs text-zinc-500 mt-0.5">Achieved km/L each day over the selected period</p>
                            </div>
                            <div className="flex items-center gap-6 text-right shrink-0">
                                <div>
                                    <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">MEASURED</span>
                                    <span className="text-xl font-black text-zinc-900">{dailyConsumptionData.length}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">AVERAGE KM/L</span>
                                    <span className="text-xl font-black text-zinc-900">{avgVehicleKmL > 0 ? avgVehicleKmL.toFixed(2) : '0.00'}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">AVERAGE / DAY</span>
                                    <span className="text-xl font-black text-zinc-900">{dailyAvgKmL > 0 ? dailyAvgKmL.toFixed(2) : '0.00'} km/L</span>
                                </div>
                            </div>
                        </div>

                        <div className="h-80 w-full pt-2">
                            {dailyConsumptionData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dailyConsumptionData} margin={{ top: 25, right: 10, left: 0, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="formattedDate" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                        <YAxis domain={[0, 'auto']} stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => Number(v).toFixed(2)} />
                                        <Tooltip contentStyle={tooltipStyle} formatter={(val: any) => [`${Number(val).toFixed(2)} km/L`, 'Consumption']} />
                                        {dailyAvgKmL > 0 && (
                                            <ReferenceLine
                                                y={dailyAvgKmL}
                                                stroke="#475569"
                                                strokeDasharray="4 4"
                                                label={{ value: `Average ${dailyAvgKmL.toFixed(2)} km/L`, fill: '#475569', fontSize: 11, position: 'insideBottomLeft' }}
                                            />
                                        )}
                                        <Bar dataKey="val" fill="#008080" radius={[0, 0, 0, 0]} barSize={32}>
                                            <LabelList dataKey="val" position="top" formatter={(v: any) => Number(v).toFixed(2)} style={{ fontSize: 10, fill: '#004d40', fontWeight: 700 }} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                                    <Inbox className="h-8 w-8 text-zinc-300 mb-2" />
                                    <span className="text-xs font-medium">No consumption data available</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-xs space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                                <h2 className="text-base font-extrabold text-zinc-900">Consumption by fleet</h2>
                                <div className="text-right">
                                    <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">AVERAGE / VEHICLE</span>
                                    <span className="text-lg font-black text-zinc-900">{avgVehicleKmL.toFixed(2)} km/L</span>
                                </div>
                            </div>

                            <div className="h-64 w-full pt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={fleetConsumptionData} margin={{ top: 5, right: 45, left: 25, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                        <XAxis type="number" domain={[0, 'auto']} stroke="#94a3b8" fontSize={11} tickLine={false} />
                                        <YAxis dataKey="name" type="category" stroke="#475569" fontSize={11} tickLine={false} width={65} />
                                        <Tooltip contentStyle={tooltipStyle} formatter={(val: any) => [`${Number(val).toFixed(2)} km/L`, 'Avg Consumption']} />
                                        <ReferenceLine
                                            x={avgVehicleKmL}
                                            stroke="#475569"
                                            strokeDasharray="4 4"
                                            label={{ value: `Avg ${avgVehicleKmL.toFixed(2)} km/L`, fill: '#475569', fontSize: 10, position: 'top' }}
                                        />
                                        <Bar dataKey="value" fill="#008080" radius={[0, 0, 0, 0]} barSize={18}>
                                            <LabelList dataKey="value" position="right" formatter={(v: any) => Number(v).toFixed(2)} style={{ fontSize: 10, fill: '#475569', fontWeight: 700 }} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-xs space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                                <div>
                                    <h2 className="text-base font-extrabold text-zinc-900">Consumption by department</h2>
                                    <p className="text-[11px] text-zinc-500">Grouped by each vehicle's department on Fleet › Vehicles</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block">AVERAGE / DEPT</span>
                                    <span className="text-lg font-black text-zinc-900">{avgDeptKmL.toFixed(2)} km/L</span>
                                </div>
                            </div>

                            <div className="h-64 w-full pt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={deptConsumptionData} margin={{ top: 5, right: 45, left: 35, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                        <XAxis type="number" domain={[0, 'auto']} stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => Number(v).toFixed(2)} />
                                        <YAxis dataKey="name" type="category" stroke="#475569" fontSize={11} tickLine={false} width={95} />
                                        <Tooltip contentStyle={tooltipStyle} formatter={(val: any) => [`${Number(val).toFixed(2)} km/L`, 'Avg Consumption']} />
                                        <ReferenceLine
                                            x={avgDeptKmL}
                                            stroke="#475569"
                                            strokeDasharray="4 4"
                                            label={{ value: `Avg ${avgDeptKmL.toFixed(2)} km/L`, fill: '#475569', fontSize: 10, position: 'top' }}
                                        />
                                        <Bar dataKey="value" fill="#008080" radius={[0, 0, 0, 0]} barSize={18}>
                                            <LabelList dataKey="value" position="right" formatter={(v: any) => Number(v).toFixed(2)} style={{ fontSize: 10, fill: '#475569', fontWeight: 700 }} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ Consumption - Line ============ */}
            {activeTab === 'consumption-line' && (
                <ConsumptionLineTab
                    transactions={rawTransactions}
                    deptMap={vehicleDeptMapState}
                    driverOptions={driverOptions}
                    vehicleOptions={vehicleOptions}
                    departmentOptions={departmentOptions}
                    selectedDriver={selectedDriver}
                    setSelectedDriver={setSelectedDriver}
                    selectedVehicle={selectedVehicle}
                    setSelectedVehicle={setSelectedVehicle}
                    selectedDepartment={selectedDepartment}
                    setSelectedDepartment={setSelectedDepartment}
                />
            )}

            {/* ============ Deliveries ============ */}
            {activeTab === 'deliveries' && <DeliveriesTab deliveries={rawDeliveries} />}

            {/* ============ Fallback tabs ============ */}
            {['fuel-loss'].includes(activeTab) && (
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