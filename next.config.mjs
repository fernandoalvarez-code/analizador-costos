/** @type {import('next').NextConfig} */
const nextConfig = {
  // El alta abierta con email y contraseña se cierra en producción; en desarrollo sigue disponible
  // (NODE_ENV !== 'production') para probar en localhost.
  async redirects() {
    return process.env.NODE_ENV === 'production'
      ? [{ source: '/signup', destination: '/login', permanent: false }]
      : [];
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
