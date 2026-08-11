export type OfficeLocationKey = 'KSA' | 'HYDERABAD'

export interface OfficeLocationInfo {
  key: OfficeLocationKey
  label: string
  shortName: string
  address: string
  mapUrl: string
  phone: string
  crNumber?: string | null
}

export const OFFICE_LOCATIONS: Record<OfficeLocationKey, OfficeLocationInfo> = {
  KSA: {
    key: 'KSA',
    label: '🇸🇦 Saudi Arabia Office (Jeddah)',
    shortName: 'Jeddah, KSA',
    address: 'Office #602, Matbouli Plaza, Fayd Al Samaa St, Jeddah, KSA',
    mapUrl: 'https://maps.app.goo.gl/vbcPiZJTmJ1hvqbv9',
    phone: '+966 53 849 8580',
    crNumber: 'C.R. 4030138081',
  },
  HYDERABAD: {
    key: 'HYDERABAD',
    label: '🇮🇳 India Office (Hyderabad)',
    shortName: 'Hyderabad, India',
    address: 'Rock Roof, Road No. 12, Kaushik Society, Banjara Hills, Hyderabad',
    mapUrl: 'https://maps.app.goo.gl/6kUTEBvu4X5RKNGp9',
    phone: '+966 53 849 8580',
    crNumber: null,
  },
}
