"use client";

import * as React from "react";

export function AppLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#4A0404]">
      <img
        src="/icon.png"
        alt="The Budo League"
        className="h-auto w-[120px] object-contain animate-in fade-in-0 zoom-in-95 duration-500"
      />
      <span className="mt-4 text-sm font-bold tracking-[0.2em] uppercase text-white/70 animate-in fade-in-0 duration-700">
        The Budo League
      </span>
    </div>
  );
}
