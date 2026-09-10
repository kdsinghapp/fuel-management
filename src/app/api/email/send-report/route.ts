// src/app/api/email/send-report/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { generateReportData } from '@/services/reportGeneratorService';
import { sendMicrosoftGraphMail, testMicrosoftGraphConnection } from '@/lib/microsoftGraph';
import { DateWindowPreset, ReportFormat, ReportType } from '@/types/schedule';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      clientName = 'Digicel POM',
      reportType = 'reconciliation' as ReportType,
      datePreset = 'yesterday' as DateWindowPreset,
      customStartDate,
      customEndDate,
      recipients = [],
      ccRecipients = [],
      formats = ['excel', 'pdf'] as ReportFormat[],
      subjectTemplate,
      credentials,
    } = body;

    if (!recipients || recipients.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one recipient email address is required.' },
        { status: 400 }
      );
    }

    // 1. Generate Report Data & Attachments
    const startTime = Date.now();
    const reportData = await generateReportData(
      clientName,
      reportType,
      datePreset,
      customStartDate,
      customEndDate,
      formats
    );

    // 2. Prepare Subject Line
    const subject =
      subjectTemplate ||
      `⛽ [Automated Report] ${reportData.title} (${reportData.dateRangeStr})`;

    // 3. Dispatch Email via Microsoft Graph API
    const sendResult = await sendMicrosoftGraphMail({
      to: recipients,
      cc: ccRecipients,
      subject,
      htmlBody: reportData.htmlBody,
      attachments: reportData.attachments,
      credentials,
    });

    const durationMs = Date.now() - startTime;

    if (!sendResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: sendResult.error,
          reportTitle: reportData.title,
          recordCount: reportData.rows.length,
          durationMs,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Report successfully dispatched to ${recipients.join(', ')}`,
      reportTitle: reportData.title,
      clientName: reportData.clientName,
      dateRange: reportData.dateRangeStr,
      recordCount: reportData.rows.length,
      attachmentsSent: reportData.attachments.map((a) => a.filename),
      durationMs,
    });
  } catch (err: any) {
    console.error('API Error in send-report:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Internal server error while generating and dispatching report.',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to test Microsoft Graph Connection
export async function GET(req: NextRequest) {
  try {
    const status = await testMicrosoftGraphConnection();
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json(
      { connected: false, error: err?.message || 'Failed to check connection' },
      { status: 500 }
    );
  }
}
