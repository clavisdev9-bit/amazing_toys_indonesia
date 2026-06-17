import * as XLSX from 'xlsx';

/**
 * Export data to Excel (.xlsx).
 * @param {string} filename - without extension
 * @param {Array<{ name: string, rows: Array<object> }>} sheets
 */
export function exportToExcel(filename, sheets) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
