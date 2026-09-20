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

/** Nomor kolom (1-based) -> huruf kolom Excel ("1" -> "A", "27" -> "AA"). Dipakai membangun rumus SUM dinamis. */
export function excelColumnLetter(colNumber: number): string {
  let letter = "";
  let n = colNumber;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

/** Membuang spasi & karakter yang tidak boleh ada di nama berkas ("Sesi 1" -> "Sesi1"). */
function sanitizeFileNamePart(value: string): string {
  return value.replace(/[\s\\/:*?"<>|]+/g, "");
}

/** Nama berkas ekspor PER SESI: `Tiketing-2026-09-17-Sesi1.xlsx`. */
export function sessionExportFileName(session: { date: string; name: string }): string {
  return `Tiketing-${session.date}-${sanitizeFileNamePart(session.name)}.xlsx`;
}

/** Nama berkas ekspor MULTI-SESI (gabungan satu tanggal): `Tiketing-2026-09-17.xlsx`. */
export function dateExportFileName(date: string): string {
  return `Tiketing-${date}.xlsx`;
}

/** Menulis workbook ke berkas .xlsx dan memicu unduhan di browser. */
export async function downloadWorkbook(workbook: ExcelJS.Workbook, fileName: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, fileName);
}
