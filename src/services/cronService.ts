// src/services/cronService.ts
import { generateReportData, formatReportSubject } from '@/services/reportGeneratorService';
import { sendMicrosoftGraphMail } from '@/lib/microsoftGraph';
import { ReportSchedule, ScheduleExecutionLog } from '@/types/schedule';
import { getPGTTimeInfo } from '@/lib/pgtTime';
import { connectToDatabase } from '@/lib/mongodb';
import { ScheduleModel } from '@/models/Schedule';
import { ScheduleLogModel } from '@/models/ScheduleLog';

async function appendExecutionLog(log: ScheduleExecutionLog) {
  try {
    await connectToDatabase();
    await ScheduleLogModel.create(log);
  } catch (err) {
    console.error('Error saving execution log to MongoDB:', err);
  }
}

export interface CronExecutionOptions {
  forceScheduleId?: string | null;
  runAll?: boolean;
  clientTime?: string | null;
}

export async function executeScheduledReportsCron(options: CronExecutionOptions = {}) {
  try {
    await connectToDatabase();

    const rawSchedules = await ScheduleModel.find({}).lean();
    const schedules: ReportSchedule[] = rawSchedules.map((item) => {
      const { _id, __v, ...rest } = item as any;
      return rest as ReportSchedule;
    });

    const activeSchedules = schedules.filter((s) => s.enabled);

    // Evaluate in Papua New Guinea Time (PGT, UTC+10:00 / Pacific/Port_Moresby)
    const pgt = getPGTTimeInfo();
    const pgtTimeStr = pgt.timeStr; // "HH:mm" in PGT
    const pgtDateStr = pgt.dateStr; // "YYYY-MM-DD" in PGT
    const currentDayOfWeek = pgt.dayOfWeek; // 0=Sun, 1=Mon, ..., 6=Sat
    const currentDayOfMonth = pgt.dayOfMonth;

    const { forceScheduleId, runAll, clientTime } = options;
    const results: any[] = [];

    for (const sched of activeSchedules) {
      const isForced = Boolean(forceScheduleId && sched.id === forceScheduleId);

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

        const lastRunAt = new Date().toISOString();
        const lastScheduledSlot = !isForced ? `${pgtDateStr}_${sched.time}` : sched.lastScheduledSlot;

        // Update schedule state in MongoDB
        await ScheduleModel.updateOne(
          { id: sched.id },
          {
            $set: {
              lastRunAt,
              lastRunStatus: status,
              lastRunMessage: message,
              ...(lastScheduledSlot ? { lastScheduledSlot } : {}),
            },
          }
        );

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

        await appendExecutionLog(logItem);

        results.push({
          scheduleId: sched.id,
          name: sched.name,
          status,
          message,
          durationMs,
        });

        console.log(`[AutoReport Cron] ✓ Schedule "${sched.name}" completed: ${status} in ${durationMs}ms`);
      } catch (runErr: any) {
        const errorMessage = runErr?.message || 'Error occurred';

        await ScheduleModel.updateOne(
          { id: sched.id },
          {
            $set: {
              lastRunAt: new Date().toISOString(),
              lastRunStatus: 'failed',
              lastRunMessage: errorMessage,
            },
          }
        );

        await appendExecutionLog({
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

    return {
      success: true,
      processedCount: results.length,
      pgtTime: pgtTimeStr,
      pgtDate: pgtDateStr,
      pgtFormatted: pgt.formattedDateTime,
      clientTime: clientTime || null,
      results,
    };
  } catch (err: any) {
    console.error('[AutoReport Cron] Fatal error:', err);
    return { success: false, error: err?.message || 'Cron error' };
  }
}
