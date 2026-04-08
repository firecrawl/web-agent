import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "gray-matter",
    "better-sqlite3",
    "just-bash",
    "@mongodb-js/zstd",
    "@agentclientprotocol/sdk",
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals ?? [];
      config.externals.push(({ request }: { request?: string }, callback: (err?: Error | null, result?: string) => void) => {
        if (
          request === "just-bash" ||
          request === "@mongodb-js/zstd" ||
          request === "node-liblzma" ||
          request?.endsWith(".node")
        ) {
          return callback(null, `commonjs ${request}`);
        }
        callback();
      });
    }

    return config;
  },
};

export default nextConfig;
