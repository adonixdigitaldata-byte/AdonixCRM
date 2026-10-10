// ZATCA (FATOORA) TLV QR Code Generator according to Annex 2 & Phase 1/2 Guidelines
// TLV = Tag-Length-Value encoded in UTF-8 and converted to Base64

export interface ZatcaTlvFields {
  sellerName: string       // Tag 1: Seller's name
  vatNumber: string        // Tag 2: 15-digit VAT registration number
  timestamp: string        // Tag 3: Issue date & time (ISO 8601, e.g., 2026-10-07T12:00:00Z)
  totalAmount: string      // Tag 4: Invoice total inclusive of VAT (e.g. 1150.00)
  vatAmount: string        // Tag 5: Total VAT amount (e.g. 150.00)
  invoiceHash?: string     // Tag 6: SHA-256 hash of invoice XML (Phase 2)
  ecdsaSignature?: string  // Tag 7: ECDSA digital signature (Phase 2)
  publicKey?: string       // Tag 8: ECDSA public key (Phase 2)
  certificateSig?: string  // Tag 9: Cryptographic stamp signature by ZATCA CA (Phase 2)
}

function encodeTlvItem(tag: number, val: string): Uint8Array {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(val)
  const len = bytes.length
  const res = new Uint8Array(2 + len)
  res[0] = tag
  res[1] = len
  res.set(bytes, 2)
  return res
}

/**
 * Formats a timestamp into standard ZATCA ISO 8601 format:
 * `YYYY-MM-DDTHH:mm:ssZ` (strictly omitting fractional milliseconds).
 */
export function formatZatcaTimestamp(input?: string | Date): string {
  try {
    const d = input ? new Date(input) : new Date()
    if (isNaN(d.getTime())) {
      return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
    }
    return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
  } catch {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  }
}

/**
 * Generate standard ZATCA TLV Base64 string from fields.
 */
export function generateZatcaTlvBase64(data: ZatcaTlvFields): string {
  const cleanTimestamp = formatZatcaTimestamp(data.timestamp)
  const parts: Uint8Array[] = [
    encodeTlvItem(1, data.sellerName || 'Asaheeb and Adonix Developments Company'),
    encodeTlvItem(2, data.vatNumber || '315081325900003'),
    encodeTlvItem(3, cleanTimestamp),
    encodeTlvItem(4, data.totalAmount),
    encodeTlvItem(5, data.vatAmount),
  ]

  if (data.invoiceHash) parts.push(encodeTlvItem(6, data.invoiceHash))
  if (data.ecdsaSignature) parts.push(encodeTlvItem(7, data.ecdsaSignature))
  if (data.publicKey) parts.push(encodeTlvItem(8, data.publicKey))
  if (data.certificateSig) parts.push(encodeTlvItem(9, data.certificateSig))

  const totalLen = parts.reduce((acc, p) => acc + p.length, 0)
  const merged = new Uint8Array(totalLen)
  let offset = 0
  for (const part of parts) {
    merged.set(part, offset)
    offset += part.length
  }

  // Convert Uint8Array to Base64 in browser or node
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    let binary = ''
    const len = merged.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(merged[i])
    }
    return window.btoa(binary)
  }

  return Buffer.from(merged).toString('base64')
}
