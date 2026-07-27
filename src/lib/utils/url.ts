import { NextRequest } from 'next/server'

export function getAppUrl(request?: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
  if (envUrl) {
    return envUrl.replace(/\/$/, '')
  }
  if (request) {
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
    const proto = request.headers.get('x-forwarded-proto') || 'https'
    if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      return `${proto}://${host}`
    }
  }
  return 'https://crm.adonixdigital.com'
}
