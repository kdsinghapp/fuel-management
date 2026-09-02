// src/services/reconciliationService.ts
import { Reconciliation, ReconciliationSummary } from '@/types/reconciliation';
import { FilterParams, PaginatedResponse } from '@/types/common';
import { fuelLevelService } from './fuelLevelService';
import { deliveryService } from './deliveryService';
import { fuelIssueService } from './fuelIssueService';
import { calculateReconciliation } from '@/lib/reconciliation';

export const reconciliationService = {
  async getReconciliationRecords(params: FilterParams = {}): Promise<PaginatedResponse<Reconciliation>> {
    try {
      // Fetch data from endpoints with a buffer before startDate so previous day opening balance is always available
      const rawStart = (() => {
        if (params.startDate) {
          const d = new Date(params.startDate + 'T00:00:00');
          if (!isNaN(d.getTime())) {
            d.setDate(d.getDate() - 30);
            return d.toISOString().split('T')[0];
          }
        }
        return '2026-01-01';
      })();

      const levelsRes = await fuelLevelService.getFuelLevels({ pageSize: 100000, startDate: rawStart, endDate: params.endDate });
      const deliveriesRes = await deliveryService.getDeliveries({ pageSize: 100000, startDate: rawStart, endDate: params.endDate });
      const issuesRes = await fuelIssueService.getFuelIssues({ pageSize: 100000, startDate: rawStart, endDate: params.endDate });

      const levels = levelsRes.data;
      const deliveries = deliveriesRes.data;
      const issues = issuesRes.data;

      if (levels.length === 0) {
        return { data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 };
      }

      // Group by date. Let's take unique dates from levels
      const uniqueDates = Array.from(new Set(levels.map(l => l.date)));
      uniqueDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      const records: Reconciliation[] = [];

      for (let i = 0; i < uniqueDates.length - 1; i++) {
        const currentDateStr = uniqueDates[i];
        const prevDateStr = uniqueDates[i + 1];

        // 4 PM to 4 PM interval:
        const prevIntervalStart = new Date(`${prevDateStr}T16:00:00Z`);
        const currentIntervalEnd = new Date(`${currentDateStr}T16:00:00Z`);

        // Find opening level (closest to prevDate 4 PM)
        const prevLevels = levels.filter(l => l.date === prevDateStr);
        // Find closing level (closest to currentDate 4 PM)
        const currentLevels = levels.filter(l => l.date === currentDateStr);

        if (prevLevels.length === 0 || currentLevels.length === 0) continue;

        // Closest to 16:00
        const getClosestTo4PM = (items: typeof levels) => {
          return items.reduce((prev, curr) => {
            const prevDiff = Math.abs(new Date(`${curr.date}T${curr.time}Z`).getTime() - new Date(`${curr.date}T16:00:00Z`).getTime());
            const currDiff = Math.abs(new Date(`${prev.date}T${prev.time}Z`).getTime() - new Date(`${prev.date}T16:00:00Z`).getTime());
            return prevDiff < currDiff ? curr : prev;
          });
        };

        const openingRecord = getClosestTo4PM(prevLevels);
        const closingRecord = getClosestTo4PM(currentLevels);

        const openingBalance = openingRecord.fuelLevel;
        const actualClosing = closingRecord.fuelLevel;

        // Sum deliveries for the current day
        const dayDeliveries = deliveries.filter(d => (d.date ? d.date.split('T')[0] : '') === currentDateStr);
        const totalDeliveries = Number(dayDeliveries.reduce((sum, d) => sum + (Number(d.quantity) || 0), 0).toFixed(2));

        // Sum fuel issues for the current day (matching transactions table)
        const dayIssues = issues.filter(issue => (issue.date ? issue.date.split('T')[0] : '') === currentDateStr);
        const totalIssuesRaw = dayIssues.reduce((sum, issue) => sum + (Number(issue.fuelQuantity) || 0), 0);
        const totalIssuesRounded = dayIssues.reduce((sum, issue) => sum + Math.round((Number(issue.fuelQuantity) || 0) * 10) / 10, 0);
        const totalIssues = Number(
          (Math.abs(totalIssuesRaw - totalIssuesRounded) < 0.15 ? totalIssuesRounded : totalIssuesRaw).toFixed(2)
        );

        const recon = calculateReconciliation({
          openingBalance,
          deliveries: totalDeliveries,
          fuelIssues: totalIssues,
          actualClosing,
        });

        records.push({
          id: currentDateStr,
          date: currentDateStr,
          openingBalance,
          deliveries: totalDeliveries,
          fuelIssues: totalIssues,
          expectedClosing: Number(recon.expectedClosing.toFixed(2)),
          actualClosing,
          variance: Number(recon.variance.toFixed(2)),
          status: recon.status,
          createdAt: `${currentDateStr}T16:00:00Z`,
          updatedAt: `${currentDateStr}T16:00:00Z`,
        });
      }

      // Sort by date descending
      records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Filter by status if specified
      let filteredRecords = [...records];
      if (params.status) {
        filteredRecords = filteredRecords.filter(r => r.status === params.status);
      }

      if (params.startDate) {
        filteredRecords = filteredRecords.filter(r => r.date >= params.startDate!);
      }
      if (params.endDate) {
        filteredRecords = filteredRecords.filter(r => r.date <= params.endDate!);
      }

      const page = params.page || 1;
      const pageSize = params.pageSize || 10;
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const paginatedData = filteredRecords.slice(start, end);

      return {
        data: paginatedData,
        total: filteredRecords.length,
        page,
        pageSize,
        totalPages: Math.ceil(filteredRecords.length / pageSize),
      };
    } catch (err) {
      console.error(err);
      return { data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 };
    }
  },
  
  async getReconciliationById(id: string): Promise<Reconciliation | null> {
    const res = await this.getReconciliationRecords({ page: 1, pageSize: 100 });
    return res.data.find(r => r.id === id) || null;
  },
  
  async calculateReconciliation(
    openingBalance: number,
    deliveries: number,
    fuelIssues: number,
    actualClosing: number
  ): Promise<ReconciliationSummary> {
    const result = calculateReconciliation({
      openingBalance,
      deliveries,
      fuelIssues,
      actualClosing,
    });
    
    return {
      openingBalance,
      deliveries,
      fuelIssues,
      expectedClosing: result.expectedClosing,
      actualClosing,
      variance: result.variance,
      status: result.status,
    };
  },
  
  async getReconciliationSummary(): Promise<ReconciliationSummary> {
    const res = await this.getReconciliationRecords({ page: 1, pageSize: 10 });
    const latest = res.data[0];
    if (latest) {
      return {
        openingBalance: latest.openingBalance,
        deliveries: latest.deliveries,
        fuelIssues: latest.fuelIssues,
        expectedClosing: latest.expectedClosing,
        actualClosing: latest.actualClosing,
        variance: latest.variance,
        status: latest.status,
      };
    }
    return {
      openingBalance: 0,
      deliveries: 0,
      fuelIssues: 0,
      expectedClosing: 0,
      actualClosing: 0,
      variance: 0,
      status: 'Reconciled',
    };
  },
};
