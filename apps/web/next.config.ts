import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@ritzy-studio/config",
    "@ritzy-studio/db",
    "@ritzy-studio/domain",
    "@ritzy-studio/ui"
  ],
};

export default nextConfig;
