import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#062C30] via-[#0D5C63] to-[#14919B] px-6">
      <div className="text-center max-w-sm">
        <img
          src="/icon-t.png"
          alt="The Budo League"
          className="h-16 w-auto mx-auto mb-6 rounded-xl"
        />
        <h1 className="text-5xl font-bold text-white mb-2">404</h1>
        <p className="text-white/70 text-sm mb-6">
          This page doesn&apos;t exist. Let&apos;s get you back in the game.
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-6 py-2.5 bg-white text-[#0D5C63] font-semibold rounded-full text-sm hover:bg-white/90 transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
