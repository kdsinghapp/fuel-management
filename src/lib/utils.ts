// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

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

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function exportToExcel(filename: string, headers: string[], rows: any[][], sheetName = 'Sheet1') {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#F26522" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="RowEven">
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="RowOdd">
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(sheetName)}">
  <Table>
   <Row ss:Height="24" ss:StyleID="Header">
    ${headers.map(h => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join('')}
   </Row>
   ${rows.map((row, idx) => `
    <Row ss:StyleID="${idx % 2 === 0 ? 'RowEven' : 'RowOdd'}">
     ${row.map(val => {
       const isNum = typeof val === 'number' && !isNaN(val);
       return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${escapeXml(String(val ?? ''))}</Data></Cell>`;
     }).join('')}
    </Row>
   `).join('')}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const fileWithExt = filename.endsWith('.xls') ? filename : `${filename.replace(/\.[^/.]+$/, '')}.xls`;
  link.setAttribute('download', fileWithExt);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToPDF(
  title: string,
  headers: string[],
  rows: any[][],
  metadata?: Record<string, string | number>
) {
  const metaHtml = metadata && Object.keys(metadata).length > 0
    ? `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; padding: 12px 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 12px;">
        ${Object.entries(metadata)
          .map(
            ([key, val]) =>
              `<div><span style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; display: block;">${key}</span><span style="color: #0f172a; font-weight: 700; font-size: 13px;">${val}</span></div>`
          )
          .join('')}
      </div>`
    : '';

  const tableRows = rows
    .map(
      (row, idx) =>
        `<tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          ${row
            .map(
              (cell) =>
                `<td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 11px; color: #334155;">${cell ?? ''}</td>`
            )
            .join('')}
        </tr>`
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          @page {
            size: landscape;
            margin: 10mm;
          }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 24px;
            background: #ffffff;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #f26522;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .brand {
            font-size: 16px;
            font-weight: 800;
            color: #f26522;
            letter-spacing: -0.5px;
          }
          .title {
            font-size: 20px;
            font-weight: 700;
            color: #0f172a;
            margin-top: 4px;
          }
          .date {
            font-size: 11px;
            color: #64748b;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
          }
          th {
            background-color: #f26522;
            color: #ffffff;
            font-size: 11px;
            font-weight: 700;
            text-align: left;
            padding: 9px 12px;
            border: 1px solid #ea580c;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          td {
            padding: 8px 12px;
            border: 1px solid #e2e8f0;
            font-size: 11px;
            color: #334155;
          }
          .footer {
            margin-top: 24px;
            font-size: 10px;
            color: #94a3b8;
            text-align: right;
            border-top: 1px solid #e2e8f0;
            padding-top: 8px;
          }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">FUEL MANAGEMENT</div>
            <div class="title">${title}</div>
          </div>
          <div style="text-align: right;">
            <div class="date">Export Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            <div class="date">Total Records: ${rows.length}</div>
          </div>
        </div>
        ${metaHtml}
        <table>
          <thead>
            <tr>
              ${headers.map((h) => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        <div class="footer">
          Fuel Management System • Generated automatically
        </div>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  }
}
