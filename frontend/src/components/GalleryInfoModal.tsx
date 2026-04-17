import React, { useEffect, useState } from 'react';

// Import gambar placeholder
// Sesuaikan path '../assets/Sophilia.jpg' dengan struktur folder Anda.
// Jika file modal ini ada di 'src/components', maka path ini sudah benar.
import sophiliaImg from '../assets/Sophilia.jpg';

interface GalleryInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GalleryInfoModal: React.FC<GalleryInfoModalProps> = ({ isOpen, onClose }) => {
  const [show, setShow] = useState(false);

  // Efek transisi masuk/keluar yang halus
  useEffect(() => {
    if (isOpen) {
      setShow(true);
      document.body.style.overflow = 'hidden'; // Cegah scroll di background
    } else {
      setTimeout(() => setShow(false), 300); // Tunggu animasi selesai sebelum unmount
      document.body.style.overflow = 'unset';
    }
  }, [isOpen]);

  if (!isOpen && !show) return null;

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 transition-all duration-300 ${
        isOpen ? 'bg-black/40 backdrop-blur-sm opacity-100' : 'bg-black/0 opacity-0 pointer-events-none'
      }`}
      onClick={onClose} // Tutup saat klik di luar (backdrop)
    >
      <div 
        className={`bg-white w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 transform ${
          isOpen ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-8 scale-95 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()} // Cegah klik di dalam box menutup modal
      >
        {/* Header Lengket (Sticky) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0 bg-white/90 backdrop-blur">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 tracking-wide">
            Panduan Eksibisi Galeri
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors focus:outline-none"
            aria-label="Tutup"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Konten Scrollable */}
        <div className="p-6 overflow-y-auto space-y-10 text-gray-600 custom-scrollbar">
          
          {/* Lantai 1 */}
          <section>
            <h3 className="text-lg font-bold text-blue-800 uppercase tracking-widest mb-4 border-l-4 border-blue-600 pl-3">
              Lantai 1
            </h3>
            {/* Placeholder Gambar */}
            <div className="w-full h-48 sm:h-56 mb-5 rounded-xl overflow-hidden bg-gray-100 shadow-sm">
              <img 
                src={sophiliaImg} 
                alt="Eksibisi Lantai 1" 
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
              />
            </div>
            <div className="space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                Menampilkan koleksi kurasi istimewa berupa patung marmer dan perunggu—koleksi paling lengkap dan pertama di Indonesia.
              </p>
              <p>
                Setiap karya menghadirkan kesempatan langka untuk menyaksikan mahakarya yang terinspirasi dari museum-museum terbesar di dunia, menghadirkan pengalaman seni yang megah dan berkelas.
              </p>
              <p className="italic font-medium text-gray-500">
                Dengan hangat kami mengundang Anda untuk menikmati perjalanan seni ini.
              </p>
            </div>
          </section>

          {/* Lantai 5 */}
          <section>
            <h3 className="text-lg font-bold text-blue-800 uppercase tracking-widest mb-4 border-l-4 border-blue-600 pl-3">
              Lantai 5
            </h3>
            {/* Placeholder Gambar */}
            <div className="w-full h-48 sm:h-56 mb-5 rounded-xl overflow-hidden bg-gray-100 shadow-sm">
              <img 
                src={sophiliaImg} 
                alt="Eksibisi Lantai 5" 
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
              />
            </div>
            <div className="space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                Galeria Sophilia dengan bangga mempersembahkan perjalanan luar biasa menuju masa keemasan <strong>Dinasti Tang</strong>—era ketika Tiongkok mencapai puncak kejayaan sebagai salah satu peradaban paling makmur dan berpengaruh di dunia.
              </p>
              <p>
                Masuki dunia <em>Tang Sancai</em> (keramik tiga warna), karya seni berusia lebih dari 1.300 tahun yang menggambarkan manusia, hewan, dan berbagai objek kehidupan yang dahulu melintasi jalur perdagangan legendaris Jalur Sutra, menghubungkan Tiongkok hingga Eropa.
              </p>
              <p>
                Rasakan jejak pertukaran budaya dan spiritual yang membentuk peradaban dunia, serta hayati warisan budaya Dinasti Tang yang abadi.
              </p>
            </div>
          </section>

          {/* Lantai 6 & 7 */}
          <section>
            <h3 className="text-lg font-bold text-blue-800 uppercase tracking-widest mb-4 border-l-4 border-blue-600 pl-3">
              Lantai 6 & 7
            </h3>
            {/* Placeholder Gambar */}
            <div className="w-full h-48 sm:h-56 mb-5 rounded-xl overflow-hidden bg-gray-100 shadow-sm">
              <img 
                src={sophiliaImg} 
                alt="Eksibisi Lantai 6 dan 7" 
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
              />
            </div>
            <div className="space-y-3 text-sm sm:text-base leading-relaxed">
              <p>
                Lantai ini menghadirkan perjalanan melintasi dua warisan budaya besar dunia, dengan koleksi seni Eropa dan Tiongkok yang saling melengkapi.
              </p>
              <p>
                Di <strong>Lantai 6</strong>, Anda akan menemukan beragam lukisan dan patung klasik Eropa yang mencerminkan kejayaan seni Barat dari berbagai periode sejarah. Setiap karya menampilkan keindahan teknik, detail, dan ekspresi artistik yang menjadi ciri khas peradaban Eropa.
              </p>
              <p>
                Sementara itu, di <strong>Lantai 7</strong>, tersaji koleksi barang antik Tiongkok yang kaya nilai sejarah dan budaya. Artefak-artefak ini merepresentasikan kehidupan, tradisi, serta filosofi masyarakat Tiongkok kuno, menghadirkan wawasan mendalam tentang warisan peradaban Timur.
              </p>
              <p className="font-medium text-gray-700 mt-4 bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm">
                Kombinasi keduanya menciptakan dialog budaya yang harmonis antara Timur dan Barat dalam satu pengalaman yang utuh dan berkesan.
              </p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

export default GalleryInfoModal;