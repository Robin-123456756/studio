"use client";

import * as React from "react";

export function AppLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <img
        src="/tbl-logo.png"
        alt="The Budo League"
        className="h-auto w-[200px] object-contain animate-in fade-in-0 zoom-in-95 duration-500"
      />
    </div>
  );
}
