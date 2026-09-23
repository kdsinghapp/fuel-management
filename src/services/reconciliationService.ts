// src/services/reconciliationService.ts
import { Reconciliation, ReconciliationSummary } from '@/types/reconciliation';
import { FilterParams, PaginatedResponse } from '@/types/common';
import { fuelLevelService } from './fuelLevelService';
import { deliveryService } from './deliveryService';
import { fuelIssueService } from './fuelIssueService';
import { calculateReconciliation } from '@/lib/reconciliation';
import { useClientStore, CLIENT_EXTRA_RECON_COLUMNS } from './api';

export const reconciliationService = {
  async getReconciliationRecords(params: FilterParams = {}): Promise<PaginatedResponse<Reconciliation>> {
    try {
      const selectedClient = useClientStore.getState().selectedClient;
      const extraCols = CLIENT_EXTRA_RECON_COLUMNS[selectedClient?.clientid] || CLIENT_EXTRA_RECON_COLUMNS[selectedClient?.name] || [];

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

      const extraIssuesPromises = extraCols.map(col =>
        fuelIssueService.getFuelIssues({
          pageSize: 100000,
          startDate: rawStart,
          endDate: params.endDate,
          clientid: col.clientid,
          divisionid: col.divisionid,
          userid: col.userid
        })
      );

      const [levelsRes, deliveriesRes, issuesRes, ...extraIssuesRes] = await Promise.all([
        fuelLevelService.getFuelLevels({ pageSize: 100000, startDate: rawStart, endDate: params.endDate }),
        deliveryService.getDeliveries({ pageSize: 100000, startDate: rawStart, endDate: params.endDate }),
        fuelIssueService.getFuelIssues({ pageSize: 100000, startDate: rawStart, endDate: params.endDate }),
        ...extraIssuesPromises
      ]);

      const levels = levelsRes.data;
      const deliveries = deliveriesRes.data;
      const issues = issuesRes.data;

      const extraIssuesMap: Record<string, any[]> = {};
      extraCols.forEach((col, idx) => {
        extraIssuesMap[col.id] = extraIssuesRes[idx]?.data || [];
      });

      if (levels.length === 0) {
        return { data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 };
      }

      // Helper to generate all consecutive dates between two YYYY-MM-DD strings
      const getDatesInRange = (startStr: string, endStr: string): string[] => {
        const dates: string[] = [];
        const curr = new Date(startStr + 'T00:00:00');
        const end = new Date(endStr + 'T00:00:00');
        if (isNaN(curr.getTime()) || isNaN(end.getTime())) return [];
        while (curr <= end) {
          dates.push(curr.toISOString().split('T')[0]);
          curr.setDate(curr.getDate() + 1);
        }
        return dates;
      };

      const timeToSeconds = (t?: string) => {
        if (!t) return 0;
        const parts = t.split(':').map(Number);
        return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
      };

      // Determine date range boundaries
      const todayStr = new Date().toISOString().split('T')[0];
      const allDataDates = [
        ...levels.map(l => l.date),
        ...deliveries.map(d => (d.date ? d.date.split('T')[0] : '')),
        ...issues.map(i => (i.date ? i.date.split('T')[0] : ''))
      ].filter(Boolean);

      const minDataDate = allDataDates.length > 0
        ? allDataDates.reduce((min, d) => (d < min ? d : min), allDataDates[0])
        : rawStart;
      const maxDataDate = allDataDates.length > 0
        ? allDataDates.reduce((max, d) => (d > max ? d : max), allDataDates[0])
        : todayStr;

      const genStart = rawStart < minDataDate ? rawStart : minDataDate;
      const genEnd = params.endDate || (maxDataDate > todayStr ? maxDataDate : todayStr);

      const continuousDates = getDatesInRange(genStart, genEnd);
      if (continuousDates.length === 0) {
        return { data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 };
      }

      // Sort all levels by date & time ascending for reliable historical lookups
      const allLevelsSorted = [...levels].sort((a, b) => {
        const diff = a.date.localeCompare(b.date);
        return diff !== 0 ? diff : timeToSeconds(a.time) - timeToSeconds(b.time);
      });

      let lastKnownClosing: number | null = null;
      const allRecords: Reconciliation[] = [];

      for (const currentDateStr of continuousDates) {
        const currentLevels = levels.filter(l => l.date === currentDateStr);
        const sortedLevels = [...currentLevels].sort((a, b) => timeToSeconds(a.time) - timeToSeconds(b.time));

        // Sum deliveries for the current day
        const dayDeliveries = deliveries.filter(d => (d.date ? d.date.split('T')[0] : '') === currentDateStr);
        const totalDeliveries = Number(dayDeliveries.reduce((sum, d) => sum + (Number(d.quantity) || 0), 0).toFixed(2));

        // Sum fuel issues for the current day
        const dayIssues = issues.filter(issue => (issue.date ? issue.date.split('T')[0] : '') === currentDateStr);
        const totalIssuesRaw = dayIssues.reduce((sum, issue) => sum + (Number(issue.fuelQuantity) || 0), 0);
        const totalIssuesRounded = dayIssues.reduce((sum, issue) => sum + Math.round((Number(issue.fuelQuantity) || 0) * 10) / 10, 0);
        const totalIssues = Number(
          (Math.abs(totalIssuesRaw - totalIssuesRounded) < 0.15 ? totalIssuesRounded : totalIssuesRaw).toFixed(2)
        );

        // Sum fuel issues for any extra columns for the current day
        const dayExtraIssues: Record<string, number> = {};
        for (const col of extraCols) {
          const colIssues = extraIssuesMap[col.id] || [];
          const dayColIssues = colIssues.filter(issue => (issue.date ? issue.date.split('T')[0] : '') === currentDateStr);
          const colTotalRaw = dayColIssues.reduce((sum, issue) => sum + (Number(issue.fuelQuantity) || 0), 0);
          const colTotalRounded = dayColIssues.reduce((sum, issue) => sum + Math.round((Number(issue.fuelQuantity) || 0) * 10) / 10, 0);
          const colTotal = Number(
            (Math.abs(colTotalRaw - colTotalRounded) < 0.15 ? colTotalRounded : colTotalRaw).toFixed(2)
          );
          dayExtraIssues[col.id] = colTotal;
        }

        const totalExtraDayIssues = Number(
          Object.values(dayExtraIssues).reduce((sum, v) => sum + (Number(v) || 0), 0).toFixed(2)
        );

        let openingBalance = 0;
        let actualClosing = 0;

        if (sortedLevels.length > 0) {
          // Dip readings recorded for this calendar day
          openingBalance = sortedLevels[0].fuelLevel;
          actualClosing = sortedLevels[sortedLevels.length - 1].fuelLevel;
        } else {
          // No dip readings on this day (e.g. Sunday / holiday / zero issue day / no sensor update)
          if (lastKnownClosing !== null) {
            openingBalance = lastKnownClosing;
          } else {
            // Find closest previous level
            const prior = allLevelsSorted.filter(l => l.date < currentDateStr);
            if (prior.length > 0) {
              openingBalance = prior[prior.length - 1].fuelLevel;
            } else {
              // Fallback to first available reading or 0
              openingBalance = allLevelsSorted.length > 0 ? allLevelsSorted[0].fuelLevel : 0;
            }
          }
          // When no sensor dip reading was taken, actual closing equals opening + deliveries - fuelIssues - extraIssues
          actualClosing = Number((openingBalance + totalDeliveries - totalIssues - totalExtraDayIssues).toFixed(2));
        }

        const recon = calculateReconciliation({
          openingBalance,
          deliveries: totalDeliveries,
          fuelIssues: totalIssues,
          extraIssuesTotal: totalExtraDayIssues,
          actualClosing,
        });

        lastKnownClosing = actualClosing;

        allRecords.push({
          id: currentDateStr,
          date: currentDateStr,
          openingBalance: Number(openingBalance.toFixed(2)),
          deliveries: totalDeliveries,
          fuelIssues: totalIssues,
          extraIssues: dayExtraIssues,
          expectedClosing: Number(recon.expectedClosing.toFixed(2)),
          actualClosing: Number(actualClosing.toFixed(2)),
          variance: Number(recon.variance.toFixed(2)),
          status: recon.status,
          createdAt: `${currentDateStr}T00:00:00Z`,
          updatedAt: `${currentDateStr}T23:59:59Z`,
        });
      }

      // Compute cumulative variance chronologically (ascending order)
      let runningCumulative = 0;
      for (const record of allRecords) {
        runningCumulative += record.variance;
        record.cumulativeVariance = Number(runningCumulative.toFixed(2));
      }

      // Filter to requested date window & status
      let filteredRecords = allRecords;
      if (params.startDate) {
        filteredRecords = filteredRecords.filter(r => r.date >= params.startDate!);
      }
      if (params.endDate) {
        filteredRecords = filteredRecords.filter(r => r.date <= params.endDate!);
      }
      if (params.status) {
        filteredRecords = filteredRecords.filter(r => r.status === params.status);
      }

      // Sort descending (newest date first)
      filteredRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const page = params.page || 1;
      const pageSize = params.pageSize || 50;
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
