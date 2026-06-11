import { type NextRequest, NextResponse } from 'next/server'
import { getRequests, submitRequest } from '@/mocks/hcm-engine'
import type { TimeOffRequest } from '@/features/time-off/types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const employeeId = searchParams.get('employeeId') ?? undefined
  const requests = getRequests(employeeId)
  return NextResponse.json({ requests })
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Omit<
    TimeOffRequest,
    'id' | 'status' | 'createdAt' | 'updatedAt'
  >
  const result = submitRequest(body)
  const status = result.success ? 200 : result.errorCode === 'INSUFFICIENT_BALANCE' ? 422 : 400
  return NextResponse.json(result, { status })
}
