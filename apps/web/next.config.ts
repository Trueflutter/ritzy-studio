import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "55321",
        pathname: "/storage/v1/**"
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/**"
      }
    ]
  },
  transpilePackages: [
    "@ritzy-studio/config",
    "@ritzy-studio/db",
    "@ritzy-studio/domain",
    "@ritzy-studio/ui"
  ],
};

export default nextConfig;
