import type { NextConfig } from "next";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), "../../.env.local") });

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
    "@ritzy-studio/ai",
    "@ritzy-studio/config",
    "@ritzy-studio/db",
    "@ritzy-studio/domain",
    "@ritzy-studio/prompts",
    "@ritzy-studio/ui"
  ]
};

export default nextConfig;
