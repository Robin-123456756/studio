"use client";

import * as React from "react";

export function AppLoading() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "#b91c1c" }}
    >
      <img
        src="/icon.jpg"
        alt="The Budo League"
        className="h-[200px] w-auto object-contain rounded-3xl"
      />
    </div>
  );
}
