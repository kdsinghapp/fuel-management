// src/services/reportGeneratorService.ts
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CLIENTS, ClientConfig } from '@/services/api';
import { DateWindowPreset, ReportType, ReportFormat } from '@/types/schedule';

export interface GeneratedReportResult {
  title: string;
  clientName: string;
  reportType: ReportType;
  dateRangeStr: string;
  startDate: string;
  endDate: string;
  headers: string[];
  rows: any[][];
  summaryKpis: { label: string; value: string | number; color?: string }[];
  htmlBody: string;
  attachments: {
    filename: string;
    contentType: string;
    contentBase64: string;
  }[];
}

export function computeDatesFromPreset(
  preset: DateWindowPreset,
  customStart?: string,
  customEnd?: string
): { startDate: string; endDate: string; label: string } {
  const formatYMD = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const today = new Date();
  const todayStr = formatYMD(today);

  switch (preset) {
    case 'today':
      return { startDate: todayStr, endDate: todayStr, label: `Today (${todayStr})` };

    case 'yesterday': {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      const yestStr = formatYMD(yest);
      return { startDate: yestStr, endDate: yestStr, label: `Yesterday (${yestStr})` };
    }

    case 'last7days': {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      const startStr = formatYMD(d);
      return { startDate: startStr, endDate: todayStr, label: `Last 7 Days (${startStr} to ${todayStr})` };
    }

    case 'last14days': {
      const d = new Date(today);
      d.setDate(d.getDate() - 13);
      const startStr = formatYMD(d);
      return { startDate: startStr, endDate: todayStr, label: `Last 14 Days (${startStr} to ${todayStr})` };
    }

    case 'last30days': {
      const d = new Date(today);
      d.setDate(d.getDate() - 29);
      const startStr = formatYMD(d);
      return { startDate: startStr, endDate: todayStr, label: `Last 30 Days (${startStr} to ${todayStr})` };
    }

    case 'monthToDate': {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const startStr = formatYMD(firstDay);
      return { startDate: startStr, endDate: todayStr, label: `Month to Date (${startStr} to ${todayStr})` };
    }

    case 'lastMonth': {
      const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      const startStr = formatYMD(firstDayLastMonth);
      const endStr = formatYMD(lastDayLastMonth);
      return { startDate: startStr, endDate: endStr, label: `Last Month (${startStr} to ${endStr})` };
    }

    case 'custom':
    default: {
      const start = customStart || todayStr;
      const end = customEnd || todayStr;
      return { startDate: start, endDate: end, label: `${start} to ${end}` };
    }
  }
}

/**
 * Format report email subject according to recommended default template:
 * "{ClientName} Fuel Bowser Reconciliation Report: {FromDate}-{ToDate}"
 */
export function formatReportSubject(
  template: string | undefined,
  clientName: string,
  startDate: string,
  endDate: string,
  reportType: ReportType,
  reportTitle: string
): string {
  if (template && template.trim().length > 0) {
    return template
      .replace(/\{ClientName\}/gi, clientName)
      .replace(/\{FromDate\}/gi, startDate)
      .replace(/\{ToDate\}/gi, endDate)
      .replace(/\{ReportName\}/gi, reportTitle)
      .replace(/\{DateRange\}/gi, `${startDate} to ${endDate}`);
  }

  if (reportType === 'reconciliation') {
    return `${clientName} Fuel Bowser Reconciliation Report: ${startDate}-${endDate}`;
  }

  return `⛽ [Automated Report] ${clientName} - ${reportTitle} (${startDate} to ${endDate})`;
}

// Server-side / API token fetcher for FMA API
let serverCachedToken: string | null = null;
let serverTokenExpiry: number | null = null;

