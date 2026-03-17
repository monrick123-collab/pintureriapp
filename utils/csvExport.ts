/**
 * Exports an array of records to a CSV file and triggers browser download.
 * Includes UTF-8 BOM for correct rendering of accented characters in Excel (Spanish locale).
 */
export function exportToCSV(
    filename: string,
    rows: Record<string, any>[],
    headers: { key: string; label: string }[]
): void {
    const BOM = '\ufeff';
    const headerRow = headers.map(h => `"${h.label}"`).join(',');
    const dataRows = rows.map(row =>
        headers.map(h => {
            const val = row[h.key] ?? '';
            return `"${String(val).replace(/"/g, '""')}"`;
        }).join(',')
    );
    const csv = BOM + [headerRow, ...dataRows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}
