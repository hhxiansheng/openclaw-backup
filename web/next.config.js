/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@nextui-org/react'],
  experimental: {
    serverComponentsExternalPackages: ['@nextui-org/react']
  }
}

module.exports = nextConfig
