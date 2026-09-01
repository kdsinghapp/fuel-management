// src/app/reports/[reportId]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AlertTriangle, RefreshCw, Printer, Download, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageContainer } from '@/components/layout/PageContainer';
import { authService } from '@/lib/auth';
import { formatDate, formatDateTime, formatFuel } from '@/lib/utils';

// Mock report data
const mockReportData = {
    id: '1',
    reportId: 'RPT-001',
    title: 'Fuel Transaction Report',
    type: 'Fuel Transaction Report',
    dateRange: { startDate: '2026-07-01', endDate: '2026-07-31' },
    generatedBy: 'Admin User',
    generatedAt: '2026-08-01T10:00:00Z',
    data: [
        { date: '2026-07-01', vehicleId: 'VH-1025', quantity: 45, status: 'Matched' },
        { date: '2026-07-02', vehicleId: 'VH-1008', quantity: 38, status: 'Matched' },
        { date: '2026-07-03', vehicleId: 'VH-1032', quantity: 42, status: 'Matched' },
        { date: '2026-07-04', vehicleId: 'VH-1045', quantity: 35, status: 'Unmatched' },
        { date: '2026-07-05', vehicleId: 'VH-1051', quantity: 52, status: 'Matched' },
    ],
};

export default function ReportPreviewPage() {
    const router = useRouter();
    const params = useParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [report, setReport] = useState<any>(null);

    useEffect(() => {
        const checkAuth = async () => {
            const isAuthenticated = await authService.isAuthenticated();
            if (!isAuthenticated) {
                router.push('/login');
                return;
            }
            // Load mock report data
            setReport(mockReportData);
            setLoading(false);
        };
        checkAuth();
    }, [router, params]);

    const handlePrint = () => {
        window.print();
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

    if (error || !report) {
        return (
            <PageContainer>
                <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                    <AlertTriangle className="h-12 w-12 text-destructive" />
                    <p className="text-lg text-muted-foreground">{error || 'Report not found'}</p>
                    <Button onClick={() => router.push('/reports')}>Back to Reports</Button>
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/reports')}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{report.title}</h1>
                        <p className="text-muted-foreground">
                            Report ID: {report.reportId} • Generated: {formatDateTime(report.generatedAt)}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" />
                        Print
                    </Button>
                    <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Download
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Report Details</CardTitle>
                    <CardDescription>
                        Date Range: {formatDate(report.dateRange.startDate)} - {formatDate(report.dateRange.endDate)}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left p-3 font-medium">Date</th>
                                    <th className="text-left p-3 font-medium">Vehicle ID</th>
                                    <th className="text-left p-3 font-medium">Quantity</th>
                                    <th className="text-left p-3 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.data.map((item: any, index: number) => (
                                    <tr key={index} className="border-b hover:bg-muted/50">
                                        <td className="p-3">{item.date}</td>
                                        <td className="p-3">{item.vehicleId}</td>
                                        <td className="p-3 font-medium">{formatFuel(item.quantity)}</td>
                                        <td className="p-3">
                                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${item.status === 'Matched' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                {item.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </PageContainer>
    );
}