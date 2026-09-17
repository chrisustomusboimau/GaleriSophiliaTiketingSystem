// src/components/LoginForm.tsx
import React, { useState } from 'react';

interface LoginFormProps {
  onSubmit: (username: string, password: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export default function LoginForm({ onSubmit, isLoading, error }: LoginFormProps) {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    await onSubmit(username, password);
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className="max-w-[400px] w-full mx-auto rounded-lg bg-gray-900 p-8 px-8"
    >
      <h2 className="text-4xl dark:text-white font-bold text-center">SIGN IN</h2>
      
      {/* Error Feedback */}
      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-500 text-sm p-3 mt-4 rounded">
          {error}
        </div>
      )}

      <div className="flex flex-col text-gray-400 py-2 mt-4">
        <label htmlFor="username">Username / Email</label>
        <input 
          id="username"
          className="rounded-lg bg-gray-700 mt-2 p-2 focus:border-teal-500 focus:bg-gray-800 focus:outline-none text-white" 
          type="text" 
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>

      <div className="flex flex-col text-gray-400 py-2">
        <label htmlFor="password">Password</label>
        <input 
          id="password"
          className="p-2 rounded-lg bg-gray-700 mt-2 focus:border-teal-500 focus:bg-gray-800 focus:outline-none text-white" 
          type="password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>

      <div className="flex justify-between text-gray-400 py-2 text-sm">
        <label className="flex items-center cursor-pointer hover:text-white transition-colors">
          <input className="mr-2" type="checkbox" disabled={isLoading} /> 
          Remember Me
        </label>
        <button type="button" className="hover:text-teal-500 transition-colors">
          Forgot Password?
        </button>
      </div>

      <button 
        type="submit"
        disabled={isLoading}
        className="w-full my-5 py-2 bg-teal-500 shadow-lg shadow-teal-500/50 hover:bg-teal-600 hover:shadow-teal-500/40 text-white font-semibold rounded-lg disabled:opacity-70 disabled:cursor-not-allowed transition-all flex justify-center items-center"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Signing in...
          </span>
        ) : (
          'SIGN IN'
        )}
      </button>
    </form>
  );
}