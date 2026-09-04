import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Enable standalone output for Docker deployment */
  output: "standalone",

  /* Optional: configure experimental features */
  experimental: {
    /* Allow server actions from client components */
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
