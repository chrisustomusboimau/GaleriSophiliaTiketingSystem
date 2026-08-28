/**
 * LoginPage.tsx
 * ----------------------------------------------------
 * UPDATE (redirect berbasis role):
 * [1] Sebelumnya SEMUA user (apapun role-nya) diarahkan ke /admin.
 *     Sekarang: admin -> /admin, kasir/checker -> /sesi (Sesi Operasional
 *     adalah landing page mereka, dan satu-satunya area yang boleh mereka
 *     akses — lihat RequireRole di App.tsx).
 * [2] Pengecekan "sudah login?" di awal sekarang memakai `AuthContext`
 *     (bukan cuma cek token) supaya redirect-nya juga sudah tahu role.
 * [3] Setelah login sukses & token disimpan, panggil `refetch()` dari
 *     AuthContext untuk mendapatkan role secara langsung (tanpa nunggu
 *     re-render), lalu redirect sesuai role.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LoginForm from "../components/LoginForm";
import loginImg from "../assets/login.jpg";
import { useAuth } from "../contexts/AuthContext";

interface LoginResponse {
  access_token: string;
  token_type: string;
}

const destinationForRole = (role?: string | null) => (role === "admin" ? "/admin" : "/sesi");

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading, refetch } = useAuth();

  // [2] Kalau AuthContext sudah tahu ada user yang login (token valid),
  // skip layar login sepenuhnya dan arahkan sesuai role-nya.
  useEffect(() => {
    if (!isAuthLoading && user) {
      navigate(destinationForRole(user.role), { replace: true });
    }
  }, [isAuthLoading, user, navigate]);

  const handleLogin = async (username: string, password: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);

    try {
      const response = await fetch("/api/v1/auth/jwt/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Invalid username or password");
      }

      const data: LoginResponse = await response.json();

      // Persist both token fields
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("token_type", data.token_type);

      // [3] Ambil profil user SEKARANG (bukan menunggu context re-render)
      // supaya kita tahu role-nya untuk redirect yang tepat.
      const loggedInUser = await refetch();
      navigate(destinationForRole(loggedInUser?.role), { replace: true });
    } catch (err: any) {
      console.error("Login Error:", err);
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Kalau AuthContext masih memuat DAN ada token tersimpan, tampilkan
  // loading singkat alih-alih flash form login yang akan langsung diredirect.
  if (isAuthLoading && localStorage.getItem("access_token")) {
    return (
      <div className="h-screen w-full bg-gray-800 flex items-center justify-center">
        <p className="text-gray-400 font-medium">Memuat...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 h-screen w-full bg-gray-800">
      <div className="hidden sm:block h-full w-full">
        <img className="w-full h-full object-cover" src={loginImg} alt="Dashboard Login" />
      </div>
      <div className="flex flex-col justify-center items-center px-4 w-full h-full">
        <LoginForm onSubmit={handleLogin} isLoading={isLoading} error={error} />
      </div>
    </div>
  );
}
