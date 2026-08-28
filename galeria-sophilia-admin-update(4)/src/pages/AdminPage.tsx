/**
 * src/pages/AdminPage.tsx
 * ----------------------------------------------------
 * @deprecated Seluruh logika (header, navigasi tab, RBAC guard) sudah
 * dipindahkan ke `src/components/admin/AdminPage.tsx`. File ini hanya
 * re-export tipis supaya rute `/admin` di App.tsx tidak perlu berubah.
 *
 * Jika Anda lebih suka kerapian penuh, ganti langsung import di
 * App.tsx menjadi `import AdminPage from "./components/admin/AdminPage"`
 * dan hapus file ini.
 */
export { default } from "../components/admin/AdminPage";
