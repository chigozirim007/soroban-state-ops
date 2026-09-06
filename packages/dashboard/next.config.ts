import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.OUTPUT_STANDALONE === "true" ? "standalone" : undefined,
  reactCompiler: true,
};

export default nextConfig;
