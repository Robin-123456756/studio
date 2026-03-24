"use client";

import * as React from "react";

export function AppLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#A73038]">
      <div className="bg-[#A73038] rounded-full">
        <img
          src="/lion-white.png.jpeg"
          alt="The Budo League"
          className="h-auto w-[120px] object-contain mix-blend-multiply animate-in fade-in-0 zoom-in-95 duration-500"
        />
      </div>
      <span className="mt-4 text-sm font-bold tracking-[0.2em] uppercase text-white/70 animate-in fade-in-0 duration-700">
        The Budo League
      </span>
    </div>
  );
}
