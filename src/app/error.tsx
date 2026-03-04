"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("Global error:", error);
    }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D5C63] px-6">
      <div className="text-center max-w-sm">
        <img
          src="/icon.jpg"
          alt="The Budo League"
          className="h-16 w-auto mx-auto mb-6 rounded-xl"
        />
        <h1 className="text-xl font-bold text-white mb-2">
          Something went wrong
        </h1>
        <p className="text-white/70 text-sm mb-6">
          Don&apos;t worry — your data is safe. Try refreshing the page.
        </p>
        <button
          onClick={() => reset()}
          className="px-6 py-2.5 bg-white text-[#0D5C63] font-semibold rounded-full text-sm hover:bg-white/90 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
