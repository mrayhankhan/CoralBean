/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Allow the API route to spawn the `coral` CLI binary.
    serverComponentsExternalPackages: ['child_process'],
  },
};

export default nextConfig;
