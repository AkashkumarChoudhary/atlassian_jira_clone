import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // jose ships webapi/ESM only; transpile it so Jest (next/jest) can load it.
  transpilePackages: ['jose'],
}

export default nextConfig
