/** @type {import('next').NextConfig} */

const nextConfig = {
  /* config options here */
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://personal-d4txim0d.outsystemscloud.com/Charity/rest/CharityAPI/:path*'
      }
    ];
  }
};

module.exports = nextConfig;
