'use client'

import { Payslip, Profile } from '@/types/database'
import {
  formatCurrencyAmount,
  getMonthName,
  getSalaryPeriod,
  getDaysInMonth,
  getDefaultStatutoryDeductions,
} from '@/lib/payroll-utils'

export interface ZipExportProgress {
  current: number
  total: number
  currentFileName: string
}

let logoBase64Cache: string | null = null
let watermarkBase64Cache: string | null = null

async function imagePathToBase64(path: string): Promise<string> {
  if (typeof window === 'undefined') return path
  try {
    const res = await fetch(path)
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        resolve(reader.result as string)
      }
      reader.onerror = () => resolve(path)
      reader.readAsDataURL(blob)
    })
  } catch {
    return path
  }
}

async function getLogoBase64(): Promise<string> {
  if (logoBase64Cache) return logoBase64Cache
  logoBase64Cache = await imagePathToBase64('/Adonix pay slip logo.png')
  return logoBase64Cache
}

async function getWatermarkBase64(): Promise<string> {
  if (watermarkBase64Cache) return watermarkBase64Cache
  watermarkBase64Cache = await imagePathToBase64('/Adonix X Logo.jpeg')
  return watermarkBase64Cache
}

/**
 * Generates exact printable HTML string for an Adonix Payslip
 * Matching PayslipDocument.tsx 1:1
 */
