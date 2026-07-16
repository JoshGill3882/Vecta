import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // DEV ONLY - Specify allowed CORS origins from LAN network for local dev testing
  // Add other domains to the list if required for your own testing
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "*.local"],

  async redirects() {
    return [
      // Every tab is a route of its own, so "/" is a signpost rather than a
      // page — it resolves to the task list. Auth code redirects to "/" meaning
      // "home"; this is the single place that decides where home actually is.
      //
      // Deliberately not `permanent`: a 308 is cached hard by browsers and is
      // painful to walk back on instances we don't control.
      { source: "/", destination: "/tasks", permanent: false },
    ];
  },
};

export default nextConfig;
