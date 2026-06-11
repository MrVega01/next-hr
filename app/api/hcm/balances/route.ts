import { type NextRequest, NextResponse } from 'next/server'
import { getBatchBalances } from '@/mocks/hcm-engine'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const employeeId = searchParams.get('employeeId')

  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId is required' }, { status: 400 })
  }

  const balances = getBatchBalances(employeeId)
  return NextResponse.json({ balances, fetchedAt: new Date().toISOString() })
}