async function getServerFmaToken(): Promise<string> {
  if (serverCachedToken && serverTokenExpiry && Date.now() < serverTokenExpiry) {
    return serverCachedToken;
  }

  const baseUrl = process.env.NEXT_PUBLIC_FMA_API_URL || 'https://api.fmafrica.com:4801';
  const username = process.env.NEXT_PUBLIC_FMA_USERNAME || 'godfrey@mastersystems.com.pg';
  const password = process.env.NEXT_PUBLIC_FMA_PASSWORD || 'cIk_X!VCJ9J.eIyp';

  const res = await fetch(`${baseUrl}/api/Users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: username, password }),
  });

  if (!res.ok) {
    throw new Error('Failed to login to FMA API server');
  }

  const data = await res.json();
  serverCachedToken = data.token;
  serverTokenExpiry = Date.now() + 55 * 60 * 1000;
  return serverCachedToken!;
}

async function serverFmaRequest<T>(endpoint: string, body: any): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_FMA_API_URL || 'https://api.fmafrica.com:4801';
  const token = await getServerFmaToken();

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`FMA API error: ${err}`);
  }

  return response.json() as Promise<T>;
}

// Helper: Fetch raw transactions for a client and date range
async function fetchClientTransactions(client: ClientConfig, startDate: string, endDate: string) {
  const dFrom = new Date(startDate + 'T00:00:00');
  dFrom.setDate(dFrom.getDate() - 30);
  const apiFrom = dFrom.toISOString().split('T')[0];

  const dTo = new Date(endDate + 'T00:00:00');
  dTo.setDate(dTo.getDate() + 30);
  const apiTo = dTo.toISOString().split('T')[0];

  const payload = {
    clientid: client.clientid,
    userid: Number(client.userid),
    divisionid: Number(client.divisionid),
    datefrom: apiFrom,
    dateto: apiTo,
  };

  const response = await serverFmaRequest<any[]>('/api/fmacontrollertrans/GetTransactions', payload);
  const rawList = Array.isArray(response) ? response : [];

  const seen = new Set<string>();
  const list = rawList.reduce((acc: any[], item: any) => {
    const transId = (item.TransactionId ?? '').toString().trim();
    if (transId) {
      if (seen.has(transId)) return acc;
      seen.add(transId);
    }
    acc.push({
      transactionId: transId || `${item.Date}-${item.Time}`,
      date: item.Date,
      time: item.Time,
      vehicleId: item.RegistrationNo || item.Vehicle || '',
      fleetId: item.FleetId || '',
      driverAttendant: item.DriverAttendant || item.Driver || '',
      siteId: item.SiteId !== undefined && item.SiteId !== null ? item.SiteId.toString() : (item.Site || ''),
      depot: item.Depot || '',
      dem: item.DEM || '',
      fuelQuantity: Number(item.Quantity) || 0,
      pump: item.Pump || '1',
      odometer: Number(item.Odometer) || 0,
      engineHours: Number(item.EngineHours) || 0,
      status: item.DEM && item.DEM.toLowerCase().includes('matched') ? 'Matched' : 'Unmatched',
    });
    return acc;
  }, []);

  return list.filter((item) => {
    const itemDate = (item.date || '').split('T')[0];
    return itemDate >= startDate && itemDate <= endDate;
  });
}

// Helper: Fetch deliveries for a client
async function fetchClientDeliveries(client: ClientConfig, startDate: string, endDate: string) {
  const dFrom = new Date(startDate + 'T00:00:00');
  dFrom.setDate(dFrom.getDate() - 30);
  const apiFrom = dFrom.toISOString().split('T')[0];

  const dTo = new Date(endDate + 'T00:00:00');
  dTo.setDate(dTo.getDate() + 30);
  const apiTo = dTo.toISOString().split('T')[0];

  const payload = {
    clientid: Number(client.clientid),
    userid: Number(client.userid),
    divisionid: Number(client.divisionid),
    datefrom: apiFrom,
    dateto: apiTo,
    tankno: 0,
  };

  const response = await serverFmaRequest<any[]>('/api/fmaweldandeliveries/GetDeliveries', payload);
  const rawList = Array.isArray(response) ? response : [];

  const nonAuto = rawList.filter((item: any) => {
    const acronym = (item.Acronym || '').toString().trim().toUpperCase();
    const name = (item.Name || '').toString().trim().toLowerCase();
    return acronym !== 'AD' && name !== 'auto delivery';
  });

  const list = nonAuto.map((item: any) => {
    const rawDate = item['Delivery Start'] || item.Date || item.DeliveryDate || item['Delivery Date'] || '';
    const datePart = rawDate ? rawDate.split('T')[0] : '';
    const timePart = rawDate && rawDate.includes('T') ? rawDate.split('T')[1].slice(0, 8) : (item.Time || '00:00:00');
    return {
      deliveryId: item.pk ? item.pk.toString() : '',
      date: datePart,
      time: timePart,
      quantity: Number(item['Delivery amount'] || item.Quantity || 0),
      supplier: item.Name || item.Supplier || 'Calculated Delivery',
      acronym: item.Acronym || 'CD',
      status: 'Completed',
    };
  });

  return list.filter((item) => item.date >= startDate && item.date <= endDate);
}

// Helper: Fetch tank levels
async function fetchClientTankLevels(client: ClientConfig, startDate: string, endDate: string) {
  const dTo = new Date(endDate + 'T00:00:00');
  dTo.setDate(dTo.getDate() + 1);
  const apiTo = dTo.toISOString().split('T')[0];

  const payload = {
    clientid: Number(client.clientid),
    userid: Number(client.userid),
    divisionid: Number(client.divisionid),
    datefrom: startDate,
    dateto: apiTo,
    tankno: 0,
  };

  const response = await serverFmaRequest<any[]>('/api/fmatanklevels/GetLevels', payload);
  const rawList = Array.isArray(response) ? response : [];

  return rawList.map((item: any) => {
    const percentage = Number(((item.Level / 20000) * 100).toFixed(1));
    const dateStr = item.Date ? item.Date.split('T')[0] : '';
    const timeStr = item.Time || (item.Date && item.Date.includes('T') ? item.Date.split('T')[1].slice(0, 8) : '00:00:00');
    return {
      id: item.Id || item.pk,
      date: dateStr,
      time: timeStr,
      level: item.Level ?? 0,
      percentage,
      status: percentage < 15 ? 'Low' : 'Normal',
    };
  }).filter((item) => item.date >= startDate && item.date <= endDate);
}

/**
 * EXACT Excel generator matching exportToExcel from src/lib/utils.ts
 */
export async function buildExcelAttachmentBuffer(
  headers: string[],
  rows: any[][],
  sheetName = 'Sheet1'
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: false }]
  });

  // Add header row
  const headerRow = worksheet.addRow(headers);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF26522' } // Brand Orange
    };
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFEA580C' } },
      left: { style: 'thin', color: { argb: 'FFEA580C' } },
      bottom: { style: 'thin', color: { argb: 'FFEA580C' } },
      right: { style: 'thin', color: { argb: 'FFEA580C' } }
    };
  });

  // Add data rows
  rows.forEach((row, idx) => {
    const dataRow = worksheet.addRow(row);
    dataRow.height = 21;
    const isEven = idx % 2 === 0;
    dataRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' }
      };
      cell.font = {
        name: 'Calibri',
        size: 10,
        color: { argb: 'FF1E293B' }
      };
      cell.alignment = { vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });
  });

  // Auto-calculate column widths with good spacing
  worksheet.columns.forEach((column, index) => {
    if (index < headers.length) {
      let maxLength = headers[index] ? String(headers[index]).length : 10;
      for (let i = 0; i < Math.min(rows.length, 100); i++) {
        const cellValue = rows[i]?.[index];
        if (cellValue !== undefined && cellValue !== null) {
          const len = String(cellValue).length;
          if (len > maxLength) {
            maxLength = len;
          }
        }
      }
      column.width = Math.min(Math.max(maxLength * 1.25 + 5, 16), 45);
    }
  });

  // Hide unused columns so spreadsheet ends exactly where data ends
  for (let colIdx = headers.length + 1; colIdx <= 40; colIdx++) {
    worksheet.getColumn(colIdx).hidden = true;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer).toString('base64');
}

/**
 * EXACT PDF generator matching exportToPDF from src/lib/utils.ts
 */
export function buildPdfAttachmentBuffer(
  title: string,
  headers: string[],
  rows: any[][],
  metadata?: Record<string, string | number>
): string {
  const isLandscape = headers.length > 5;
  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header Brand & Title
  doc.setFontSize(14);
  doc.setTextColor(242, 101, 34); // Primary Orange #F26522
  doc.setFont('helvetica', 'bold');
  doc.text('FUEL MANAGEMENT SYSTEM', 40, 36);

  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(title, 40, 56);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.setFont('helvetica', 'normal');
  const dateStr = `Export Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  doc.text(dateStr, pageWidth - 40, 36, { align: 'right' });
  doc.text(`Total Records: ${rows.length}`, pageWidth - 40, 50, { align: 'right' });

  // Divider line
  doc.setDrawColor(242, 101, 34);
  doc.setLineWidth(1.5);
  doc.line(40, 66, pageWidth - 40, 66);

  let startY = 80;

  // Metadata block if present
  if (metadata && Object.keys(metadata).length > 0) {
    const metaEntries = Object.entries(metadata);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(40, startY, pageWidth - 80, 28, 4, 4, 'FD');

    const colWidth = (pageWidth - 80) / metaEntries.length;
    metaEntries.forEach(([key, val], idx) => {
      const x = 50 + idx * colWidth;
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'bold');
      doc.text(String(key).toUpperCase(), x, startY + 11);

      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(String(val), x, startY + 22);
    });

    startY += 38;
  }

  // Generate Table
  autoTable(doc, {
    head: [headers],
    body: rows.map(r => r.map(c => (c === null || c === undefined ? '' : String(c)))),
    startY: startY,
    margin: { left: 40, right: 40, top: 40, bottom: 40 },
    theme: 'grid',
    headStyles: {
      fillColor: [242, 101, 34],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 5,
    },
    styles: {
      fontSize: 8,
      cellPadding: 4.5,
      textColor: [51, 65, 85],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: (data) => {
      // Footer page numbering
      const totalPages = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${data.pageNumber} of ${totalPages}  •  Fuel Management System`,
        pageWidth - 40,
        pageHeight - 20,
        { align: 'right' }
      );
    },
  });

  const pdfArrayBuffer = doc.output('arraybuffer');
  return Buffer.from(pdfArrayBuffer).toString('base64');
}

// Generate complete report package with attachments
export async function generateReportData(
  clientName: string,
  reportType: ReportType,
  preset: DateWindowPreset,
  customStart?: string,
  customEnd?: string,
  requestedFormats: ReportFormat[] = ['excel', 'pdf']
): Promise<GeneratedReportResult> {
  const { startDate, endDate, label: dateRangeStr } = computeDatesFromPreset(preset, customStart, customEnd);

  // Determine which client config to use
  const targetClient = CLIENTS.find((c) => c.name.toLowerCase() === clientName.toLowerCase()) || CLIENTS[0];
  const actualClientName = clientName === 'ALL' ? 'All Clients (Consolidated)' : targetClient.name;

  let headers: string[] = [];
  let rows: any[][] = [];
  let summaryKpis: { label: string; value: string | number; color?: string }[] = [];
  let reportTitle = '';
  let sheetName = 'Sheet1';
  let pdfMetadata: Record<string, string | number> = {
    Client: actualClientName,
    Period: dateRangeStr,
  };

  let reconSummaryData: any = null;
  let reconFilteredRecords: any[] = [];
  let yesterdayTransactions: any[] = [];

  // 1. RECONCILIATION REPORT (Matches reconciliation/page.tsx EXACTLY)
  if (reportType === 'reconciliation') {
    reportTitle = `Reconciliation Report - ${actualClientName}`;
    sheetName = 'Reconciliation';
    headers = ['Date', 'Opening', 'Deliveries', 'Fuel Issued', 'Expected Closing', 'Actual Closing', 'Daily Variance', 'Variance %'];

    const rawStart = (() => {
      const d = new Date(startDate + 'T00:00:00');
      d.setDate(d.getDate() - 15);
      return d.toISOString().split('T')[0];
    })();

    const [levels, deliveries, issues] = await Promise.all([
      fetchClientTankLevels(targetClient, rawStart, endDate),
      fetchClientDeliveries(targetClient, rawStart, endDate),
      fetchClientTransactions(targetClient, rawStart, endDate),
    ]);

    const uniqueDates = Array.from(new Set(levels.map((l) => l.date)));
    uniqueDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    const reconRecords: any[] = [];
    for (let i = 0; i < uniqueDates.length - 1; i++) {
      const curDate = uniqueDates[i];
      const prevDate = uniqueDates[i + 1];

      const prevLevels = levels.filter((l) => l.date === prevDate);
      const curLevels = levels.filter((l) => l.date === curDate);
      if (prevLevels.length === 0 || curLevels.length === 0) continue;

      const opening = prevLevels[prevLevels.length - 1].level;
      const actualClosing = curLevels[curLevels.length - 1].level;

      const dayDelivs = deliveries.filter((d) => d.date === curDate);
      const totalDeliv = Number(dayDelivs.reduce((s, d) => s + (d.quantity || 0), 0).toFixed(2));

      const dayIssues = issues.filter((is) => is.date === curDate);
      const totalIssues = Number(dayIssues.reduce((s, is) => s + (is.fuelQuantity || 0), 0).toFixed(2));

      const expected = opening + totalDeliv - totalIssues;
      const variance = Number((actualClosing - expected).toFixed(2));
      const status = Math.abs(variance) <= 50 ? 'Reconciled' : 'Exception';

      reconRecords.push({
        date: curDate,
        openingBalance: opening,
        deliveries: totalDeliv,
        fuelIssues: totalIssues,
        expectedClosing: Number(expected.toFixed(2)),
        actualClosing,
        variance,
        status,
      });
    }

    const filtered = reconRecords.filter((r) => r.date >= startDate && r.date <= endDate);

    rows = filtered.map((record) => {
      const vPercent = record.openingBalance > 0 ? (record.variance / record.openingBalance) * 100 : 0;
      return [
        record.date,
        record.openingBalance,
        record.deliveries,
        record.fuelIssues,
        record.expectedClosing,
        record.actualClosing,
        `${record.variance >= 0 ? '+' : ''}${record.variance}`,
        `${vPercent >= 0 ? '+' : ''}${vPercent.toFixed(1)}%`
      ];
    });

    const totalIssued = Number(filtered.reduce((s, r) => s + r.fuelIssues, 0).toFixed(2));
    const totalDelivered = Number(filtered.reduce((s, r) => s + r.deliveries, 0).toFixed(2));
    const netVariance = Number(filtered.reduce((s, r) => s + r.variance, 0).toFixed(2));

    reconFilteredRecords = filtered;

    reconFilteredRecords = filtered;

    if (filtered.length > 0) {
      const sorted = [...filtered].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const openingDip = sorted[0]?.openingBalance || 0;
      const closingDip = sorted[sorted.length - 1]?.actualClosing || 0;
      const closingStock = openingDip + totalDelivered - totalIssued;
      const variance = Number((closingDip - closingStock).toFixed(2));
      const variancePercent = closingStock > 0 ? (variance / closingStock) * 100 : 0;
      const avDailyCons = filtered.length > 0 ? totalIssued / filtered.length : 0;
      const daysStock = avDailyCons > 0 ? Math.round(closingDip / avDailyCons) : 0;
      const today = new Date();
      const reorderDays = 7;
      const minStock = targetClient.minStock || Math.round(avDailyCons * reorderDays) || 5000;
      const reorderDateObj = new Date(today);
      reorderDateObj.setDate(today.getDate() + Math.max(0, daysStock - reorderDays));
      const arrivalDateObj = new Date(reorderDateObj);
      arrivalDateObj.setDate(reorderDateObj.getDate() + 7);

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const formatShortDate = (d: Date) => `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear().toString().slice(-2)}`;

      reconSummaryData = {
        openingDip,
        totalIssues: totalIssued,
        totalDeliveries: totalDelivered,
        closingDip,
        closingStock,
        variance,
        variancePercent,
        avDailyCons,
        daysStock,
        minStock,
        reorderDays,
        reorderDate: formatShortDate(reorderDateObj),
        arrivalDate: formatShortDate(arrivalDateObj),
      };

      // Get transactions for yesterday or latest day
      const yesterdayDate = (() => {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        return y.toISOString().split('T')[0];
      })();

      let yTxs = issues.filter((t) => t.date === yesterdayDate);
      if (yTxs.length === 0 && issues.length > 0) {
        const dates = Array.from(new Set(issues.map((t) => t.date))).sort().reverse();
        if (dates.length > 0) {
          yTxs = issues.filter((t) => t.date === dates[0]);
        }
      }
      yTxs.sort((a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime());
      yesterdayTransactions = yTxs.slice(0, 15);

      rows.push([
        'TOTALS / NET',
        '',
        `+${totalDelivered}`,
        `-${totalIssued}`,
        '',
        '',
        `${netVariance >= 0 ? '+' : ''}${netVariance}`,
        `${filtered[0]?.openingBalance ? ((netVariance / filtered[0].openingBalance) * 100).toFixed(1) : '0.0'}%`
      ]);
    }

    pdfMetadata = {
      Client: actualClientName,
      Period: dateRangeStr,
      'Total Deliveries': `${totalDelivered} L`,
      'Total Issued': `${totalIssued} L`,
      'Net Variance': `${netVariance >= 0 ? '+' : ''}${netVariance} L`,
    };

    summaryKpis = [
      { label: 'Total Fuel Issued', value: `${totalIssued.toLocaleString()} L`, color: '#f26522' },
      { label: 'Total Deliveries', value: `${totalDelivered.toLocaleString()} L`, color: '#10b981' },
      { label: 'Net Variance', value: `${netVariance > 0 ? '+' : ''}${netVariance.toLocaleString()} L`, color: Math.abs(netVariance) > 50 ? '#ef4444' : '#10b981' },
      { label: 'Days Reconciled', value: `${filtered.filter((r) => r.status === 'Reconciled').length} / ${filtered.length}`, color: '#6366f1' },
    ];
  }

  // 2. FUEL ISSUES / TRANSACTIONS REPORT (Matches fuel-issues/page.tsx EXACTLY)
  else if (reportType === 'fuel-issues') {
    reportTitle = `Fuel Issues Report - ${actualClientName}`;
    sheetName = 'Fuel Issues';
    headers = ['Date', 'Time', 'ID', 'Vehicle Req', 'Fleet Id', 'Site', 'Litres', 'Pump', 'Odo Meter', 'DEM/Status'];

    const txs = await fetchClientTransactions(targetClient, startDate, endDate);
    txs.sort((a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime());

    rows = txs.map((issue) => [
      issue.date,
      issue.time,
      issue.transactionId,
      issue.vehicleId,
      issue.fleetId,
      issue.siteId || issue.depot,
      issue.fuelQuantity,
      issue.pump,
      issue.odometer,
      issue.dem || issue.status
    ]);

    const totalLitres = txs.reduce((s, t) => s + t.fuelQuantity, 0);
    const matchedCount = txs.filter((t) => t.status === 'Matched').length;

    pdfMetadata = {
      Client: actualClientName,
      Period: dateRangeStr,
      'Total Transactions': txs.length,
      'Total Volume': `${totalLitres.toLocaleString()} L`,
    };

    summaryKpis = [
      { label: 'Total Transactions', value: txs.length, color: '#6366f1' },
      { label: 'Total Volume Issued', value: `${totalLitres.toLocaleString()} L`, color: '#f26522' },
      { label: 'Matched DEMs', value: `${matchedCount} (${txs.length ? Math.round((matchedCount / txs.length) * 100) : 0}%)`, color: '#10b981' },
      { label: 'Unmatched', value: txs.length - matchedCount, color: txs.length - matchedCount > 0 ? '#ef4444' : '#10b981' },
    ];
  }

  // 3. DELIVERIES REPORT (Matches deliveries/page.tsx EXACTLY)
  else if (reportType === 'deliveries') {
    reportTitle = `Fuel Deliveries Report - ${actualClientName}`;
    sheetName = 'Deliveries';
    headers = ['Delivery ID', 'Date', 'Time', 'Quantity (L)', 'Name', 'Acronym'];

    const delivs = await fetchClientDeliveries(targetClient, startDate, endDate);
    delivs.sort((a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime());

    rows = delivs.map((d) => [
      d.deliveryId,
      d.date,
      d.time,
      d.quantity,
      d.supplier || 'Calculated Delivery',
      d.acronym || 'CD',
    ]);

    const totalDelivered = delivs.reduce((s, d) => s + d.quantity, 0);

    pdfMetadata = {
      Client: actualClientName,
      Period: dateRangeStr,
      'Total Batches': delivs.length,
      'Total Volume': `${totalDelivered.toLocaleString()} L`,
    };

    summaryKpis = [
      { label: 'Total Deliveries', value: delivs.length, color: '#6366f1' },
      { label: 'Total Fuel Received', value: `${totalDelivered.toLocaleString()} L`, color: '#10b981' },
      { label: 'Avg per Delivery', value: delivs.length ? `${Math.round(totalDelivered / delivs.length).toLocaleString()} L` : '0 L', color: '#f26522' },
    ];
  }

  // 4. FUEL LEVELS REPORT (Matches fuel-levels/page.tsx EXACTLY)
  else if (reportType === 'fuel-levels') {
    reportTitle = `Fuel Levels Report - ${actualClientName}`;
    sheetName = 'Fuel Levels';
    headers = ['Date', 'Time', 'Fuel Level (L)', 'Percentage (%)', 'Status'];

    const levels = await fetchClientTankLevels(targetClient, startDate, endDate);
    levels.sort((a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime());

    const minStock = targetClient.minStock || 5000;

    rows = levels.map((level) => [
      level.date,
      level.time,
      level.level,
      `${level.percentage}%`,
      level.status,
    ]);

    const latest = levels[0];

    pdfMetadata = {
      Client: actualClientName,
      Period: dateRangeStr,
      'Current Level': latest ? `${latest.level.toLocaleString()} L` : 'N/A',
      'Capacity': latest ? `${latest.percentage}%` : 'N/A',
    };

    summaryKpis = [
      { label: 'Current Level', value: latest ? `${latest.level.toLocaleString()} L` : 'N/A', color: '#f26522' },
      { label: 'Current Capacity', value: latest ? `${latest.percentage}%` : 'N/A', color: latest && latest.percentage < 20 ? '#ef4444' : '#10b981' },
      { label: 'Min Stock Level', value: `${minStock.toLocaleString()} L`, color: '#6366f1' },
      { label: 'Total Readings', value: levels.length, color: '#64748b' },
    ];
  }

  // 5. FUEL EFFICIENCY REPORT (Matches vehicles/page.tsx EXACTLY)
  else if (reportType === 'fuel-efficiency') {
    reportTitle = `Vehicle Fuel Efficiency Report - ${actualClientName}`;
    sheetName = 'Fuel Efficiency';
    headers = [
      'Date',
      'Time',
      'ID',
      'Vehicle Req',
      'Fleet Id',
      'Site',
      'DEM/Status',
      'Litres',
      'Pump',
      'Odo Meter',
      'Previous Odo',
      'Distance',
      'Consumption (km/L)',
      'L/100km',
      'Standard Burn Rate',
      'Variance',
      'Variance %'
    ];

    const txs = await fetchClientTransactions(targetClient, startDate, endDate);

    // Group by vehicle to calculate odometers and burn rates chronologically
    const vehicleMap = new Map<string, any[]>();
    txs.forEach((tx) => {
      const vKey = (tx.vehicleId || tx.fleetId || 'General').trim();
      if (!vehicleMap.has(vKey)) vehicleMap.set(vKey, []);
      vehicleMap.get(vKey)!.push(tx);
    });

    const efficiencyRows: any[] = [];
    vehicleMap.forEach((items) => {
      items.sort((a, b) => new Date(`${a.date}T${a.time || '00:00:00'}`).getTime() - new Date(`${b.date}T${b.time || '00:00:00'}`).getTime());
      let prevOdo: number | null = null;

      items.forEach((tx) => {
        const currentOdo = Number(tx.odometer) || 0;
        const litres = Number(tx.fuelQuantity) || 0;
        let distance: number | null = null;
        let consumption: number | null = null;
        let recordedPrevOdo: number | null = null;
        let ltrPer100Km: number | null = null;
        let stdRate: number = 7.0;
        let variance: number | null = null;
        let variancePct: number | null = null;

        if (prevOdo !== null && prevOdo > 0 && currentOdo > 0 && currentOdo >= prevOdo) {
          distance = currentOdo - prevOdo;
          recordedPrevOdo = prevOdo;
          if (distance > 0 && litres > 0) {
            consumption = Number((distance / litres).toFixed(2));
            ltrPer100Km = Number(((litres / distance) * 100).toFixed(2));
          }
        } else if (prevOdo !== null && prevOdo > 0) {
          recordedPrevOdo = prevOdo;
        }

        if (currentOdo > 0) prevOdo = currentOdo;

        if (consumption != null && consumption > 0) {
          variance = Number((stdRate - consumption).toFixed(2));
          variancePct = Number(((variance / stdRate) * 100).toFixed(1));
        }

        efficiencyRows.push([
          tx.date,
          tx.time,
          tx.transactionId,
          tx.vehicleId,
          tx.fleetId || '-',
          tx.siteId || tx.depot || '-',
          tx.dem || tx.status || '-',
          litres,
          tx.pump || '1',
          currentOdo > 0 ? currentOdo : '-',
          recordedPrevOdo != null && recordedPrevOdo > 0 ? Number(recordedPrevOdo.toFixed(2)) : '-',
          distance != null && distance > 0 ? Number(distance.toFixed(2)) : '-',
          consumption != null && consumption > 0 ? Number(consumption.toFixed(2)) : '-',
          ltrPer100Km != null && ltrPer100Km > 0 ? Number(ltrPer100Km.toFixed(2)) : '-',
          stdRate != null && stdRate > 0 ? Number(stdRate.toFixed(2)) : '-',
          variance != null ? (variance > 0 ? `+${variance.toFixed(2)}` : Number(variance.toFixed(2))) : '-',
          variancePct != null ? (variancePct > 0 ? `+${variancePct.toFixed(1)}%` : `${variancePct.toFixed(1)}%`) : '-'
        ]);
      });
    });

    // Sort descending by date/time
    efficiencyRows.sort((a, b) => new Date(`${b[0]}T${b[1] || '00:00:00'}`).getTime() - new Date(`${a[0]}T${a[1] || '00:00:00'}`).getTime());
    rows = efficiencyRows;

    const totalLitres = txs.reduce((s, t) => s + t.fuelQuantity, 0);

    pdfMetadata = {
      Client: actualClientName,
      Period: dateRangeStr,
      'Active Fleet': vehicleMap.size,
      'Total Fuel': `${totalLitres.toLocaleString()} L`,
    };

    summaryKpis = [
      { label: 'Active Vehicles', value: vehicleMap.size, color: '#6366f1' },
      { label: 'Total Fleet Consumption', value: `${totalLitres.toLocaleString()} L`, color: '#f26522' },
      { label: 'Total Transactions', value: txs.length, color: '#10b981' },
    ];
  }

  // 6. FUEL LIMITS REPORT (Matches fuel-limits/page.tsx EXACTLY)
  else if (reportType === 'fuel-limits') {
    reportTitle = `Fuel Limits Summary Report - ${actualClientName}`;
    sheetName = 'Fuel Limits';
    headers = ['Vehicle Req', 'Fleet Id', 'Department', 'Fuel Quantity (L)', 'Odo Meter', 'Consumption (km/L)', 'L/100km', 'Standard BRate', 'Monthly Allowance', 'Monthly Usage', 'Balance', 'Allowance %', 'Status'];

    const txs = await fetchClientTransactions(targetClient, startDate, endDate);
    const vehicleMap = new Map<string, any[]>();
    txs.forEach((tx) => {
      const vKey = (tx.vehicleId || tx.fleetId || 'General').trim();
      if (!vehicleMap.has(vKey)) vehicleMap.set(vKey, []);
      vehicleMap.get(vKey)!.push(tx);
    });

    const vRecords: any[] = [];
    vehicleMap.forEach((items, vehicle) => {
      const totalQty = items.reduce((s, it) => s + it.fuelQuantity, 0);
      const allowance = 1500;
      const balance = allowance - totalQty;
      const allowPct = Number(((totalQty / allowance) * 100).toFixed(1));

      vRecords.push([
        vehicle,
        items[0]?.fleetId || '-',
        items[0]?.depot || 'General',
        Number(totalQty.toFixed(1)),
        items[items.length - 1]?.odometer || '-',
        '-',
        '-',
        '7.00',
        allowance,
        Number(totalQty.toFixed(1)),
        balance > 0 ? balance : 0,
        `${allowPct}%`,
        allowPct > 100 ? 'Breached' : allowPct > 80 ? 'Warning' : 'Normal'
      ]);
    });

    rows = vRecords;

    pdfMetadata = {
      Client: actualClientName,
      Period: dateRangeStr,
      'Total Assets': vRecords.length,
    };

    summaryKpis = [
      { label: 'Monitored Assets', value: vRecords.length, color: '#6366f1' },
      { label: 'Normal Status', value: vRecords.filter(r => r[12] === 'Normal').length, color: '#10b981' },
      { label: 'Exceeded Limits', value: vRecords.filter(r => r[12] === 'Breached').length, color: '#ef4444' },
    ];
  }

  // 7. MASTER OPERATIONS SUMMARY
  else {
    reportTitle = `Fuel Operations Summary Report - ${actualClientName}`;
    sheetName = 'Operations Summary';
    headers = ['Metric / Component', 'Quantity / Value', 'Period Summary', 'Status / Health'];

    const [levels, deliveries, txs] = await Promise.all([
      fetchClientTankLevels(targetClient, startDate, endDate),
      fetchClientDeliveries(targetClient, startDate, endDate),
      fetchClientTransactions(targetClient, startDate, endDate),
    ]);

    const totalIssued = txs.reduce((s, t) => s + t.fuelQuantity, 0);
    const totalDelivered = deliveries.reduce((s, d) => s + d.quantity, 0);
    const latestLevel = levels[0] ? levels[0].level : 0;
    const minStock = targetClient.minStock || 5000;

    rows = [
      ['Current Tank Fuel Level', `${latestLevel.toLocaleString()} L`, `Capacity: ${levels[0] ? levels[0].percentage : 0}%`, latestLevel < minStock ? 'Low Stock Alert' : 'Healthy'],
      ['Total Deliveries Received', `${totalDelivered.toLocaleString()} L`, `${deliveries.length} delivery batches`, 'Completed'],
      ['Total Fuel Dispatched / Issued', `${totalIssued.toLocaleString()} L`, `${txs.length} total transactions`, 'Active'],
      ['Matched DEM Transactions', `${txs.filter((t) => t.status === 'Matched').length}`, `Out of ${txs.length} transactions`, 'Matched'],
      ['Active Fleet Assets Serviced', `${new Set(txs.map((t) => t.vehicleId)).size} Vehicles`, 'Fleet distribution', 'Normal'],
    ];

    pdfMetadata = {
      Client: actualClientName,
      Period: dateRangeStr,
      'Current Stock': `${latestLevel.toLocaleString()} L`,
      'Total Issued': `${totalIssued.toLocaleString()} L`,
    };

    summaryKpis = [
      { label: 'Current Tank Stock', value: `${latestLevel.toLocaleString()} L`, color: '#f26522' },
      { label: 'Total Fuel Issued', value: `${totalIssued.toLocaleString()} L`, color: '#f59e0b' },
      { label: 'Deliveries Received', value: `${totalDelivered.toLocaleString()} L`, color: '#10b981' },
      { label: 'Total Transactions', value: txs.length, color: '#6366f1' },
    ];
  }

  // Build Recommended Email Body matching Handover Specification
  let htmlBody = '';

  if (reportType === 'reconciliation' && reconSummaryData) {
    const sData = reconSummaryData;

    // Reconciliation table rows
    const reconRowsHtml = reconFilteredRecords
      .map((r, idx) => {
        const isEven = idx % 2 === 0;
        const vPercent = r.expectedClosing > 0 ? (r.variance / r.expectedClosing) * 100 : 0;
        const vColor = r.variance >= 0 ? '#15803d' : '#b91c1c';
        const isDelivPos = r.deliveries > 0;
        return `
          <tr style="background-color: ${isEven ? '#ffffff' : '#fff9f5'}; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 7px 10px; font-weight: 700; color: #1e293b;">${r.date}</td>
            <td style="padding: 7px 10px; text-align: right; color: #334155;">${Number(r.openingBalance).toLocaleString()} L</td>
            <td style="padding: 7px 10px; text-align: right; font-weight: 700; color: ${isDelivPos ? '#15803d' : '#64748b'};">+${Number(r.deliveries).toLocaleString()} L</td>
            <td style="padding: 7px 10px; text-align: right; font-weight: 700; color: #ea580c;">-${Number(r.fuelIssues).toLocaleString()} L</td>
            <td style="padding: 7px 10px; text-align: right; color: #334155;">${Number(r.expectedClosing).toLocaleString()} L</td>
            <td style="padding: 7px 10px; text-align: right; font-weight: 700; color: #1e293b;">${Number(r.actualClosing).toLocaleString()} L</td>
            <td style="padding: 7px 10px; text-align: right; font-weight: 800; color: ${vColor};">${r.variance >= 0 ? '+' : ''}${r.variance} L</td>
            <td style="padding: 7px 10px; text-align: right; font-weight: 800; color: ${vColor};">${vPercent >= 0 ? '+' : ''}${vPercent.toFixed(1)}%</td>
          </tr>
        `;
      })
      .join('');

    // Yesterday's transaction rows
    const yestRowsHtml = yesterdayTransactions.length > 0
      ? yesterdayTransactions
          .map((tx, idx) => {
            const isEven = idx % 2 === 0;
            const isMatched = tx.status === 'Matched' || (tx.vehicleId && tx.vehicleId.length > 2);
            return `
              <tr style="background-color: ${isEven ? '#ffffff' : '#fff9f5'}; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 6px 8px; color: #475569; font-size: 11px;">${tx.date} ${tx.time}</td>
                <td style="padding: 6px 8px; font-weight: 700; color: #0f172a; font-size: 11px;">${tx.transactionId || tx.id}</td>
                <td style="padding: 6px 8px; font-weight: 700; color: ${isMatched ? '#15803d' : '#64748b'}; font-size: 11px;">${tx.vehicleId || '—'}</td>
                <td style="padding: 6px 8px; color: #64748b; font-size: 11px;">${tx.fleetId || '—'}</td>
                <td style="padding: 6px 8px; color: #475569; font-size: 11px;">${tx.siteId || tx.depot || targetClient.clientid || '2591'}</td>
                <td style="padding: 6px 8px; font-weight: 700; text-align: right; color: #0f172a; font-size: 11px;">${Number(tx.fuelQuantity || 0).toFixed(1)} L</td>
                <td style="padding: 6px 8px; text-align: center; color: #475569; font-size: 11px;">${tx.pump || '1'}</td>
                <td style="padding: 6px 8px; color: #64748b; font-size: 11px;">${tx.odometer && tx.odometer !== '0' ? tx.odometer : '—'}</td>
                <td style="padding: 6px 8px; font-size: 10px;">
                  ${
                    isMatched
                      ? `<span style="color: #15803d; font-weight: 700;">▲ ${tx.dem || 'Driver Tag Matched by Trip'}</span>`
                      : `<span style="color: #ea580c; font-weight: 700;">♦ ${tx.dem || 'ST500 Blue Driver Key'}</span>`
                  }
                </td>
              </tr>
            `;
          })
          .join('')
      : `
        <tr>
          <td colspan="9" style="padding: 16px; text-align: center; color: #94a3b8; font-size: 12px; background: #fafafa;">
            No transactions recorded for yesterday.
          </td>
        </tr>
      `;

    htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${actualClientName} Fuel Bowser Reconciliation Report</title>
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b;">
  <div style="max-width: 900px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #cbd5e1; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08);">
    
    <!-- Top Greeting Section -->
    <div style="padding: 24px 28px 16px 28px; border-bottom: 1px solid #e2e8f0;">
      <p style="margin: 0 0 10px 0; font-size: 15px; font-weight: 700; color: #0f172a;">
        Hi ${actualClientName} Team,
      </p>
      <p style="margin: 0; font-size: 13px; color: #334155; line-height: 1.6;">
        Please find attached the <strong>${actualClientName}</strong> Fuel Bowser Reconciliation Report covering <strong>${startDate}</strong> to <strong>${endDate}</strong>.
      </p>
    </div>

    <!-- Content Area -->
    <div style="padding: 20px 28px 28px 28px;">
      
      <!-- 2 Column Side-by-Side Summary Grid -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
        <tr>
          <!-- STOCK RECONCILIATION SUMMARY (Orange Header) -->
          <td width="48%" valign="top" style="padding-right: 12px;">
            <table width="100%" cellpadding="6" cellspacing="0" style="border-collapse: collapse; font-size: 11px; border: 1px solid #ea580c; border-radius: 6px; overflow: hidden;">
              <thead>
                <tr>
                  <th colspan="2" style="background: #ea580c; color: #ffffff; text-align: center; font-size: 12px; font-weight: 800; padding: 8px 10px; letter-spacing: 0.5px; text-transform: uppercase;">
                    STOCK RECONCILIATION SUMMARY
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid #fed7aa; background: #fffaf5;">
                  <td style="padding: 6px 10px; font-weight: 700; color: #7c2d12;">Opening Dip</td>
                  <td style="padding: 6px 10px; text-align: right; font-weight: 700; color: #1e293b;">${Number(sData.openingDip).toLocaleString()}</td>
                </tr>
                <tr style="border-bottom: 1px solid #fed7aa;">
                  <td style="padding: 6px 10px; font-weight: 700; color: #7c2d12;">Fuel Issues</td>
                  <td style="padding: 6px 10px; text-align: right; font-weight: 700; color: #ea580c;">${Number(sData.totalIssues).toLocaleString()}</td>
                </tr>
                <tr style="border-bottom: 1px solid #fed7aa; background: #fffaf5;">
                  <td style="padding: 6px 10px; font-weight: 700; color: #7c2d12;">Fuel Receipts</td>
                  <td style="padding: 6px 10px; text-align: right; font-weight: 700; color: #16a34a;">${Number(sData.totalDeliveries).toLocaleString()}</td>
                </tr>
                <tr style="border-bottom: 1px solid #fed7aa;">
                  <td style="padding: 6px 10px; font-weight: 700; color: #7c2d12;">Closing Dip</td>
                  <td style="padding: 6px 10px; text-align: right; font-weight: 700; color: #1e293b;">${Number(sData.closingDip).toLocaleString()}</td>
                </tr>
                <tr style="border-bottom: 1px solid #fed7aa; background: #fffaf5;">
                  <td style="padding: 6px 10px; font-weight: 700; color: #7c2d12;">Closing Stock</td>
                  <td style="padding: 6px 10px; text-align: right; font-weight: 700; color: #1e293b;">${Number(sData.closingStock).toLocaleString()}</td>
                </tr>
                <tr style="border-bottom: 1px solid #fed7aa;">
                  <td style="padding: 6px 10px; font-weight: 700; color: #7c2d12;">Variance</td>
                  <td style="padding: 6px 10px; text-align: right; font-weight: 800; color: ${sData.variance >= 0 ? '#15803d' : '#b91c1c'};">${sData.variance >= 0 ? '+' : ''}${sData.variance.toLocaleString()}</td>
                </tr>
                <tr style="background: #fffaf5;">
                  <td style="padding: 6px 10px; font-weight: 700; color: #7c2d12;">%</td>
                  <td style="padding: 6px 10px; text-align: right; font-weight: 800; color: ${sData.variancePercent >= 0 ? '#15803d' : '#b91c1c'};">${sData.variancePercent >= 0 ? '+' : ''}${sData.variancePercent.toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </td>

          <!-- STOCK DEMAND PLAN (Green Header) -->
          <td width="52%" valign="top" style="padding-left: 12px;">
            <table width="100%" cellpadding="6" cellspacing="0" style="border-collapse: collapse; font-size: 11px; border: 1px solid #16a34a; border-radius: 6px; overflow: hidden;">
              <thead>
                <tr>
                  <th colspan="3" style="background: #15803d; color: #ffffff; text-align: center; font-size: 12px; font-weight: 800; padding: 8px 10px; letter-spacing: 0.5px; text-transform: uppercase;">
                    STOCK DEMAND PLAN
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid #bbf7d0; background: #f0fdf4;">
                  <td style="padding: 6px 8px; font-weight: 700; color: #14532d;">Stock</td>
                  <td style="padding: 6px 8px; text-align: center; font-weight: 700; color: #1e293b;">${Number(sData.closingDip).toLocaleString()}</td>
                  <td style="padding: 6px 8px; color: #64748b; font-size: 10px;">Balance remaining in the tank.</td>
                </tr>
                <tr style="border-bottom: 1px solid #bbf7d0;">
                  <td style="padding: 6px 8px; font-weight: 700; color: #14532d;">Av Daily Cons.</td>
                  <td style="padding: 6px 8px; text-align: center; font-weight: 700; color: #1e293b;">${Math.round(sData.avDailyCons).toLocaleString()}</td>
                  <td style="padding: 6px 8px; color: #64748b; font-size: 10px;">Average Fuel Consumption/Day MTD.</td>
                </tr>
                <tr style="border-bottom: 1px solid #bbf7d0; background: #f0fdf4;">
                  <td style="padding: 6px 8px; font-weight: 700; color: #14532d;">Days Stock</td>
                  <td style="padding: 6px 8px; text-align: center; font-weight: 700; color: #1e293b;">${sData.daysStock}</td>
                  <td style="padding: 6px 8px; color: #64748b; font-size: 10px;">Days left before Stock run Out based on listed rate.</td>
                </tr>
                <tr style="border-bottom: 1px solid #bbf7d0;">
                  <td style="padding: 6px 8px; font-weight: 700; color: #14532d;">Min Stock</td>
                  <td style="padding: 6px 8px; text-align: center; font-weight: 700; color: #1e293b;">${Number(sData.minStock).toLocaleString()}</td>
                  <td style="padding: 6px 8px; color: #64748b; font-size: 10px;">Critical Tank Level for Main Tank.</td>
                </tr>
                <tr style="border-bottom: 1px solid #bbf7d0; background: #f0fdf4;">
                  <td style="padding: 6px 8px; font-weight: 700; color: #14532d;">Re-Order</td>
                  <td style="padding: 6px 8px; text-align: center; font-weight: 700; color: #1e293b;">${sData.reorderDays}</td>
                  <td style="padding: 6px 8px; color: #64748b; font-size: 10px;">Days to prepare for New Purchase.</td>
                </tr>
                <tr style="border-bottom: 1px solid #bbf7d0;">
                  <td style="padding: 6px 8px; font-weight: 700; color: #14532d;">Re-Order</td>
                  <td style="padding: 6px 8px; text-align: center; font-weight: 700; color: #1e293b;">${sData.reorderDate}</td>
                  <td style="padding: 6px 8px; color: #64748b; font-size: 10px;">Placing ST order Date</td>
                </tr>
                <tr style="background: #f0fdf4;">
                  <td style="padding: 6px 8px; font-weight: 700; color: #14532d;">Stock Arrival</td>
                  <td style="padding: 6px 8px; text-align: center; font-weight: 700; color: #1e293b;">${sData.arrivalDate}</td>
                  <td style="padding: 6px 8px; color: #64748b; font-size: 10px;">Delivery of stock Date</td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </table>

      <!-- Daily Reconciliation Table -->
      <table width="100%" cellpadding="6" cellspacing="0" style="border-collapse: collapse; font-size: 11px; margin-bottom: 24px; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden;">
        <thead>
          <tr style="color: #ffffff; font-size: 11px; font-weight: 700;">
            <th style="background: #0f172a; padding: 8px 10px; border: 1px solid #334155; text-align: left;">Date</th>
            <th style="background: #0f172a; padding: 8px 10px; border: 1px solid #334155; text-align: right;">Opening Balance</th>
            <th style="background: #15803d; padding: 8px 10px; border: 1px solid #16a34a; text-align: right;">Deliveries</th>
            <th style="background: #ea580c; padding: 8px 10px; border: 1px solid #f97316; text-align: right;">Fuel Issues</th>
            <th style="background: #0f172a; padding: 8px 10px; border: 1px solid #334155; text-align: right;">Expected Closing</th>
            <th style="background: #0f172a; padding: 8px 10px; border: 1px solid #334155; text-align: right;">Actual Closing</th>
            <th style="background: #0f172a; padding: 8px 10px; border: 1px solid #334155; text-align: right;">Variance</th>
            <th style="background: #0f172a; padding: 8px 10px; border: 1px solid #334155; text-align: right;">Variance %</th>
          </tr>
        </thead>
        <tbody>
          ${reconRowsHtml}
        </tbody>
      </table>

      <!-- Yesterday's Transaction Summary -->
      <div style="margin-top: 24px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 800; color: #0f172a; letter-spacing: 0.2px;">
          Yesterday's Transaction Summary
        </h3>
        <table width="100%" cellpadding="6" cellspacing="0" style="border-collapse: collapse; font-size: 11px; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden;">
          <thead>
            <tr style="color: #ffffff; font-size: 11px; font-weight: 700; text-align: left;">
              <th style="background: #ea580c; padding: 8px 8px; border: 1px solid #f97316;">Date / Time</th>
              <th style="background: #0f172a; padding: 8px 8px; border: 1px solid #334155;">ID</th>
              <th style="background: #15803d; padding: 8px 8px; border: 1px solid #16a34a;">Vehicle Reg</th>
              <th style="background: #15803d; padding: 8px 8px; border: 1px solid #16a34a;">Fleet Id</th>
              <th style="background: #15803d; padding: 8px 8px; border: 1px solid #16a34a;">Site</th>
              <th style="background: #15803d; padding: 8px 8px; border: 1px solid #16a34a; text-align: right;">Litres</th>
              <th style="background: #0f172a; padding: 8px 8px; border: 1px solid #334155; text-align: center;">Pump</th>
              <th style="background: #0f172a; padding: 8px 8px; border: 1px solid #334155;">Odo/Meter</th>
              <th style="background: #0f172a; padding: 8px 8px; border: 1px solid #334155;">DEM</th>
            </tr>
          </thead>
          <tbody>
            ${yestRowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Sign-Off & Footer -->
      <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #334155; line-height: 1.6;">
        <p style="margin: 0 0 16px 0;">Kindly contact us should you have any queries regarding the report.</p>
        <p style="margin: 0; font-weight: 700; color: #0f172a;">Sincere regards,</p>
        <p style="margin: 4px 0 0 0; font-weight: 600; color: #ea580c;">Fuel Management Dispatcher</p>
        <p style="margin: 2px 0 0 0; color: #64748b; font-weight: 500;">Master Systems (PNG) Ltd</p>
      </div>

    </div>
  </div>
</body>
</html>
    `;
  } else {
    // Standard template for other reports
    htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .container { max-width: 760px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #ff9f1c 0%, #f26522 100%); color: #ffffff; padding: 24px 28px; text-align: left; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 4px 0 0 0; font-size: 13px; opacity: 0.95; font-weight: 500; }
    .meta-bar { background: #0f172a; color: #94a3b8; padding: 10px 28px; font-size: 12px; display: flex; justify-content: space-between; border-bottom: 1px solid #334155; }
    .content { padding: 28px; }
    .greeting { font-size: 14px; margin-bottom: 16px; color: #334155; line-height: 1.5; }
    .kpi-grid { display: table; width: 100%; margin-bottom: 20px; }
    .kpi-card { display: table-cell; width: 25%; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center; }
    .kpi-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 700; margin-bottom: 4px; }
    .kpi-val { font-size: 17px; font-weight: 800; }
    .section-title { font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th { background: #f26522; color: #ffffff; font-weight: 700; text-align: left; padding: 8px 10px; border: 1px solid #ea580c; font-size: 11px; text-transform: uppercase; }
    td { padding: 7px 10px; border: 1px solid #e2e8f0; color: #334155; }
    tr:nth-child(even) td { background-color: #f8fafc; }
    .badge { display: inline-block; padding: 2px 7px; font-size: 10px; font-weight: 700; border-radius: 10px; }
    .badge-success { background: #dcfce7; color: #15803d; }
    .badge-warn { background: #fef3c7; color: #b45309; }
    .badge-danger { background: #fee2e2; color: #b91c1c; }
    .footer { background: #f8fafc; padding: 16px 28px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; }
    .signoff { margin-top: 24px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #475569; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⛽ FUEL MASTER AUTOMATED REPORT</h1>
      <p>${reportTitle}</p>
    </div>
    <div class="meta-bar">
      <span><strong>Client:</strong> ${actualClientName}</span> &nbsp;|&nbsp;
      <span><strong>Date Window:</strong> ${dateRangeStr}</span>
    </div>

    <div class="content">
      <div class="greeting">
        <p style="margin: 0 0 6px 0; font-weight: 700; color: #0f172a;">Hi ${actualClientName} Team,</p>
        <p style="margin: 0;">Please find attached the <strong>${actualClientName}</strong> ${reportTitle} covering <strong>${startDate}</strong> to <strong>${endDate}</strong>.</p>
      </div>

      <div class="kpi-grid">
        ${summaryKpis
          .map(
            (k) => `
          <div class="kpi-card" style="margin-right: 8px;">
            <div class="kpi-title">${k.label}</div>
            <div class="kpi-val" style="color: ${k.color || '#f26522'};">${k.value}</div>
          </div>
        `
          )
          .join('')}
      </div>

      <div class="section-title">📊 Report Summary (${rows.length} records)</div>
      <table>
        <thead>
          <tr>
            ${headers.map((h) => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows
            .slice(0, 15)
            .map(
              (r) => `
            <tr>
              ${r
                .map((cell, idx) => {
                  if (idx === r.length - 1 && typeof cell === 'string') {
                    const isSuccess = ['Reconciled', 'Matched', 'Normal', 'Optimal', 'Completed', 'Healthy'].includes(cell);
                    const isDanger = ['Exception', 'Unmatched', 'Low', 'High Burn', 'Low Stock Alert', 'Breached'].includes(cell);
                    const badgeClass = isSuccess ? 'badge-success' : isDanger ? 'badge-danger' : 'badge-warn';
                    return `<td><span class="badge ${badgeClass}">${cell}</span></td>`;
                  }
                  return `<td>${cell !== null && cell !== undefined ? cell : '-'}</td>`;
                })
                .join('')}
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      ${
        rows.length > 15
          ? `<p style="font-size: 11px; color: #64748b; margin-top: 6px;">* Showing top 15 records. Download the attached Excel / PDF file for the complete dataset of ${rows.length} rows.</p>`
          : ''
      }

      <div class="signoff">
        <p style="margin: 0 0 12px 0;">Kindly contact us should you have any queries regarding the report.</p>
        <p style="margin: 0; font-weight: 700; color: #0f172a;">Sincere regards,</p>
        <p style="margin: 2px 0 0 0; font-weight: 600; color: #ea580c;">Fuel Management Dispatcher</p>
        <p style="margin: 1px 0 0 0; color: #64748b;">Master Systems (PNG) Ltd</p>
      </div>
    </div>

    <div class="footer">
      This is an automated report dispatched by Fuel Management System via Microsoft 365.<br>
      © ${new Date().getFullYear()} Fuel Master • Master Systems • All rights reserved.
    </div>
  </div>
</body>
</html>
    `;
  }

  // Attachments generation using EXACT export styles
  const attachments: { filename: string; contentType: string; contentBase64: string }[] = [];
  const safeFilenamePrefix = `${reportType}_${actualClientName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${startDate}_${endDate}`;

  // 1. Generate Excel Attachment (Identical to exportToExcel)
  if (requestedFormats.includes('excel')) {
    try {
      const excelBase64 = await buildExcelAttachmentBuffer(headers, rows, sheetName);
      attachments.push({
        filename: `${safeFilenamePrefix}.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        contentBase64: excelBase64,
      });
    } catch (err) {
      console.error('Failed to generate Excel attachment:', err);
    }
  }

  // 2. Generate PDF Attachment (Identical to exportToPDF)
  if (requestedFormats.includes('pdf')) {
    try {
      const pdfBase64 = buildPdfAttachmentBuffer(reportTitle, headers, rows, pdfMetadata);
      attachments.push({
        filename: `${safeFilenamePrefix}.pdf`,
        contentType: 'application/pdf',
        contentBase64: pdfBase64,
      });
    } catch (pdfErr) {
      console.error('Failed to generate PDF attachment:', pdfErr);
    }
  }

  // 3. Generate CSV Attachment (Identical to exportToCSV)
  if (requestedFormats.includes('csv')) {
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((val) => {
            if (val === null || val === undefined) return '""';
            const str = String(val);
            if (str.includes(',') || str.includes('\n') || str.includes('"')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(',')
      ),
    ].join('\n');

    const csvBase64 = Buffer.from('\uFEFF' + csvContent, 'utf-8').toString('base64');
    attachments.push({
      filename: `${safeFilenamePrefix}.csv`,
      contentType: 'text/csv',
      contentBase64: csvBase64,
    });
  }

  return {
    title: reportTitle,
    clientName: actualClientName,
    reportType,
    dateRangeStr,
    startDate,
    endDate,
    headers,
    rows,
    summaryKpis,
    htmlBody,
    attachments,
  };
}
