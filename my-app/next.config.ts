import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static export for client-side only deployment
  output: 'export',
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  distDir: 'out',
  images: {
    unoptimized: true // Required for static export
  },
  typescript: {
    ignoreBuildErrors: true // Temporarily ignore TS errors during conversion
  },
  eslint: {
    ignoreDuringBuilds: true // Temporarily ignore ESLint during conversion
  }
};

export default nextConfig;
