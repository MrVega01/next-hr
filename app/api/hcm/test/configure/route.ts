import { type NextRequest, NextResponse } from 'next/server'
import { setForceNextConflict, setForceNextSilentFail, setSilentFailRate } from '@/mocks/hcm-engine'

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    silentFailRate?: number
    forceNextSilentFail?: boolean
    forceNextConflict?: boolean
  }

  if (body.silentFailRate !== undefined) setSilentFailRate(body.silentFailRate)
  if (body.forceNextSilentFail !== undefined) setForceNextSilentFail(body.forceNextSilentFail)
  if (body.forceNextConflict !== undefined) setForceNextConflict(body.forceNextConflict)

  return NextResponse.json({ ok: true })
}
