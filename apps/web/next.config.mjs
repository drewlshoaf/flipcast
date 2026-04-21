/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@flipaudio/types", "@flipaudio/server-db", "@flipaudio/queue"],
  experimental: {
    serverComponentsExternalPackages: ["pg", "bullmq", "ioredis"],
  },
};

export default nextConfig;
