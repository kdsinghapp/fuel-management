// src/app/api/cron/send-scheduled-reports/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { generateReportData, formatReportSubject } from '@/services/reportGeneratorService';
import { sendMicrosoftGraphMail } from '@/lib/microsoftGraph';
import { ReportSchedule, ScheduleExecutionLog } from '@/types/schedule';
import { getPGTTimeInfo } from '@/lib/pgtTime';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const SCHEDULES_FILE = path.join(DATA_DIR, 'schedules.json');
const LOGS_FILE = path.join(DATA_DIR, 'execution_logs.json');

function readSchedules(): ReportSchedule[] {
  try {
    if (!fs.existsSync(SCHEDULES_FILE)) return [];
    return JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeSchedules(schedules: ReportSchedule[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(schedules, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing schedules:', err);
  }
}

function appendLog(log: ScheduleExecutionLog) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    let logs: ScheduleExecutionLog[] = [];
    if (fs.existsSync(LOGS_FILE)) {
      logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8'));
    }
    logs.unshift(log);
    // Keep last 100 logs
    if (logs.length > 100) logs = logs.slice(0, 100);
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error logging schedule execution:', err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const schedules = readSchedules();
    const activeSchedules = schedules.filter((s) => s.enabled);
    
    // Evaluate in Papua New Guinea Time (PGT, UTC+10:00 / Pacific/Port_Moresby)
    const pgt = getPGTTimeInfo();
    const pgtTimeStr = pgt.timeStr; // "HH:mm" in PGT
    const pgtDateStr = pgt.dateStr; // "YYYY-MM-DD" in PGT
    const currentDayOfWeek = pgt.dayOfWeek; // 0=Sun, 1=Mon, ..., 6=Sat
    const currentDayOfMonth = pgt.dayOfMonth;

    // Query parameters
    const { searchParams } = new URL(req.url);
    const forceId = searchParams.get('forceScheduleId');
    const runAll = searchParams.get('runAll') === 'true';
    const clientTime = searchParams.get('clientTime'); // Optional client-reported PGT time (e.g. "08:00")

    const results: any[] = [];

    console.log(
      `[AutoReport Cron - PGT UTC+10] Tick at PGT=${pgtTimeStr} (${pgt.formattedDateTime}), clientTime=${clientTime || 'N/A'}. Active schedules: ${activeSchedules.length}`
    );

    for (const sched of activeSchedules) {
      const isForced = Boolean(forceId && sched.id === forceId);

      // Check if schedule time matches PGT time or client-reported PGT time
      const timeMatches = sched.time === pgtTimeStr || (Boolean(clientTime) && sched.time === clientTime);
      const isDue = isForced || runAll || timeMatches;

      if (!isDue) {
        continue;
      }

      // Frequency eligibility check (for automated scheduled runs in PGT)
      if (!isForced && !runAll) {
        if (sched.frequency === 'weekdays' && (currentDayOfWeek === 0 || currentDayOfWeek === 6)) {
          continue; // Skip weekends in PGT
        }
        if (sched.frequency === 'weekly' && currentDayOfWeek !== (sched.weeklyDay ?? 1)) {
          continue; // Default Monday in PGT
        }
        if (sched.frequency === 'monthly' && currentDayOfMonth !== (sched.monthlyDay ?? 1)) {
          continue; // Default 1st of month in PGT
        }

        // Slot tracking: prevent duplicate executions within the same day/time slot
        const todaySlotKey = `${pgtDateStr}_${sched.time}`;
        if (sched.lastScheduledSlot === todaySlotKey) {
          console.log(`[AutoReport Cron] Schedule "${sched.name}" (${sched.id}) already ran for slot ${todaySlotKey} (PGT). Skipping duplicate.`);
          continue;
        }
      }

      console.log(`[AutoReport Cron] >>> Executing schedule (PGT): "${sched.name}" for client "${sched.clientName}" at ${sched.time} (isForced=${isForced})`);

      const startTime = Date.now();
      try {
        const reportData = await generateReportData(
          sched.clientName,
          sched.reportType,
          sched.datePreset,
          sched.customStartDate,
          sched.customEndDate,
          sched.formats || ['excel', 'pdf']
        );

        const subject = formatReportSubject(
          sched.subjectTemplate,
          reportData.clientName,
          reportData.startDate,
          reportData.endDate,
          sched.reportType,
          reportData.title
        );

        const sendResult = await sendMicrosoftGraphMail({
          to: sched.recipients,
          cc: sched.ccRecipients,
          subject,
          htmlBody: reportData.htmlBody,
          attachments: reportData.attachments,
        });

        const durationMs = Date.now() - startTime;
        const status = sendResult.success ? 'success' : 'failed';
        const message = sendResult.success
          ? `Dispatched successfully to ${sched.recipients.join(', ')}`
          : sendResult.error || 'Failed to send';

        sched.lastRunAt = new Date().toISOString();
        sched.lastRunStatus = status;
        sched.lastRunMessage = message;

        // Mark scheduled slot as executed only on scheduled runs
        if (!isForced) {
          sched.lastScheduledSlot = `${pgtDateStr}_${sched.time}`;
        }

        const logItem: ScheduleExecutionLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          scheduleId: sched.id,
          scheduleName: sched.name,
          clientName: sched.clientName,
          reportType: sched.reportType,
          dateRange: reportData.dateRangeStr,
          recipients: sched.recipients,
          formats: sched.formats,
          status,
          message,
          timestamp: pgt.isoWithOffset,
          durationMs,
        };

        appendLog(logItem);

        results.push({
          scheduleId: sched.id,
          name: sched.name,
          status,
          message,
          durationMs,
        });

        console.log(`[AutoReport Cron] ✓ Schedule "${sched.name}" completed: ${status} in ${durationMs}ms`);
      } catch (runErr: any) {
        sched.lastRunAt = new Date().toISOString();
        sched.lastRunStatus = 'failed';
        sched.lastRunMessage = runErr?.message || 'Error occurred';

        appendLog({
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          scheduleId: sched.id,
          scheduleName: sched.name,
          clientName: sched.clientName,
          reportType: sched.reportType,
          dateRange: sched.datePreset,
          recipients: sched.recipients,
          formats: sched.formats,
          status: 'failed',
          message: runErr?.message || 'Error generating report',
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
        });

        results.push({
          scheduleId: sched.id,
          name: sched.name,
          status: 'failed',
          error: runErr?.message,
        });

        console.error(`[AutoReport Cron] ✗ Error running schedule "${sched.name}":`, runErr);
      }
    }

    writeSchedules(schedules);

    return NextResponse.json({
      success: true,
      processedCount: results.length,
      serverTime: serverTimeStr,
      serverDate: serverDateStr,
      clientTime: clientTime || null,
      results,
    });
  } catch (err: any) {
    console.error('[AutoReport Cron] Fatal error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Cron error' }, { status: 500 });
  }
}
