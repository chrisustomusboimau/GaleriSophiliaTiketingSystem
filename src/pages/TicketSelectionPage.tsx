/**
 * TicketSelectionPage.tsx
 * ----------------------------------------------------
 * Halaman pertama pemilihan tiket untuk pengunjung.
 *
 * UPDATE TOTAL (selaras backend baru): sebelumnya daftar "lantai" beserta
 * harga per kategori usia HARDCODED langsung di file ini (3 lantai tetap,
 * harga tetap). Sekarang sepenuhnya dinamis — diambil dari sesi
 * operasional yang sedang berjalan. Jumlah "lantai" (Master Tiket) dan
 * varian usia di dalamnya bisa berapa pun sesuai konfigurasi admin —
 * tidak lagi terbatas 3 lantai x 3 kategori.
 *
 * UPDATE (multi-bahasa & gerbang sesi):
 * - Sesi TIDAK lagi diambil di file ini. `ActiveSessionProvider`
 *   mengambilnya sekali untuk seluruh alur pembelian (dulu halaman ini dan
 *   `VisitorForm.tsx` masing-masing memanggil `GET /sessions/active`
 *   sendiri-sendiri), dan `RequireActiveSession` sudah menjamin halaman
 *   ini cuma dirender kalau ada sesi berjalan.
 * - Nama lantai & varian dirender dari `name_i18n` sesuai bahasa aktif.
 *   HARGA tetap satu nilai universal — tidak ikut diterjemahkan.
 *
 * `selectedFloors` yang dikirim ke `/visitor-form` sekarang berisi
 * `ticket_master_id` sungguhan (UUID), bukan lagi string nama lantai
 * statis seperti "Floor 1" — inilah yang membuatnya benar-benar nyambung
 * dengan pencocokan `sub.ticket_master_id` di `VisitorForm.tsx`.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import { useActiveSession } from "../contexts/ActiveSessionContext";
import { resolveName } from "../utils/formatters";
import FloorCard, { FloorData } from "../components/FloorCard";
import Header from "../components/Header";

const TicketSelectionPage: React.FC = () => {
  const { language, translations } = useLanguage();
  const navigate = useNavigate();

  const [selectedFloors, setSelectedFloors] = useState<string[]>([]);

  // Sesi tidak lagi diambil di sini. `ActiveSessionProvider` sudah
  // mengambilnya sekali untuk seluruh alur pembelian, dan
  // `RequireActiveSession` menjamin halaman ini hanya dirender kalau
  // sesinya memang ada — jadi tidak perlu lagi state loading/error sendiri
  // maupun permintaan jaringan kedua.
  const { session, isLoading, error: sessionError, reload } = useActiveSession();

  // LOGIKA ANTI-SPAM (COOL-DOWN 10 MENIT) — sama seperti halaman lain di
  // alur publik, jaga-jaga kalau pengunjung membuka halaman ini langsung
  // padahal masih punya antrian aktif.
  useEffect(() => {
    const cachedQueue = localStorage.getItem("sophilia_active_queue");
    if (cachedQueue) {
      try {
        const parsed = JSON.parse(cachedQueue);
        const now = Date.now();
        const tenMinutes = 10 * 60 * 1000;
        if (now - parsed.timestamp < tenMinutes) {
          navigate(`/queue/${parsed.id}`, { state: parsed.state, replace: true });
          return;
        }
        localStorage.removeItem("sophilia_active_queue");
      } catch {
        localStorage.removeItem("sophilia_active_queue");
      }
    }
  }, [navigate]);

  const loadActiveSession = () => {
    reload();
  };

  // --- Kelompokkan tiket aktif per Master (dulu "lantai"), urutan
  // mengikuti kemunculan pertama di active_tickets (kira-kira urutan yang
  // dipilih admin saat membuat sesi). ---
  const floorsData: FloorData[] = useMemo(() => {
    if (!session) return [];
    const order: string[] = [];
    const map = new Map<string, FloorData>();

    session.active_tickets.forEach((st) => {
      const sub = st.sub_category;
      if (!sub) return;
      const masterId = sub.ticket_master_id;

      // Nama lantai & nama varian mengikuti bahasa aktif; kalau bahasa itu
      // belum diisi admin (mis. Mandarin), resolveName otomatis jatuh ke
      // English — tidak pernah label kosong.
      const masterLabel = resolveName(sub.ticket_master_name_i18n, language, sub.ticket_master_name || "Tiket");

      if (!map.has(masterId)) {
        map.set(masterId, { id: masterId, label: masterLabel, variants: [] });
        order.push(masterId);
      }
      map.get(masterId)!.variants.push({
        id: sub.id,
        name: resolveName(sub.name_i18n, language, sub.name),
        // HARGA TIDAK PERNAH diterjemahkan — satu nilai untuk semua bahasa.
        price: sub.price,
      });
    });

    return order.map((id) => map.get(id)!);
    // `language` ikut sebagai dependency: ganti bahasa harus langsung
    // membangun ulang label, bukan menunggu sesi dimuat ulang.
  }, [session, language]);

  const toggleFloor = (floorId: string) => {
    setSelectedFloors((prev) => (prev.includes(floorId) ? prev.filter((id) => id !== floorId) : [...prev, floorId]));
  };

  const handleContinue = () => {
    if (selectedFloors.length === 0) return;
    navigate("/visitor-form", { state: { selectedFloors } });
  };

  const continueButtonText = translations.continueSelected[language]
    ? translations.continueSelected[language].replace("{count}", selectedFloors.length.toString())
    : "";

  return (
    <div className="min-h-screen bg-black flex flex-col relative font-sans">
      <Header />

      <main className="flex-1 flex flex-col items-center p-4 sm:p-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-black to-zinc-900 -z-10" />

        <div className="w-full max-w-lg bg-[#fcfcfc] rounded-2xl shadow-2xl p-6 sm:p-8 border border-gray-200">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-xl font-bold text-black uppercase tracking-wide">{translations.exhibitionArea[language]}</h2>
            </div>
            <p className="text-gray-500 text-sm mt-2">{translations.selectFloorInstruction[language]}</p>
          </div>

          {isLoading && (
            <div className="text-center py-12">
              <div className="w-10 h-10 border-4 border-[#fb9418] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400 font-medium text-sm">{translations.loadingTickets[language]}</p>
            </div>
          )}

          {!isLoading && (sessionError || !session) && (
            <div className="py-6 text-center space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                {sessionError || translations.noActiveSessionMessage[language]}
              </div>
              <button
                onClick={loadActiveSession}
                className="px-5 py-2.5 font-bold text-black bg-white border border-gray-300 hover:bg-gray-100 rounded-xl transition-all"
              >
                {translations.retryButton[language]}
              </button>
            </div>
          )}

          {!isLoading && session && floorsData.length === 0 && (
            <div className="py-6 text-center space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm">
                {translations.noTicketsAvailable[language]}
              </div>
              <button
                onClick={loadActiveSession}
                className="px-5 py-2.5 font-bold text-black bg-white border border-gray-300 hover:bg-gray-100 rounded-xl transition-all"
              >
                {translations.retryButton[language]}
              </button>
            </div>
          )}

          {!isLoading && session && floorsData.length > 0 && (
            <div className="space-y-4">
              {floorsData.map((floor) => (
                <FloorCard
                  key={floor.id}
                  floor={floor}
                  isSelected={selectedFloors.includes(floor.id)}
                  onToggle={toggleFloor}
                  perPersonLabel={translations.perPersonLabel[language]}
                />
              ))}
            </div>
          )}

          <div className="pt-8 flex gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex-1 py-4 font-bold text-black bg-white border border-gray-300 hover:bg-gray-100 rounded-xl transition-all duration-200 flex justify-center items-center gap-2 active:scale-95"
            >
              {translations.backButton?.[language] || "Kembali"}
            </button>

            <button
              onClick={handleContinue}
              disabled={selectedFloors.length === 0}
              className={`flex-1 py-4 font-bold text-[#fcfcfc] rounded-xl transition-all duration-200 shadow-md flex justify-center items-center gap-2 ${
                selectedFloors.length === 0 ? "bg-gray-400 cursor-not-allowed shadow-none" : "bg-[#fb9418] hover:bg-orange-500 hover:shadow-lg active:scale-95"
              }`}
            >
              {selectedFloors.length === 0 ? translations.continueButton?.[language] || "Lanjutkan" : continueButtonText}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TicketSelectionPage;
