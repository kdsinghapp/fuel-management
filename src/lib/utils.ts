// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatNumber(num: number, decimals: number = 0): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCurrency(amount: number): string {
  return `$${formatNumber(amount, 2)}`;
}

export function formatFuel(amount: number): string {
  return `${formatNumber(amount, 1)} L`;
}

export function getStatusColor(status: string): string {
  const statusMap: Record<string, string> = {
    'Normal': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
    'Reconciled': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
    'Matched': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
    'Active': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
    'Warning': 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
    'Pending': 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
    'Exception': 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30',
    'Unmatched': 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30',
    'Inactive': 'bg-slate-500/10 text-slate-600 border-slate-500/20 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/30',
    'Cancelled': 'bg-slate-500/10 text-slate-600 border-slate-500/20 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/30',
    'Completed': 'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/30',
    'Information': 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:bg-indigo-500/15 dark:text-indigo-400 dark:border-indigo-500/30',
  };
  return statusMap[status] || 'bg-slate-500/10 text-slate-600 border-slate-500/20';
}

export function getStatusIcon(status: string): string {
  const iconMap: Record<string, string> = {
    'Normal': 'CheckCircle',
    'Reconciled': 'CheckCircle',
    'Matched': 'CheckCircle',
    'Active': 'CheckCircle',
    'Warning': 'AlertTriangle',
    'Pending': 'Clock',
    'Exception': 'XCircle',
    'Unmatched': 'XCircle',
    'Inactive': 'MinusCircle',
  };
  return iconMap[status] || 'Circle';
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function exportToCSV(filename: string, headers: string[], rows: any[][]) {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(val => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(','))
  ].join('\n');

  // Prepend UTF-8 BOM (\uFEFF) so Excel opens CSV in UTF-8 properly without garbled characters (â€“, â€", etc.)
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportToExcel(filename: string, headers: string[], rows: any[][], sheetName = 'Sheet1') {
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

  // Export buffer and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const fileWithExt = filename.endsWith('.xlsx') ? filename : `${filename.replace(/\.[^/.]+$/, '')}.xlsx`;
  link.setAttribute('download', fileWithExt);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToPDF(
  title: string,
  headers: string[],
  rows: any[][],
  metadata?: Record<string, string | number>
) {
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

  // Direct download
  const cleanFilename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(cleanFilename);
}
