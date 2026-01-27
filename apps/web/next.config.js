/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
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
