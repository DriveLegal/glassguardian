/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep this so Next transpiles r3f deps cleanly for the embed route
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
  reactStrictMode: true,
};

module.exports = nextConfig;