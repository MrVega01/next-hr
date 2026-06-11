'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { queryClient } from '@/lib/query-client'

// MSW browser worker is not used in the running app — the Next.js route
// handlers under app/api/hcm/ already proxy to the mock HCM engine, giving
// a single consistent in-memory state for both the app and Playwright tests.
// MSW is wired in Storybook (via story parameters) and Vitest (server.ts).

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  )
}
