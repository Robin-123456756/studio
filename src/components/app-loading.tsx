"use client";

import * as React from "react";

export function AppLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D5C63]">
      <img
        src="/icon-t.png"
        alt="The Budo League"
        className="h-[72px] w-auto object-contain"
      />
    </div>
  );
}
