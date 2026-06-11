import Link from 'next/link'

export function AppNav() {
  return (
    <header className="border-b border-slate-700/60 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <span className="text-sm font-semibold tracking-wide text-amber-400 uppercase">
          ExampleHR
        </span>
        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className="rounded-md px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            My Time Off
          </Link>
          <Link
            href="/manager"
            className="rounded-md px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            Manager View
          </Link>
        </nav>
      </div>
    </header>
  )
}
