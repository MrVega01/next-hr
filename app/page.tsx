// The "/" route is served by app/(employee)/page.tsx via the route group.
// Next.js uses the route group's page.tsx when both exist at the same URL.
// This file is kept to satisfy tooling but should not define conflicting routes.
export { default } from './(employee)/page'
