import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "gray-matter",
    "just-bash",
    "@mongodb-js/zstd",
    "node-liblzma",
    "@agentclientprotocol/sdk",
    "deepagents",
    "langchain",
    "@langchain/core",
    "@langchain/anthropic",
    "@langchain/openai",
    "@langchain/google-genai",
    "@langchain/langgraph",
  ],
  // Empty turbopack config silences Next 16's warning when a custom
  // `webpack:` function also exists. Turbopack ignores the webpack fn;
  // serverExternalPackages above covers the same externalization needs.
  turbopack: {},
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
