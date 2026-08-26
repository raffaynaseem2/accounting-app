import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bump this when a deployment must be isolated from an older edge build.
  generateBuildId: async () => "ledgerly-20260827-01",
  generateEtags: true,
};

export default nextConfig;
