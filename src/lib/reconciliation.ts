// src/lib/reconciliation.ts
import { ReconciliationSummary } from '@/types/reconciliation';

interface ReconciliationInput {
  openingBalance: number;
  deliveries: number;
  fuelIssues: number;
  actualClosing: number;
}

export function calculateReconciliation(input: ReconciliationInput): Omit<ReconciliationSummary, 'openingBalance' | 'deliveries' | 'fuelIssues' | 'actualClosing'> {
  const { openingBalance, deliveries, fuelIssues, actualClosing } = input;
  const expectedClosing = openingBalance + deliveries - fuelIssues;
  const variance = actualClosing - expectedClosing;
  const absVariance = Math.abs(variance);

  let status: 'Reconciled' | 'Warning' | 'Exception' = 'Reconciled';
  if (absVariance > 50) {
    status = 'Exception';
  } else if (absVariance > 30) {
    status = 'Warning';
  } else {
    status = 'Reconciled';
  }

  return {
    expectedClosing,
    variance,
    status,
  };
}
