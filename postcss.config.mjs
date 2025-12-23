// postcss.config.mjs

/** @typedef {import('postcss-load-config').Config} PostCSSConfig */

/** @type {PostCSSConfig} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
