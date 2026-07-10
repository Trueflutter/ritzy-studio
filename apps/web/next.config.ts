import type { NextConfig } from "next";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), "../../.env.local") });

const nextConfig: NextConfig = {
  // Root the trace at the monorepo so pnpm-hoisted deps (in the repo-root .pnpm store,
  // outside apps/web) are in scope for output-file tracing on Vercel.
  outputFileTracingRoot: path.resolve(process.cwd(), "../../"),
  // sharp's @img/sharp-linux-x64 native addon dlopen()s its sibling
  // @img/sharp-libvips-linux-x64/lib/libvips-cpp.so at load time. @vercel/nft cannot
  // follow a dlopen, so it bundles the .node binding but drops the .so, and every server
  // route that imports sharp 500s with ERR_DLOPEN_FAILED on the Vercel function. Force the
  // linux platform packages (binding + libvips) into every route's trace. Globs are
  // resolved from the project root (apps/web); the .pnpm dirs only exist on the linux
  // build, so this is a no-op locally on macOS.
  outputFileTracingIncludes: {
    "/**": [
      "../../node_modules/.pnpm/@img+sharp-libvips-linux-x64@*/node_modules/@img/sharp-libvips-linux-x64/**",
      "../../node_modules/.pnpm/@img+sharp-linux-x64@*/node_modules/@img/sharp-linux-x64/**"
    ]
  },
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
