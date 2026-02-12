import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Transpile shared package so Next.js compiles TypeScript from packages/shared
  transpilePackages: ["@clawddao/shared"],

  webpack: (config) => {
    // Resolve @shared/* alias for webpack
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@shared": path.resolve(__dirname, "../../packages/shared"),
    };
    return config;
  },
};

export default nextConfig;
