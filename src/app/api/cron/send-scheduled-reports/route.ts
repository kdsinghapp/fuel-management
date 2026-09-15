// src/app/api/cron/send-scheduled-reports/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { executeScheduledReportsCron } from '@/services/cronService';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const forceScheduleId = searchParams.get('forceScheduleId');
    const runAll = searchParams.get('runAll') === 'true';
    const clientTime = searchParams.get('clientTime');

    const result = await executeScheduledReportsCron({
      forceScheduleId,
      runAll,
      clientTime,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (err: any) {
    console.error('[AutoReport Cron Route] Error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Cron error' }, { status: 500 });
  }
}
