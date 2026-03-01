import withPWA from "next-pwa";

const enablePwaInDevPreview = process.env.PWA_PREVIEW === "true";

const withPWAConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  clientsClaim: true,
  customWorkerDir: "worker",
  disable: process.env.NODE_ENV === "development" && !enablePwaInDevPreview,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pczlfvvrnmocgygnvxiq.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default withPWAConfig(nextConfig);
