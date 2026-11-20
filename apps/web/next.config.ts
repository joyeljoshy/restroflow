import type { NextConfig } from "next";

const remotePatterns = [new URL("https://res.cloudinary.com/**")];
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
if (apiUrl) {
  const localImagePattern = new URL("/uploads/menu/**", apiUrl);
  remotePatterns.push(localImagePattern);
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@restroflow/contracts"],
  images: { remotePatterns },
};

export default nextConfig;
