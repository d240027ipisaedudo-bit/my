type Row = Record<string, string | number | boolean | null>;

function escapeCsv(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportToCsv(filename: string, headers: string[], rows: Row[]): void {
  const headerLine = headers.join(',');
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCsv(row[h] ?? null)).join(',')
  );
  const csv = [headerLine, ...dataLines].join('\n');
  downloadBlob(filename, csv, 'text/csv;charset=utf-8;');
}

export function exportToExcel(filename: string, headers: string[], rows: Row[]): void {
  const xmlHeader = '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n';
  const tableHeader = `<Table xmlns="urn:schemas-microsoft-com:office:spreadsheet">\n`;
  const headerRow = `<Row>${headers.map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join('')}</Row>\n`;
  const dataRows = rows
    .map(
      (row) =>
        `<Row>${headers
          .map((h) => {
            const val = row[h];
            const isNum = typeof val === 'number';
            return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${escapeXml(String(val ?? ''))}</Data></Cell>`;
          })
          .join('')}</Row>`
    )
    .join('\n');
  const xml = `${xmlHeader}${tableHeader}${headerRow}${dataRows}\n</Table>`;
  downloadBlob(filename, xml, 'application/vnd.ms-excel;charset=utf-8;');
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function downloadBlob(filename: string, content: string, mime: string): void {
  const blob = new Blob(['\ufeff' + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export function exportToPdf(title: string, subtitle: string, headers: string[], rows: Row[], options?: { summary?: { label: string; value: string }[] }): void {
  const win = window.open('', '_blank');
  if (!win) return;
  const dateStr = new Date().toLocaleString('es-DO');
  const summaryHtml = options?.summary
    ? `<div class="summary">${options.summary.map((s) => `<div class="summary-item"><span>${s.label}</span><strong>${s.value}</strong></div>`).join('')}</div>`
    : '';

  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>
    @page { margin: 1.5cm; }
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
    body { color: #1a1d29; padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #f97316; padding-bottom: 16px; margin-bottom: 20px; }
    .header h1 { font-size: 22px; color: #1a1d29; }
    .header .subtitle { color: #6b7280; font-size: 13px; margin-top: 4px; }
    .header .date { color: #6b7280; font-size: 12px; text-align: right; }
    .summary { display: flex; gap: 24px; margin-bottom: 20px; flex-wrap: wrap; }
    .summary-item { background: #f8fafc; border-left: 3px solid #f97316; padding: 10px 16px; border-radius: 4px; }
    .summary-item span { display: block; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
    .summary-item strong { font-size: 18px; color: #1a1d29; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #1a1d29; color: white; padding: 10px 12px; text-align: left; font-weight: 600; }
    th:first-child { border-radius: 4px 0 0 4px; }
    th:last-child { border-radius: 0 4px 4px 0; }
    td { padding: 9px 12px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) td { background: #f8fafc; }
    tr:hover td { background: #fff7ed; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 11px; text-align: center; }
    @media print { body { padding: 0; } .header { page-break-after: avoid; } tr { page-break-inside: avoid; } }
  </style></head><body>
  <div class="header">
    <div><h1>${title}</h1><div class="subtitle">${subtitle}</div></div>
    <div class="date">Generado el ${dateStr}</div>
  </div>
  ${summaryHtml}
  <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${headers.map((h) => `<td>${r[h] ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table>
  <div class="footer">Sistema de Nómina Profesional · NovaCorp · Documento generado automáticamente</div>
  <script>setTimeout(() => window.print(), 300);</script>
  </body></html>`);
  win.document.close();
}

export function printPayslip(htmlContent: string): void {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(htmlContent);
  win.document.close();
}
