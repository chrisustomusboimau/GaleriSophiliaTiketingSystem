/**
 * src/utils/excel.ts
 * ----------------------------------------------------
 * Helper bersama untuk seluruh ekspor Excel (ExcelJS).
 *
 * KENAPA ADA: styling header (tebal, putih di atas hitam, rata tengah)
 * sebelumnya disalin apa adanya di setiap halaman yang punya tombol
 * "Unduh Excel". Begitu Ringkasan ikut punya ekspor sendiri, salinan itu
 * jadi tiga — dan tiga salinan berarti tiga kesempatan untuk menyimpang.
 */

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/** Format angka Rupiah untuk sel Excel (bukan string, tetap bisa dijumlah). */
export const CURRENCY_NUM_FMT = '"Rp"#,##0;[Red]\\-"Rp"#,##0';

/** Memberi gaya baris header: tebal, putih, latar hitam, rata tengah. */
export function styleHeaderRow(worksheet: ExcelJS.Worksheet, rowNumber = 1): void {
  const headerRow = worksheet.getRow(rowNumber);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
  });
}

/** Menulis workbook ke berkas .xlsx dan memicu unduhan di browser. */
export async function downloadWorkbook(workbook: ExcelJS.Workbook, fileName: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, fileName);
}
