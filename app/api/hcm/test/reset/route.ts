import { NextResponse } from 'next/server'
import { resetState } from '@/mocks/hcm-engine'

export async function POST() {
  resetState()
  return NextResponse.json({ ok: true })
}
