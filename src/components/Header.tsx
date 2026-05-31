/**
 * Header.tsx
 * ----------------------------------------------------
 * Komponen header reusable dengan identitas visual Galeria Sophilia.
 */

import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-black py-8 px-4 flex flex-col items-center justify-center border-b border-white/10 shrink-0 z-10">
      <div className="text-center select-none font-futura">
        {/* Tambahkan leading-none untuk merapatkan tinggi baris (line-height) */}
        <h2 className="text-[#fcfcfc] font-light text-lg md:text-xl uppercase leading-none">
          Galeria
        </h2>
        {/* Ubah mt-1 menjadi margin negatif (-mt-1 atau -mt-2) untuk menarik teks ke atas */}
        <h1 className="text-[#fb9418] font-normal tracking-wider text-3xl md:text-4xl uppercase -mt-1">
          Sophilia
        </h1>
      </div>
    </header>
  );
};

export default Header;