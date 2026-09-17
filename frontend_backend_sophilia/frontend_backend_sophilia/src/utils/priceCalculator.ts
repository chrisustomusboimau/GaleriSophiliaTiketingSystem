/**
 * src/utils/priceCalculator.ts
 * ----------------------------------------------------
 * @deprecated Harga tiket sekarang SELALU berasal dari Master Data
 * (`TicketSubCategory.price`) melalui backend, bukan tabel hardcoded
 * per lantai/kategori usia lagi.
 *
 * File ini sengaja dipertahankan sebagai shim tipis supaya import lama
 * (`from "../utils/priceCalculator"`) tidak langsung pecah saat migrasi,
 * tapi hanya meneruskan ke `formatters.ts`. Semua komponen baru di
 * `src/components/admin/*` sudah memakai `calculateItemsTotal` &
 * `formatCurrency` dari `src/utils/formatters.ts` secara langsung.
 *
 * ACTION ITEM: setelah migrasi selesai & tidak ada lagi yang meng-import
 * file ini, hapus file ini sepenuhnya.
 */

export { formatCurrency, calculateItemsTotal } from "./formatters";
