/**
 * Converts a positive number to English and Arabic words for ZATCA tax invoice representation.
 */

export function numberToArabicWords(num: number, currency: string = 'SAR'): string {
  if (isNaN(num)) return ''
  const wholePart = Math.floor(Math.abs(num))
  const decimalPart = Math.round((Math.abs(num) - wholePart) * 100)

  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة']
  const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر']
  const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون']
  const hundreds = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة']

  function convertHundreds(n: number): string {
    let res = ''
    const h = Math.floor(n / 100)
    const rem = n % 100

    if (h > 0) res += hundreds[h]

    if (rem > 0) {
      if (res !== '') res += ' و '
      if (rem < 10) {
        res += ones[rem]
      } else if (rem < 20) {
        res += teens[rem - 10]
      } else {
        const u = rem % 10
        const t = Math.floor(rem / 10)
        if (u > 0) {
          res += ones[u] + ' و ' + tens[t]
        } else {
          res += tens[t]
        }
      }
    }
    return res
  }

  function convertFull(n: number): string {
    if (n === 0) return 'صفر'
    let res = ''

    const billions = Math.floor(n / 1000000000)
    const millions = Math.floor((n % 1000000000) / 1000000)
    const thousands = Math.floor((n % 1000000) / 1000)
    const remaining = n % 1000

    if (billions > 0) {
      res += convertHundreds(billions) + ' مليار'
    }
    if (millions > 0) {
      if (res !== '') res += ' و '
      res += convertHundreds(millions) + ' مليون'
    }
    if (thousands > 0) {
      if (res !== '') res += ' و '
      if (thousands === 1) res += 'ألف'
      else if (thousands === 2) res += 'ألفان'
      else res += convertHundreds(thousands) + ' ألف'
    }
    if (remaining > 0) {
      if (res !== '') res += ' و '
      res += convertHundreds(remaining)
    }

    return res
  }

  const mainUnit = currency === 'SAR' ? 'ريال سعودي' : currency === 'INR' ? 'روبية' : currency
  const subUnit = currency === 'SAR' ? 'هللة' : 'بيسة'

  const wholeArabic = convertFull(wholePart)
  if (decimalPart > 0) {
    const decArabic = convertHundreds(decimalPart)
    return `${wholeArabic} ${mainUnit} و ${decArabic} ${subUnit} فقط لا غير`
  }
  return `${wholeArabic} ${mainUnit} فقط لا غير`
}

export function numberToWords(num: number, currency: string = 'SAR'): string {
  if (isNaN(num)) return ''
  const wholePart = Math.floor(Math.abs(num))
  const decimalPart = Math.round((Math.abs(num) - wholePart) * 100)

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ]
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  function inWords(n: number): string {
    if (n === 0) return ''
    if (n < 20) return a[n]
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '')
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + inWords(n % 100) : '')
    if (n < 1000000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '')
    if (n < 1000000000) return inWords(Math.floor(n / 1000000)) + ' Million' + (n % 1000000 !== 0 ? ' ' + inWords(n % 1000000) : '')
    return inWords(Math.floor(n / 1000000000)) + ' Billion' + (n % 1000000000 !== 0 ? ' ' + inWords(n % 1000000000) : '')
  }

  const wholeStr = wholePart === 0 ? 'Zero' : inWords(wholePart)
  const currencyUnit = currency === 'SAR' ? 'Saudi Riyals' : currency === 'INR' ? 'Rupees' : currency

  if (decimalPart > 0) {
    const fractionUnit = currency === 'SAR' ? 'Halalas' : 'Paise'
    return `${wholeStr} ${currencyUnit} and ${inWords(decimalPart)} ${fractionUnit} Only`
  }

  return `${wholeStr} ${currencyUnit} Only`
}
