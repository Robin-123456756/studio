"use client";

import * as React from "react";

export function AppLoading() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ backgroundColor: "#b91c1c" }}
    >
      {/* Lion logo */}
      <img
        src="/splash-logo.jpg"
        alt="The Budo League"
        className="h-[200px] w-auto object-contain rounded-3xl"
      />

      {/* Tagline */}
      <p className="mt-4 text-sm font-bold text-white/90 tracking-widest uppercase">
        The Budo League
      </p>
      <p className="mt-1 text-xs font-medium text-white/60 tracking-wide">
        Fantasy Football
      </p>

      {/* Progress sweep */}
      <div className="relative mt-8 h-[2px] w-44 overflow-hidden rounded-full bg-white/20">
        <div
          className="absolute inset-y-0 w-2/5 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)",
            animation: "sweep 1.6s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}
