/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Only use rewrites for local dev/Docker (when NEXT_PUBLIC_API_BASE_URL is not set)
    // In production (Vercel), NEXT_PUBLIC_API_BASE_URL will be set and client code calls API directly
    if (process.env.NEXT_PUBLIC_API_BASE_URL) {
      return [];
    }
    
    // In Docker, use the service name 'api'; locally use localhost
    // Rewrites happen server-side, so we need the internal Docker network name
    const apiUrl = process.env.DOCKER ? 'http://api:8000' : 'http://localhost:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
