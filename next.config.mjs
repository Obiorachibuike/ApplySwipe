/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enables src/instrumentation.ts, which boots the job platform workers
  // (provider sync / freshness sweep / match precomputation) once per process.
  experimental: {
    instrumentationHook: true,
  },
  // Provider secrets (ADZUNA_APP_ID / ADZUNA_APP_KEY) must never reach the
  // client bundle: only NEXT_PUBLIC_* variables are exposed to the browser, and
  // no ingestion code runs in a client component.
  reactStrictMode: true,
};

export default nextConfig;
