import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'learn-skit',
    short_name: 'learn-skit',
    description: 'EVS and Quantitative & Qualitative Skills revision',
    start_url: '/#/',
    display: 'standalone',
    background_color: '#F6F5FD',
    theme_color: '#F6F5FD',
    icons: [
      {
        src: '/icons/app-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/app-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
