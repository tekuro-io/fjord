// components/Login.tsx
"use client";

import { useState } from "react";

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  const handleLogin = () => {
    if (input === process.env.NEXT_PUBLIC_LOGIN_PASSWORD) {
      setError(false);
      onLogin();
    } else {
      setError(true);
    }
  };

  return (
    <div className="flex justify-center items-start min-h-screen bg-gray-900 pt-24">
      <div className="bg-gray-800 p-8 rounded shadow-lg w-full max-w-sm border border-gray-700">
        <h1 className="text-2xl font-bold text-accent-blue-500 mb-4">Login</h1>
        <input
          type="password"
          placeholder="Enter password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleLogin();
          }}
          className={`w-full px-4 py-2 mb-4 bg-gray-700 rounded focus:outline-none focus:ring-2 ${
            error
              ? "border border-red-500 focus:ring-red-500"
              : "focus:ring-accent-blue-500"
          }`}
        />
        <button
          onClick={handleLogin}
          className="w-full bg-accent-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
        >
          Login
        </button>
        {error && (
          <p className="mt-2 text-red-400 text-sm">Incorrect password.</p>
        )}
      </div>
    </div>
  );
}
