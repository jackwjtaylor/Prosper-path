"use client";

import React from "react";

type Props = {
  buttonLabel?: string;
  placeholder?: string;
  successMessage?: string;
  includeName?: boolean;
};

export default function WaitlistForm({ buttonLabel = "Join Waitlist", placeholder = "Enter your email", successMessage = "You're on the list!", includeName = false }: Props) {
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email");
      return;
    }
    setStatus("loading");
    try {
      const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
      const utm = url ? Object.fromEntries(url.searchParams.entries()) : {};
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined, utm }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("success");
    } catch {
      setError("Network error. Please try again.");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-gray-300 bg-[#EFEEEB]/90 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-dim bg-[#EFEEEB] px-6 py-3 text-sm font-medium text-[#083630] hover:opacity-90 disabled:opacity-60"
        >
          {status === "loading" ? "Submitting…" : buttonLabel}
        </button>
      </div>
      {includeName && (
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Optional: your name"
          className="w-full rounded-md border border-gray-200 bg-[#EFEEEB]/90 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {status === "success" && <p className="text-sm text-green-600">{successMessage}</p>}
    </form>
  );
}
