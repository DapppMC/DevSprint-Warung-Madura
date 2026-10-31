/**
 * Utility functions for exporting and downloading archived business documents.
 * Generates RFC 4180 compliant CSV files with BOM for Excel compatibility.
 */

export function downloadCsv(filename: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]): void {
  const sanitize = (val: string | number | boolean | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerRow = headers.map(sanitize).join(',');
  const dataRows = rows.map((row) => row.map(sanitize).join(',')).join('\r\n');
  const csvContent = '\uFEFF' + headerRow + '\r\n' + dataRows;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function printDocumentArchive(title: string, htmlContent: string): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; margin: 24px; color: #1e293b; }
        h1 { font-size: 20px; border-bottom: 2px solid #059669; padding-bottom: 8px; margin-bottom: 16px; }
        .meta { margin-bottom: 16px; font-size: 13px; color: #475569; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
        th { background: #f8fafc; font-weight: 600; }
        .text-right { text-align: right; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
        @media print {
          body { margin: 0; }
          button { display: none; }
        }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      ${htmlContent}
      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
