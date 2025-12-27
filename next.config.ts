const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

module.exports = withPWA({
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" }
    ],
  },
});
