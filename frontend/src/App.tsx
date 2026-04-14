import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "./contexts/LanguageContext";
import ScanPage from "./pages/ScanPage";
import VisitorFormPage from "./pages/VisitorFormPage";
import QueuePage from "./pages/QueuePage";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";
import PaymentHistoryPage from "./pages/PaymentHistoryPage"; 
import ProtectedRoute from "./components/ProtectedRoute";

/**
 * Root application component.
 *
 * Wraps the entire app in:
 * - `LanguageProvider` — supplies the active language and translations globally.
 * - `BrowserRouter`   — enables client-side routing via React Router.
 *
 * Route structure:
 * /               → Language selection screen (ScanPage)
 * /form           → Visitor ticket form (VisitorFormPage)
 * /queue/:id      → Queue number confirmation screen (QueuePage)
 * /login          → Admin/Staff login screen (LoginPage)
 * /admin          → Cashier dashboard (AdminPage) — PROTECTED
 * /admin/history  → Transaction history table (PaymentHistoryPage) — PROTECTED
 */
export function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <div className="w-full min-h-screen bg-slate-50">
          <Routes>
            {/* Public routes — unchanged */}
            <Route path="/" element={<ScanPage />} />
            <Route path="/form" element={<VisitorFormPage />} />
            <Route path="/queue/:id" element={<QueuePage />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Protected routes — ProtectedRoute checks token before rendering */}
            <Route element={<ProtectedRoute />}>
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/history" element={<PaymentHistoryPage />} /> {/* ADDED */}
            </Route>

            {/* Any unknown path falls back to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </LanguageProvider>
  );
}