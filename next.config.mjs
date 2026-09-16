/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fully static build: the game is loaded in a sandboxed iframe and must have no
  // runtime server. In export mode Next coerces an unset `dynamic` to 'error', so
  // every page here is statically renderable by construction.
  output: 'export',

  // The record reads on-chain logs from the browser, not from an image optimizer.
  images: { unoptimized: true },

  // The casino SDK is consumed straight from source (its package `exports` point at
  // .ts files), so Next has to compile it rather than treat it as a prebuilt dep.
  transpilePackages: ['@chain/casino-sdk'],
};

export default nextConfig;
