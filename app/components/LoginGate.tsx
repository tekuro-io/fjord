"use client";

import { useState, useEffect } from "react";

const PASSWORD = "stonks"; // Consider using an env var in production

export default function LoginGate({ children }: { children: React.ReactNode }) {
  const [input, setInput] = useState("");
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    if (window.sessionStorage.getItem("authed") === "true") {
      setAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    if (input === PASSWORD) {
      window.sessionStorage.setItem("authed", "true");
      setAuthenticated(true);
    } else {
      alert("Incorrect password");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  if (authenticated) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-start justify-center bg-gray-900 px-4 text-white pt-32">
      <div className="bg-gray-800 p-8 rounded-md w-full max-w-sm shadow-lg">
        <h1 className="text-2xl font-bold mb-4 text-accent-blue-500 text-center">
          Login
        </h1>
        <input
          type="password"
          placeholder="Enter password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full px-4 py-2 mb-4 bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-accent-blue-500"
        />
        <button
          onClick={handleLogin}
          className="w-full bg-accent-blue-500 hover:bg-blue-600 transition font-semibold py-2 rounded"
        >
          Enter
        </button>
      </div>
    </div>
  );
}
