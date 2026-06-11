import { type NextRequest, NextResponse } from 'next/server'
import { triggerAnniversaryBonus } from '@/mocks/hcm-engine'

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { employeeId: string }
  const result = triggerAnniversaryBonus(body.employeeId)
  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
