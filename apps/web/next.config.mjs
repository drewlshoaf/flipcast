/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@flipcast/types", "@flipcast/server-db", "@flipcast/queue"],
  experimental: {
    serverComponentsExternalPackages: ["pg", "bullmq", "ioredis"],
  },
};

export default nextConfig;
