/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Allow the API route to spawn the `coral` CLI binary.
    serverComponentsExternalPackages: ['child_process'],
    // The audit route reads sql/audit-query.sql at runtime. Serverless hosts
    // (Netlify/Vercel) only bundle files the tracer can see, so include it
    // explicitly or the deployed function 500s with ENOENT.
    outputFileTracingIncludes: {
      '/api/audit': ['./sql/**/*'],
    },
  },
};

export default nextConfig;
