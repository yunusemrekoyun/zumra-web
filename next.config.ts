import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');
const isProductionBuild = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote placeholder images used by the public demo sections.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  output: 'standalone',
  serverExternalPackages: ['file-type'],
  transpilePackages: ['motion'],
  experimental: isProductionBuild
    ? {
        cpus: 1,
        webpackBuildWorker: true,
        webpackMemoryOptimizations: true,
      }
    : undefined,
  async headers() {
    const scriptSources = [
      "'self'",
      "'unsafe-inline'",
      ...(process.env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : []),
    ].join(' ');
    const securityHeaders = [
      {
        key: 'Content-Security-Policy-Report-Only',
        value: [
          "default-src 'self'",
          `script-src ${scriptSources}`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https://picsum.photos https://lh3.googleusercontent.com",
          "font-src 'self' data:",
          "media-src 'self' blob:",
          "connect-src 'self'",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "object-src 'none'",
          'report-uri /api/security/csp-report',
        ].join('; '),
      },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
    ];

    if (process.env.NODE_ENV === 'production') {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains',
      });
    }

    return [
      {
        headers: securityHeaders,
        source: '/:path*',
      },
    ];
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = {
        type: 'memory',
      };
    }

    // Optional local switch for disabling file watching in constrained environments.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
