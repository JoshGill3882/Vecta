import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // DEV ONLY - Specify allowed CORS origins from LAN network for local dev testing
  // Add other domains to the list if required for your own testing
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "*.local"],
};

export default nextConfig;
