'use client';

import { useState, useEffect } from 'react';


export default function LoginGate({ children }: { children: React.ReactNode }) {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Optional: check cookie client-side (not secure, only for UX)
    if (document.cookie.includes('auth=true')) {
      setAuthenticated(true);
    }
  }, []);

    const handleLogin = async () => {
    const formData = new FormData();
    formData.append('password', password);

    const res = await fetch('/api/login', {
        method: 'POST',
        body: formData,
    });

    const result = await res.json();
    if (result.success) {
        setAuthenticated(true);
    } else {
        setError('Never seen a password as wrong as that one!');
    }
    };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  if (authenticated) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-start justify-center px-4 text-white pt-32">
      <div className="bg-gray-800 p-8 rounded-md w-full max-w-sm shadow-lg">
        <h1 className="text-2xl font-bold mb-4 text-blue-400 text-center">
          Login
        </h1>
        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)} 
          onKeyDown={handleKeyDown}
          className="w-full px-4 py-2 mb-4 bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-accent-blue-500"
        />

        <button
          onClick={handleLogin}
          className="w-full bg-blue-400 hover:bg-blue-600 transition font-semibold py-2 rounded"
        >
          Enter
        </button>

        {error && (
          <p className="text-red-500 mt-4 text-sm text-center">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
