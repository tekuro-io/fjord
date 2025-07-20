import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    experimental: {
        ppr: 'incremental',
    },
    COMMIT_HASH: process.env.COMMIT_HASH,
};

module.exports = {
    output: "standalone",
};

export default nextConfig;
