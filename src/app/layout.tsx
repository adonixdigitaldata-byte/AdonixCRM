import type { Metadata } from 'next'
import '@/app/globals.css'

export const metadata: Metadata = {
  title: {
    template: '%s — Adonix CRM',
    default: 'Adonix CRM',
  },
  description: 'Meta Ads CRM & Quotation/Invoicing Platform by Adonix',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
