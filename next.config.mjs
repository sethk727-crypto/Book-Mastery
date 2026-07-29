/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdf-parse must stay a runtime require — bundling it breaks its
  // internal pdf.js asset resolution. (Top-level since Next 15.)
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
