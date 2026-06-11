import { NextResponse } from 'next/server'
import { getEmployees } from '@/mocks/hcm-engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  const employees = getEmployees()
  return NextResponse.json({ employees })
}
