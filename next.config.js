/** @type {import('next').NextConfig} */
const nextConfig = {
  staticPageGenerationTimeout: 180,
  output: 'export',
  images: {
    unoptimized: true
  }
};

module.exports = nextConfig;