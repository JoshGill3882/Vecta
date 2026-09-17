import type { NextConfig } from "next";

const extraDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin: string) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  output: "standalone",
  // DEV ONLY - Specify allowed CORS origins from LAN network for local dev testing
  // Add other domains to environment variables under "ALLOWED_DEV_ORIGINS" if you
  // require others for local testing
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "*.local", ...extraDevOrigins],

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
