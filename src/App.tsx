import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "./contexts/LanguageContext";
import ScanPage from "./pages/ScanPage";
import TicketSelectionPage from "./pages/TicketSelectionPage"; // <-- ADDED
import VisitorFormPage from "./pages/VisitorFormPage";
import QueuePage from "./pages/QueuePage";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";
import PaymentHistoryPage from "./pages/PaymentHistoryPage"; 
import ProtectedRoute from "./components/ProtectedRoute";
import GalleryInfoPage from './pages/GalleryInfoPage';
import SummaryPage from "./pages/SummaryPage"; // Sesuaikan path jika perlu


/**
 * Root application component.
 *
 * Wraps the entire app in:
 * - `LanguageProvider` — supplies the active language and translations globally.
 * - `BrowserRouter`   — enables client-side routing via React Router.
 *
 * Route structure:
 * /                  → Language selection screen (ScanPage)
 * /ticket-selection  → Ticket category selection (TicketSelectionPage) // <-- ADDED
 * /visitor-form      → Visitor details and origin form (VisitorFormPage) // <-- UPDATED PATH
 * /queue/:id         → Queue number confirmation screen (QueuePage)
 * /login             → Admin/Staff login screen (LoginPage)
 * /admin             → Cashier dashboard (AdminPage) — PROTECTED
 * /admin/history     → Transaction history table (PaymentHistoryPage) — PROTECTED
 */
export function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <div className="w-full min-h-screen bg-slate-50">
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<ScanPage />} />
            <Route path="/info" element={<GalleryInfoPage />} />
            <Route path="/ticket-selection" element={<TicketSelectionPage />} /> {/* <-- ADDED */}
            <Route path="/visitor-form" element={<VisitorFormPage />} />         {/* <-- UPDATED */}
            <Route path="/queue/:id" element={<QueuePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin/summary" element={<SummaryPage />} />

            {/* Protected routes — ProtectedRoute checks token before rendering */}
            <Route element={<ProtectedRoute />}>
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/history" element={<PaymentHistoryPage />} />
            </Route>

            {/* Any unknown path falls back to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </LanguageProvider>
  );
}