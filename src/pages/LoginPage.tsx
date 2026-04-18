/**
 * LoginPage.tsx
 * Changes from original:
 * [1] useNavigate is now active (uncommented)
 * [2] useEffect added: redirects already-logged-in users to /admin
 * [3] navigate('/admin') called after token is stored
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // [1] ACTIVATED
import LoginForm from '../components/LoginForm';
import loginImg from '../assets/login.jpg';

interface LoginResponse {
  access_token: string;
  token_type: string;
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate(); // [1] ACTIVATED

  // [2] If a token already exists, skip the login screen entirely
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      navigate('/admin', { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (username: string, password: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    try {
      const response = await fetch('/api/v1/auth/jwt/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Invalid username or password');
      }

      const data: LoginResponse = await response.json();

      // Persist both token fields
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('token_type', data.token_type);

      // [3] Redirect to the protected admin dashboard
      navigate('/admin', { replace: true });

    } catch (err: any) {
      console.error('Login Error:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 h-screen w-full bg-gray-800">
      <div className="hidden sm:block h-full w-full">
        <img
          className="w-full h-full object-cover"
          src={loginImg}
          alt="Dashboard Login"
        />
      </div>
      <div className="flex flex-col justify-center items-center px-4 w-full h-full">
        <LoginForm
          onSubmit={handleLogin}
          isLoading={isLoading}
          error={error}
        />
      </div>
    </div>
  );
}