import type { NextConfig } from "next";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), "../../.env.local") });

const nextConfig: NextConfig = {
  // pnpm hoists native deps (sharp + its @img/sharp-libvips-linux-x64 .so) to the
  // repo-root .pnpm store, outside apps/web. Tracing defaults to the project dir and
  // drops those files from the deployed function, so sharp fails to dlopen libvips at
  // runtime and every server route that imports it 500s. Root the trace at the monorepo
  // so the platform binaries are bundled into the Vercel function.
  outputFileTracingRoot: path.resolve(process.cwd(), "../../"),
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
