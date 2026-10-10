export type OfficeLocationKey = 'KSA' | 'HYDERABAD'

export interface BankAccountDetails {
  bankName: string
  accountName: string
  accountNumber: string
  iban?: string
  swiftCode?: string
  ifscCode?: string
  branch?: string
}

export interface OfficeLocationInfo {
  key: OfficeLocationKey
  label: string
  shortName: string
  legalNameEn: string
  legalNameAr: string
  address: string
  addressAr: string
  mapUrl: string
  phone: string
  email?: string
  crNumber?: string | null
  vatNumber?: string | null // 15-digit Tax Registration Number (ZATCA TRN)
  national700Number?: string | null
  zatcaRequired: boolean
  bankDetails?: BankAccountDetails
}

export const OFFICE_LOCATIONS: Record<OfficeLocationKey, OfficeLocationInfo> = {
  KSA: {
    key: 'KSA',
    label: '🇸🇦 Saudi Arabia Office (Jeddah & Riyadh)',
    shortName: 'Saudi Arabia',
    legalNameEn: 'Asaheeb and Adonix Developments Company',
    legalNameAr: 'شركة اساهيب وادونيكس للتطوير',
    address: 'Al Muruj Dist, Al Olaya, Riyadh 12281, Kingdom of Saudi Arabia',
    addressAr: 'حي المروج، العليا، الرياض 12281، المملكة العربية السعودية',
    mapUrl: 'https://maps.app.goo.gl/vbcPiZJTmJ1hvqbv9',
    phone: '+966 53 849 8580',
    email: 'contact@adonixdigital.com',
    crNumber: '7055349166', // National Unified Number (700) / Commercial Registration
    vatNumber: '315081325900003', // Official 15-digit ZATCA VAT Registration Number
    national700Number: '7055349166',
    zatcaRequired: true,
    bankDetails: {
      bankName: 'Al Rajhi Bank / مصرف الراجحي',
      accountName: 'Asaheeb and Adonix Developments Co.',
      accountNumber: 'Available on request',
      iban: 'SA0000000000000000000000',
      swiftCode: 'RJHISARI',
    },
  },
  HYDERABAD: {
    key: 'HYDERABAD',
    label: '🇮🇳 India Office (Hyderabad)',
    shortName: 'Hyderabad, India',
    legalNameEn: 'Adonix Digital Tech',
    legalNameAr: 'ادونيكس ديجيتال',
    address: 'Rock Roof, Road No. 12, Kaushik Society, Banjara Hills, Hyderabad - 500034, India',
    addressAr: 'حيدر آباد، الهند',
    mapUrl: 'https://maps.app.goo.gl/6kUTEBvu4X5RKNGp9',
    phone: '+966 53 849 8580',
    email: 'contact@adonixdigital.com',
    crNumber: null,
    vatNumber: null,
    national700Number: null,
    zatcaRequired: false,
    bankDetails: {
      bankName: 'HDFC Bank',
      accountName: 'Adonix Digital Tech',
      accountNumber: 'Available on request',
      ifscCode: 'HDFC0000000',
      branch: 'Banjara Hills, Hyderabad',
    },
  },
}
