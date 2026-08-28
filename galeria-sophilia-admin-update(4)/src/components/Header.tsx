/**
 * src/components/Header.tsx
 * ----------------------------------------------------
 * Logo/identitas visual "Galeria Sophilia" yang dipakai berulang
 * di seluruh header halaman staf (Admin/Kasir/Checker).
 * Dipusatkan di sini supaya perubahan branding cukup di satu tempat.
 */

import React from "react";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
  /** Jika true, klik logo akan mengarahkan ke /admin. Default: true. */
  clickable?: boolean;
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ clickable = true, className = "" }) => {
  const navigate = useNavigate();

  return (
    <div
      className={`flex flex-col select-none ${clickable ? "cursor-pointer" : ""} ${className}`}
      onClick={clickable ? () => navigate("/admin") : undefined}
    >
      <h2 className="text-[#fcfcfc] font-light tracking-[0.3em] text-[10px] sm:text-xs uppercase ml-0.5">
        Galeria
      </h2>
      <h1 className="text-[#fb9418] font-bold tracking-wider text-xl sm:text-2xl uppercase leading-none mt-0.5">
        Sophilia
      </h1>
    </div>
  );
};

export default Header;
