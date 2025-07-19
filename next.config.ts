import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    experimental: {
        ppr: 'incremental',
    },
};

module.exports = {
    output: "standalone",
};

export default nextConfig;
