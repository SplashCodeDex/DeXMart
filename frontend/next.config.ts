import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    // Enable Cache Components (includes Partial Prerendering)
    cacheComponents: true,
    
    // Transpile local workspace packages
    transpilePackages: ['@DeXMart/shared'],

    // Turbopack configuration (default in Next.js 16)
    turbopack: {
        rules: {
            // Custom Turbopack rules if needed
        },
    },

    // Experimental features
    experimental: {
        // Server Actions configuration
        serverActions: {
            bodySizeLimit: '2mb',
        },
    },

    // Image optimization
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'firebasestorage.googleapis.com',
            },
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com',
            },
        ],
    },

    // Environment variables exposed to browser
    env: {
        NEXT_PUBLIC_APP_NAME: 'DeXMart',
    },

    // Security headers
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    { key: 'X-DNS-Prefetch-Control', value: 'on' },
                    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                ],
            },
        ];
    },

    // Route-level redirects (handled before rendering — avoids PPR prerender instrumentation)
    async redirects() {
        return [
            {
                source: '/dashboard',
                destination: '/dashboard/home',
                permanent: false,
            },
        ];
    },

    // Proxy API and Gateway requests
    async rewrites() {
        const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
        const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:19001';

        return [
            {
                source: '/api/:path*',
                destination: `${BACKEND_URL}/api/:path*`,
            },
            {
                source: '/gateway/ws',
                destination: `${GATEWAY_URL}/`,
            },
        ];
    },
};

export default nextConfig;
