import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "gray-matter",
    "better-sqlite3",
    "just-bash",
    "@mongodb-js/zstd",
    "@agentclientprotocol/sdk",
  ],
};

export default nextConfig;
