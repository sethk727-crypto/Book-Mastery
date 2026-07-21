/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // pdf-parse must stay a runtime require — bundling it breaks its
    // internal pdf.js asset resolution.
    serverComponentsExternalPackages: ["pdf-parse"],
  },
};

export default nextConfig;
