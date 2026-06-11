import { type NextRequest, NextResponse } from 'next/server'
import { getBalance } from '@/mocks/hcm-engine'
import type { BalanceType } from '@/features/time-off/types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const employeeId = searchParams.get('employeeId')
  const locationId = searchParams.get('locationId')
  const balanceType = searchParams.get('balanceType') as BalanceType | null

  if (!employeeId || !locationId || !balanceType) {
    return NextResponse.json(
      { error: 'employeeId, locationId, and balanceType are required' },
      { status: 400 },
    )
  }

  const balance = getBalance(employeeId, locationId, balanceType)
  if (!balance) {
    return NextResponse.json({ error: 'Balance not found' }, { status: 404 })
  }

  return NextResponse.json({ balance })
}
