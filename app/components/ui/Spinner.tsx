import React from "react";

export default function Spinner() {
  return (
    <div className="flex items-center justify-center space-x-2">
      <div className="w-4 h-4 rounded-full bg-teal-400 animate-bounce"></div>
      <div className="w-4 h-4 rounded-full bg-teal-400 animate-bounce [animation-delay:-0.15s]"></div>
      <div className="w-4 h-4 rounded-full bg-teal-400 animate-bounce [animation-delay:-0.3s]"></div>
    </div>
  );
}
