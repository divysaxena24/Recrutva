import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Enable standalone output for Docker deployment */
  output: "standalone",

  async redirects() {
    return [
      {
        // The recruiter applications page moved from /jobs/[id]/applications
        // (under the (dashboard) route group) to /dashboard/jobs/[id]/applications.
        // Keep old links working instead of 404ing.
        source: "/jobs/:jobId/applications",
        destination: "/dashboard/jobs/:jobId/applications",
        permanent: false,
      },
    ];
  },

  /* Optional: configure experimental features */
  experimental: {
    /* Allow server actions from client components */
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
