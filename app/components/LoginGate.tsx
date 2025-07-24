"use client";

import { useState, useEffect } from "react";

const PASSWORD = "stonks";

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

  if (authenticated) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4 text-white">
      <div className="bg-gray-800 p-8 rounded-md w-full max-w-sm shadow-lg">
        <h1 className="text-2xl font-bold mb-4 text-green-400 text-center">Login</h1>
        <input
          type="password"
          placeholder="Enter password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full px-4 py-2 mb-4 bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          onClick={handleLogin}
          className="w-full bg-green-500 hover:bg-green-600 transition font-semibold py-2 rounded"
        >
          Enter
        </button>
      </div>
    </div>
  );
}
