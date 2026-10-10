'use client'

import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { generateZatcaTlvBase64, ZatcaTlvFields } from '@/lib/zatca/qrGenerator'

interface ZatcaQrProps {
  fields: ZatcaTlvFields
  size?: number
  className?: string
}

export default function ZatcaQrCode({ fields, size = 110, className = '' }: ZatcaQrProps) {
  const [dataUrl, setDataUrl] = useState<string>('')

  useEffect(() => {
    try {
      const tlvBase64 = generateZatcaTlvBase64(fields)
      QRCode.toDataURL(tlvBase64, {
        errorCorrectionLevel: 'M',
        margin: 0, // Zero margin to prevent any unwanted internal whitespace
        width: size * 2, // 2x resolution for crisp lines
      }).then((url) => {
        setDataUrl(url)
      }).catch((err) => {
        console.error('Failed to generate ZATCA QR code:', err)
      })
    } catch (e) {
      console.error('ZATCA TLV encoding error:', e)
    }
  }, [
    fields.sellerName,
    fields.vatNumber,
    fields.timestamp,
    fields.totalAmount,
    fields.vatAmount,
    fields.invoiceHash,
    size,
  ])

  if (!dataUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-50 border border-gray-300 rounded ${className}`}
        style={{ width: size, height: size, fontSize: 11, color: '#666' }}
      >
        <span>QR...</span>
      </div>
    )
  }

  return (
    <div className={`inline-flex flex-col items-center ${className}`} style={{ width: 'auto' }}>
      <img
        src={dataUrl}
        alt="ZATCA E-Invoice QR Code"
        style={{ width: size, height: size, display: 'block', margin: 0, padding: 0 }}
      />
    </div>
  )
}
