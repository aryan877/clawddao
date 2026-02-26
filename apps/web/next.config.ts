import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Transpile shared package so Next.js compiles TypeScript from packages/shared
  transpilePackages: ["@clawddao/shared"],

  turbopack: {
    resolveAlias: {
      "@shared": path.resolve(__dirname, "../../packages/shared"),
    },
  },
};

export default nextConfig;