export function generateAdonixPayslipHTML(
  payslip: Payslip,
  profile?: Profile,
  logoSrc: string = '/Adonix pay slip logo.png',
  watermarkSrc: string = '/Adonix X Logo.jpeg'
): string {
  const monthName = getMonthName(payslip.month)
  const currency = payslip.currency || 'INR'
  const isINR = currency === 'INR'

  const formatPeriodDate = (dStr: string) => {
    try {
      return new Date(dStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return dStr
    }
  }

  const salaryPeriod = (payslip.period_start_date && payslip.period_end_date)
    ? `${formatPeriodDate(payslip.period_start_date)} – ${formatPeriodDate(payslip.period_end_date)}`
    : getSalaryPeriod(payslip.year, payslip.month)
  const totalMonthDays = getDaysInMonth(payslip.year, payslip.month)
  const workingDays = payslip.working_days || totalMonthDays
  const paidDays = payslip.paid_days || workingDays
  const lopDays = payslip.lop_days || 0

  const monthStr = payslip.month < 10 ? `0${payslip.month}` : `${payslip.month}`
  const empCodeClean = payslip.employee_code || payslip.id.slice(0, 5).toUpperCase()
  const payslipRefNumber = `ADX/PAY/${payslip.year}-${monthStr}/${empCodeClean}`

  const deductionsList = (payslip.deductions_breakdown && payslip.deductions_breakdown.length > 0)
    ? payslip.deductions_breakdown
    : getDefaultStatutoryDeductions(currency)

  const bankName = payslip.bank_name || (isINR ? 'HDFC Bank' : 'Al Rajhi Bank')
  const maskedAccount = payslip.account_number
    ? `•••• •••• ${payslip.account_number.slice(-4)}`
    : '•••• •••• 3273'

  const paymentDateStr = payslip.payment_date
    ? new Date(payslip.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : `${totalMonthDays} ${monthName.slice(0, 3)} ${payslip.year}`

  const empName = payslip.employee?.name || profile?.name || '—'
  const empCode = payslip.employee_code ?? `ADX-${(payslip.employee_id || payslip.id || '').slice(0, 5).toUpperCase()}`
  const designation = payslip.designation ?? payslip.employee?.specialization ?? profile?.specialization ?? 'Specialist'
  const department = payslip.department ?? 'Operations'
  const joiningDate = payslip.joining_date || '01 Dec 2025'

  // Build earnings rows
  const earningsRows = (payslip.earnings_breakdown || []).map((item, idx, arr) => `
    <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: ${idx === arr.length - 1 ? 'none' : '1px dashed #E2E8F0'}; font-size: 11.5px;">
      <span style="color: #334155;">${item.name}</span>
      <span style="font-weight: 700; color: #0F172A;">${formatCurrencyAmount(item.amount, currency)}</span>
    </div>
  `).join('')

  // Build deductions rows
  const activeDeductions = deductionsList.filter(d => d.amount > 0)
  const deductionsRows = activeDeductions.map((item, idx, arr) => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: ${idx === arr.length - 1 ? 'none' : '1px dashed #E2E8F0'}; font-size: 11.5px;">
      <span style="color: #0F172A;">${item.name}</span>
      <span style="font-weight: 700; color: #DC2626;">- ${formatCurrencyAmount(item.amount, currency)}</span>
    </div>
  `).join('')

  return `
    <div style="width: 794px; background: #ffffff; color: #0F172A; font-family: 'Calibri', 'Arial', 'Helvetica', sans-serif; font-size: 13.5px; line-height: 1.55; padding: 36px 44px; margin: 0; box-sizing: border-box; position: relative;">
      
      <!-- Faded Watermark background -->
      <div style="position: absolute; top: 52%; left: 50%; transform: translate(-50%, -50%); opacity: 0.045; pointer-events: none; z-index: 0; width: 340px; height: 340px; display: flex; align-items: center; justify-content: center;">
        <img
          src="${watermarkSrc}"
          alt="Adonix Watermark"
          style="width: 100%; height: 100%; object-fit: contain; display: block;"
        />
      </div>

      <div style="position: relative; z-index: 1; padding-right: 4px;">
        <!-- HEADER & BRANDING -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0F172A; padding-bottom: 16px; margin-bottom: 24px; font-family: 'Calibri', 'Arial', 'Helvetica', sans-serif;">
          <div style="display: flex; align-items: center; gap: 18px;">
            <img
              src="${logoSrc}"
              alt="Adonix Logo"
              style="width: 110px; height: auto; object-fit: contain; display: block;"
            />
            <div>
              <div style="font-size: 20px; color: #0F172A; font-weight: 800; letter-spacing: -0.02em; line-height: 1.2;">
                ADONIX
              </div>
              <div style="font-size: 11px; color: #475569; margin-top: 4px; line-height: 1.4;">
                ${isINR ? `
                  <div><strong>GSTIN:</strong> 36FXMPS8335A1Z4</div>
                  <div>5-5-201/2, Patel Nagar, Darussalam Road, Khairatabad</div>
                  <div>Hyderabad, Telangana - 500004, India</div>
                ` : `
                  <div><strong>C.R.</strong> 4030138081</div>
                  <div>Office #602, Matbouli Plaza, Fayd Al Samaa St</div>
                  <div>Jeddah, Kingdom of Saudi Arabia</div>
                `}
              </div>
            </div>
          </div>

          <div style="text-align: right;">
            <div style="display: inline-block; background: #0F172A; color: #ffffff; padding: 3px 10px; font-size: 12px; font-weight: 800; letter-spacing: 0.02em; margin-bottom: 6px;">
              SALARY SLIP — ${monthName.toUpperCase()} ${payslip.year}
            </div>
            <div style="font-size: 11px; color: #0F172A; line-height: 1.4;">
              Salary Period: <strong>${salaryPeriod}</strong>
            </div>
            <div style="font-size: 11px; color: #64748B; margin-top: 1px; line-height: 1.4;">
              Financial Year: <strong>${payslip.financial_year}</strong>
            </div>
            <div style="font-size: 11px; color: #64748B; margin-top: 1px; line-height: 1.4;">
              Ref No: <strong style="color: #0F172A;">${payslipRefNumber}</strong>
            </div>
          </div>
        </div>

        <!-- NET PAY SUMMARY BANNER -->
        <div style="background: #F8FAFC; border: 1px solid #CBD5E1; padding: 16px 22px; color: #0F172A; display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
          <div>
            <div style="font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700;">
              Net Salary Payable
            </div>
            <div style="font-size: 24px; font-weight: 850; color: #0F172A; margin-top: 1px;">
              ${formatCurrencyAmount(payslip.net_pay, currency)}
            </div>
            <div style="font-size: 12px; color: #475569; margin-top: 1px; font-style: italic; font-weight: 600;">
              ${payslip.net_pay_in_words || '—'}
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 16px; border-left: 1px solid #CBD5E1; padding-left: 16px;">
            <div style="text-align: right;">
              <div style="font-size: 10.5px; color: #64748B; font-weight: 600;">Gross Salary</div>
              <div style="font-size: 15.5px; font-weight: 700; color: #16A34A; margin-top: 1px;">
                ${formatCurrencyAmount(payslip.gross_earnings, currency)}
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 10.5px; color: #64748B; font-weight: 600;">Deductions</div>
              <div style="font-size: 15.5px; font-weight: 700; color: ${payslip.total_deductions > 0 ? '#DC2626' : '#64748B'}; margin-top: 1px;">
                ${formatCurrencyAmount(payslip.total_deductions, currency)}
              </div>
            </div>
          </div>
        </div>

        <!-- EMPLOYEE & DISBURSEMENT DETAILS TABLE -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #CBD5E1; margin-bottom: 24px; font-size: 11.5px;">
          <tbody>
            <tr>
              <td style="padding: 8px 12px; background: #F8FAFC; border: 1px solid #CBD5E1; font-weight: 600; color: #475569; width: 18%;">Employee Name</td>
              <td style="padding: 8px 12px; border: 1px solid #CBD5E1; font-weight: 700; color: #0F172A; width: 32%;">${empName}</td>
              <td style="padding: 8px 12px; background: #F8FAFC; border: 1px solid #CBD5E1; font-weight: 600; color: #475569; width: 18%;">Employee ID</td>
              <td style="padding: 8px 12px; border: 1px solid #CBD5E1; font-weight: 600; color: #0F172A; width: 32%;">${empCode}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #F8FAFC; border: 1px solid #CBD5E1; font-weight: 600; color: #475569;">Designation</td>
              <td style="padding: 8px 12px; border: 1px solid #CBD5E1; font-weight: 600; color: #0F172A;">${designation}</td>
              <td style="padding: 8px 12px; background: #F8FAFC; border: 1px solid #CBD5E1; font-weight: 600; color: #475569;">Department</td>
              <td style="padding: 8px 12px; border: 1px solid #CBD5E1; font-weight: 600; color: #0F172A;">${department}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #F8FAFC; border: 1px solid #CBD5E1; font-weight: 600; color: #475569;">Date of Joining</td>
              <td style="padding: 8px 12px; border: 1px solid #CBD5E1; font-weight: 600; color: #0F172A;">${joiningDate}</td>
              <td style="padding: 8px 12px; background: #F8FAFC; border: 1px solid #CBD5E1; font-weight: 600; color: #475569;">Bank &amp; Account</td>
              <td style="padding: 8px 12px; border: 1px solid #CBD5E1; font-weight: 600; color: #0F172A;">${bankName} • ${maskedAccount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #F8FAFC; border: 1px solid #CBD5E1; font-weight: 600; color: #475569;">${isINR ? 'IFSC Code' : 'IBAN'}</td>
              <td style="padding: 8px 12px; border: 1px solid #CBD5E1; font-weight: 600; color: #0F172A;">${payslip.ifsc_or_iban || 'Verified'}</td>
              <td style="padding: 8px 12px; background: #F8FAFC; border: 1px solid #CBD5E1; font-weight: 600; color: #475569;">${isINR ? 'PAN Number' : 'Iqama / ID'}</td>
              <td style="padding: 8px 12px; border: 1px solid #CBD5E1; font-weight: 600; color: #0F172A;">${payslip.pan_or_iqama || 'On File'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #F8FAFC; border: 1px solid #CBD5E1; font-weight: 600; color: #475569;">Working / Paid Days</td>
              <td style="padding: 8px 12px; border: 1px solid #CBD5E1; font-weight: 600; color: #0F172A;">${workingDays} / ${paidDays} Days</td>
              <td style="padding: 8px 12px; background: #F8FAFC; border: 1px solid #CBD5E1; font-weight: 600; color: #475569;">Payment Date</td>
              <td style="padding: 8px 12px; border: 1px solid #CBD5E1; font-weight: 600; color: #16A34A;">${paymentDateStr}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #F8FAFC; border: 1px solid #CBD5E1; font-weight: 600; color: #475569;">UAN / PF Number</td>
              <td style="padding: 8px 12px; border: 1px solid #CBD5E1; font-weight: 600; color: #0F172A;">Not Applicable</td>
              <td style="padding: 8px 12px; background: #F8FAFC; border: 1px solid #CBD5E1; font-weight: 600; color: #475569;">Loss of Pay (LOP)</td>
              <td style="padding: 8px 12px; border: 1px solid #CBD5E1; font-weight: 600; color: ${lopDays > 0 ? '#DC2626' : '#64748B'};">${lopDays} Days</td>
            </tr>
          </tbody>
        </table>

        <!-- TWO-COLUMN SALARY BREAKDOWN TABLE -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid #CBD5E1; margin-bottom: 24px;">
          <!-- EARNINGS COLUMN -->
          <div style="border-right: 1px solid #CBD5E1;">
            <div style="background: #F1F5F9; padding: 8px 12px; font-weight: 700; font-size: 11.5px; color: #0F172A; border-bottom: 1px solid #CBD5E1; display: flex; justify-content: space-between;">
              <span>EARNINGS</span>
              <span>AMOUNT (${currency})</span>
            </div>
            <div style="padding: 8px 12px; min-height: 180px;">
              ${earningsRows}
            </div>
            <div style="background: #F8FAFC; padding: 8px 12px; border-top: 1px solid #CBD5E1; font-weight: 700; display: flex; justify-content: space-between; color: #16A34A; font-size: 12px;">
              <span>Total Gross Salary</span>
              <span>${formatCurrencyAmount(payslip.gross_earnings, currency)}</span>
            </div>
          </div>

          <!-- DEDUCTIONS COLUMN -->
          <div>
            <div style="background: #F1F5F9; padding: 8px 12px; font-weight: 700; font-size: 11.5px; color: #0F172A; border-bottom: 1px solid #CBD5E1; display: flex; justify-content: space-between;">
              <span>DEDUCTIONS</span>
              <span>AMOUNT (${currency})</span>
            </div>
            <div style="padding: 8px 12px; min-height: 180px;">
              ${payslip.total_deductions === 0 ? `
                <div style="color: #64748B; font-size: 11.5px; font-style: italic; padding: 24px 0; text-align: center;">
                  No deductions applied for this period.
                </div>
              ` : deductionsRows}
            </div>
            <div style="background: #F8FAFC; padding: 8px 12px; border-top: 1px solid #CBD5E1; font-weight: 700; display: flex; justify-content: space-between; color: ${payslip.total_deductions > 0 ? '#DC2626' : '#64748B'}; font-size: 12px;">
              <span>Total Deductions</span>
              <span>${formatCurrencyAmount(payslip.total_deductions, currency)}</span>
            </div>
          </div>
        </div>

        <!-- NET SALARY CALLOUT ROW -->
        <div style="display: flex; justify-content: space-between; align-items: center; background: #F8FAFC; border: 1px solid #CBD5E1; padding: 12px 18px; margin-bottom: 24px;">
          <div>
            <div style="font-size: 10.5px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">
              TOTAL NET SALARY CREDITED
            </div>
            <div style="font-size: 12px; color: #0F172A; font-weight: 600; margin-top: 1px;">
              ${payslip.net_pay_in_words || '—'}
            </div>
          </div>
          <div style="font-size: 19px; font-weight: 800; color: #0F172A;">
            ${formatCurrencyAmount(payslip.net_pay, currency)}
          </div>
        </div>

        ${payslip.notes ? `
          <div style="border: 1px solid #CBD5E1; padding: 8px 12px; background: #F8FAFC; margin-bottom: 24px; font-size: 11.5px;">
            <strong>Remarks: </strong> ${payslip.notes}
          </div>
        ` : ''}

        <!-- FOOTER & BOILERPLATE SECTION -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding-top: 20px; border-top: 1px solid #E2E8F0; margin-top: 28px; position: relative;">
          <!-- Standard Boilerplate Policy Info -->
          <div style="flex: 1 1 50%; font-size: 10.5px; color: #64748B; line-height: 1.45;">
            <div style="font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 3px; letter-spacing: 0.02em; font-size: 11px;">
              Important Notes
            </div>
            <ul style="padding-left: 12px; margin: 0; display: flex; flex-direction: column; gap: 1.5px;">
              <li>This payslip is a confidential record between Adonix and the employee.</li>
              <li>For any queries or discrepancies, please contact management/admin directly.</li>
              <li>This is a computer-generated statement and requires no physical signature.</li>
            </ul>
          </div>

          <!-- Signature Block -->
          <div style="flex: 0 0 210px; position: relative; text-align: center;">
            <div style="height: 44px; display: flex; align-items: flex-end; justify-content: center; color: #0F172A; font-weight: 700; font-size: 15px; letter-spacing: 0.5px; margin-bottom: 3px;">
              Nabeel Syed Yousuf
            </div>
            <div style="border-top: 1.5px solid #0F172A; margin: 3px 0; width: 100%;"></div>
            <div style="fontSize: 11px; font-weight: 700; color: #0F172A;">
              Nabeel Syed Yousuf
            </div>
            <div style="font-size: 10px; color: #475569; font-weight: 600;">
              Managing Director / Authorised Signatory
            </div>
            <div style="font-size: 9.5px; color: #64748B;">
              Adonix Digital &amp; Marketing
            </div>
          </div>
        </div>

        <!-- PAGE FOOTER FINE PRINT -->
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #94A3B8; border-top: 1px solid #E2E8F0; margin-top: 28px; padding-top: 8px;">
          <div>
            ${isINR ? 'ADONIX • Confidential' : 'ADONIX • C.R. 4030138081 • Confidential'}
          </div>
          <div>
            Page 1 of 1
          </div>
        </div>
      </div>
    </div>
  `
}

/**
 * Builds the clean, standardized filename for an Adonix payslip PDF
 */
export function getPayslipPdfFileName(payslip: Payslip, profile?: Profile): string {
  const monthName = getMonthName(payslip.month)
  const monthStr = payslip.month < 10 ? `0${payslip.month}` : `${payslip.month}`
  const empName = (payslip.employee?.name || profile?.name || 'Staff')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')

  return `Adonix_${empName}_Payslip_${payslip.year}_${monthStr}_${monthName}.pdf`
}

/**
 * Converts a payslip into an exact A4 PDF Uint8Array buffer matching print layout
 */
export async function renderPayslipToPdfArrayBuffer(payslip: Payslip, profile?: Profile): Promise<Uint8Array> {
  const { jsPDF } = await import('jspdf')
  const html2canvas = (await import('html2canvas')).default
  
  const [logoBase64, watermarkBase64] = await Promise.all([
    getLogoBase64(),
    getWatermarkBase64(),
  ])

  // Create an off-screen container with exact A4 sheet width (794px at 96 DPI)
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.top = '-99999px'
  container.style.left = '-99999px'
  container.style.width = '794px'
  container.style.boxSizing = 'border-box'
  container.style.background = '#ffffff'
  container.style.zIndex = '-9999'
  container.innerHTML = generateAdonixPayslipHTML(payslip, profile, logoBase64, watermarkBase64)
  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container, {
      scale: 2.5, // 300 DPI high resolution
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 794,
    })

    const imgData = canvas.toDataURL('image/jpeg', 0.98)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    })

    // Standard A4 dimensions: 210mm x 297mm
    // Since the container contains the exact 36px 44px margins/paddings from PayslipDocument.tsx,
    // rendering full page (0, 0, 210, 297) replicates the exact printed PDF appearance 1:1!
    const printWidth = 210
    const printHeight = (canvas.height * printWidth) / canvas.width

    pdf.addImage(imgData, 'JPEG', 0, 0, printWidth, Math.min(297, printHeight), undefined, 'FAST')

    const arrayBuffer = pdf.output('arraybuffer')
    return new Uint8Array(arrayBuffer)
  } finally {
    document.body.removeChild(container)
  }
}

/**
 * Direct single payslip PDF download
 */
export async function downloadSinglePayslipPdf(payslip: Payslip, profile?: Profile): Promise<void> {
  const pdfBuffer = await renderPayslipToPdfArrayBuffer(payslip, profile)
  const fileName = getPayslipPdfFileName(payslip, profile)
  const blob = new Blob([pdfBuffer.buffer as ArrayBuffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Packages multiple payslips into a single .ZIP archive containing individual PDFs
 */
export async function exportPayslipsAsZip(
  payslips: Payslip[],
  profile: Profile,
  financialYear: string = 'ALL',
  onProgress?: (progress: ZipExportProgress) => void
): Promise<void> {
  if (!payslips || payslips.length === 0) return

  const JSZip = (await import('jszip')).default
  const zip = new JSZip()

  const total = payslips.length
  for (let i = 0; i < total; i++) {
    const payslip = payslips[i]
    const fileName = getPayslipPdfFileName(payslip, profile)

    if (onProgress) {
      onProgress({
        current: i + 1,
        total,
        currentFileName: fileName,
      })
    }

    const pdfBuffer = await renderPayslipToPdfArrayBuffer(payslip, profile)
    zip.file(fileName, pdfBuffer)
  }

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  const cleanEmpName = (profile.name || 'Staff').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')
  const cleanFY = financialYear.replace(/[^\w-]/g, '_')
  const zipFileName = `Adonix_Payslips_${cleanEmpName}_${cleanFY}.zip`

  const downloadUrl = URL.createObjectURL(zipBlob)
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = zipFileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(downloadUrl)
}
