import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const origin = new URL(request.url).origin
  const response = NextResponse.redirect(new URL('/login', origin))
  response.cookies.delete(SESSION_COOKIE)
  return response
}

export async function POST(request: Request) {
  return GET(request)
}
