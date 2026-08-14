import type { Metadata } from 'next'
import '@/app/globals.css'

export const metadata: Metadata = {
  title: {
    template: '%s — Adonix CRM',
    default: 'Adonix CRM',
  },
  description: 'Meta Ads CRM & Quotation/Invoicing Platform by Adonix',
  icons: {
    icon: '/Adonix X Logo.jpeg',
    shortcut: '/Adonix X Logo.jpeg',
    apple: '/Adonix X Logo.jpeg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
