import type { Preview, Decorator } from '@storybook/nextjs'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import '../app/globals.css'

const withQueryClient: Decorator = (Story, context) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  // Pre-populate cache from story parameters
  if (context.parameters.queryData) {
    Object.entries(
      context.parameters.queryData as Record<string, unknown>,
    ).forEach(([key, data]) => {
      queryClient.setQueryData(JSON.parse(key), data)
    })
  }
  return (
    <QueryClientProvider client={queryClient}>
      <div className="bg-slate-900 min-h-screen p-6">
        <Story />
      </div>
    </QueryClientProvider>
  )
}

export default {
  decorators: [withQueryClient],
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { config: {} },
  },
} satisfies Preview
