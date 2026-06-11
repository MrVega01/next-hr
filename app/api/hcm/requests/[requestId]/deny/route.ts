import { type NextRequest, NextResponse } from 'next/server'
import { denyRequest } from '@/mocks/hcm-engine'

export async function PUT(
  _request: NextRequest,
  ctx: { params: Promise<{ requestId: string }> },
) {
  const { requestId } = await ctx.params
  const result = denyRequest(requestId)
  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
