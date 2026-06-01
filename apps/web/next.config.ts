import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@localloop/domain", "@localloop/providers"]
};

export default nextConfig;
