import { type NextRequest, NextResponse } from 'next/server'
import { approveRequest } from '@/mocks/hcm-engine'

export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<{ requestId: string }> },
) {
  const { requestId } = await ctx.params
  const body = (await request.json()) as { expectedVersion: string }
  const result = approveRequest(requestId, body.expectedVersion)
  const status = result.success
    ? 200
    : result.errorCode === 'VERSION_CONFLICT'
      ? 409
      : result.errorCode === 'INSUFFICIENT_BALANCE'
        ? 422
        : 400
  return NextResponse.json(result, { status })
}
