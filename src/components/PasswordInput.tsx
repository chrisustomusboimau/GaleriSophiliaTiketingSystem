// src/components/PasswordInput.tsx
import React, { useState } from 'react';

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** Kelas untuk pembungkus (mis. margin 'mt-2'). Jangan beri margin di `className`, agar ikon tetap rata tengah. */
  wrapperClassName?: string;
};

const EyeIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
  </svg>
);

/**
 * Input password dengan tombol mata (suffix) untuk menampilkan/menyembunyikan isi.
 * Menerima semua prop <input> kecuali `type` (dikelola di sini). `className`
 * dipakai di <input>, `wrapperClassName` di pembungkus; ruang di kanan (pr-10) ditambahkan otomatis agar teks
 * tidak tertimpa ikon.
 */
export default function PasswordInput({ className = '', wrapperClassName = '', disabled, id, ...rest }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative ${wrapperClassName}`}>
      <input
        {...rest}
        id={id}
        disabled={disabled}
        type={visible ? 'text' : 'password'}
        className={`${className} w-full pr-10`}
      />
      <button
        type="button" // wajib: mencegah tombol ini men-submit form
        onClick={() => setVisible((v) => !v)}
        // Mencegah input kehilangan fokus/posisi kursor saat ikon diklik mouse.
        onMouseDown={(e) => e.preventDefault()}
        disabled={disabled}
        aria-label={visible ? 'Sembunyikan password' : 'Tampilkan password'}
        aria-controls={id}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-white focus:outline-none focus-visible:text-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
