import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key')

export async function sendAgentInviteEmail(
  email: string,
  name: string,
  inviteLink: string,
  role: string = 'AGENT',
  specialization?: string | null,
  isReset: boolean = false
) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.includes('YOUR_')) {
    console.log(`[Email Mock] ${isReset ? 'Reset' : 'Invite'} link for ${email}: ${inviteLink}`)
    return
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Adonix <info@adonixdigital.com>'
  const isClient = role === 'CLIENT'

  let subject = 'You have been invited to Adonix CRM'
  if (isClient) {
    subject = isReset
      ? `Password Reset Request — Adonix Client Portal`
      : `Welcome to Your Adonix Client Portal, ${name}`
  } else {
    subject = isReset
      ? `Reset Your Password — Adonix CRM`
      : `You have been invited to Adonix CRM`
  }

  let roleLabel = 'an Account Manager'
  if (role === 'EMPLOYEE') {
    roleLabel = specialization ? `a ${specialization} Technical Specialist` : 'a Technical Employee'
  } else if (role === 'AGENT') {
    roleLabel = 'a Sales Agent'
  } else if (role === 'ACCOUNT_MANAGER') {
    roleLabel = 'an Account Manager'
  } else if (role === 'ADMIN') {
    roleLabel = 'an Admin'
  } else if (role === 'CLIENT') {
    roleLabel = 'our Client'
  }

  let htmlContent = ''
  if (isClient) {
    if (isReset) {
      htmlContent = `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 10px; background-color: #ffffff;">
          <div style="margin-bottom: 20px;">
            <span style="background-color: #4f46e5; color: #ffffff; padding: 6px 12px; border-radius: 6px; font-weight: 700; font-size: 13px; display: inline-block;">
              Adonix Client Portal
            </span>
          </div>
          <h2 style="color: #18181b; margin: 0 0 12px 0; font-size: 20px;">Password Reset Request</h2>
          <p style="color: #3f3f46; font-size: 14px; line-height: 1.5;">Hi <strong>${name}</strong>,</p>
          <p style="color: #3f3f46; font-size: 14px; line-height: 1.5;">
            We received a request to reset the password for your <strong>Adonix Client Access Portal</strong> account.
          </p>
          <p style="color: #52525b; font-size: 14px; line-height: 1.5; background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
            Click the button below to set up a new secure password and log back into your portal.
          </p>
          <div style="margin: 24px 0;">
            <a href="${inviteLink}" style="background-color: #4f46e5; color: white; padding: 12px 22px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">
              Reset Password &amp; Access Portal
            </a>
          </div>
          <p style="color: #a1a1aa; font-size: 12px;">If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
        </div>
      `
    } else {
      htmlContent = `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 10px; background-color: #ffffff;">
          <div style="margin-bottom: 20px;">
            <span style="background-color: #4f46e5; color: #ffffff; padding: 6px 12px; border-radius: 6px; font-weight: 700; font-size: 13px; display: inline-block;">
              Adonix Client Portal
            </span>
          </div>
          <h2 style="color: #18181b; margin: 0 0 12px 0; font-size: 20px;">Welcome to Adonix!</h2>
          <p style="color: #3f3f46; font-size: 14px; line-height: 1.5;">Hi <strong>${name}</strong>,</p>
          <p style="color: #3f3f46; font-size: 14px; line-height: 1.5;">
            You have been granted access to your dedicated <strong>Adonix Client Access Portal</strong>.
          </p>
          <p style="color: #52525b; font-size: 14px; line-height: 1.5; background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
            Through your portal, you can view project deliverables &amp; milestones, track quotations &amp; invoices, download monthly performance reports, and communicate with your dedicated account manager.
          </p>
          <div style="margin: 24px 0;">
            <a href="${inviteLink}" style="background-color: #4f46e5; color: white; padding: 12px 22px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">
              Set Up Password &amp; Access Portal
            </a>
          </div>
          <p style="color: #a1a1aa; font-size: 12px;">If you have any questions, please reply directly to this email or reach out to your Adonix Account Manager.</p>
        </div>
      `
    }
  } else {
    if (isReset) {
      htmlContent = `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
          <h2 style="color: #18181b; margin-bottom: 12px;">Reset Your Password</h2>
          <p style="color: #71717a; font-size: 14px;">Hi ${name},</p>
          <p style="color: #71717a; font-size: 14px;">We received a request to reset your password for Adonix CRM.</p>
          <div style="margin: 24px 0;">
            <a href="${inviteLink}" style="background-color: #4f46e5; color: white; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px; display: inline-block;">Reset Password</a>
          </div>
          <p style="color: #a1a1aa; font-size: 12px;">If you didn't request a password reset, please ignore this email.</p>
        </div>
      `
    } else {
      htmlContent = `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
          <h2 style="color: #18181b; margin-bottom: 12px;">Welcome to Adonix CRM</h2>
          <p style="color: #71717a; font-size: 14px;">Hi ${name},</p>
          <p style="color: #71717a; font-size: 14px;">You have been invited to join Adonix CRM as <strong>${roleLabel}</strong>.</p>
          <div style="margin: 24px 0;">
            <a href="${inviteLink}" style="background-color: #4f46e5; color: white; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px; display: inline-block;">Set up your password</a>
          </div>
          <p style="color: #a1a1aa; font-size: 12px;">If you didn't expect this invitation, please ignore this email.</p>
        </div>
      `
    }
  }

  try {
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: subject,
      html: htmlContent,
    })
  } catch (error) {
    console.error('Failed to send invite email:', error)
  }
}

export async function sendFollowupReminderEmail({
  agentEmail,
  agentName,
  leadName,
  leadPhone,
  followupNote,
  scheduledAt,
  leadId,
}: {
  agentEmail: string
  agentName: string
  leadName: string
  leadPhone?: string
  followupNote?: string
  scheduledAt: string
  leadId: string
}) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.includes('YOUR_')) {
    console.log(`[Email Mock] Follow-up reminder for ${agentEmail} regarding lead ${leadName}`)
    return
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Adonix <info@adonixdigital.com>'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.adonixdigital.com'
  const leadUrl = `${appUrl}/leads/${leadId}`

  // Format dual timezone (Saudi Arabia KSA & India IST)
  let ksaTime = scheduledAt
  let istTime = scheduledAt
  try {
    const d = new Date(scheduledAt)
    if (!isNaN(d.getTime())) {
      const opts: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }
      ksaTime = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'Asia/Riyadh' }).format(d)
      istTime = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'Asia/Kolkata' }).format(d)
    }
  } catch {}

  try {
    await resend.emails.send({
      from: fromEmail,
      to: agentEmail,
      subject: `⏰ Follow-up Reminder: ${leadName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
          <h2 style="color: #18181b; margin-bottom: 8px;">Upcoming Lead Follow-up</h2>
          <p style="color: #52525b; font-size: 14px;">Hi ${agentName},</p>
          <p style="color: #52525b; font-size: 14px;">You have a scheduled lead follow-up coming up in 15 minutes:</p>
          
          <div style="background-color: #f4f4f5; padding: 14px 16px; border-radius: 6px; margin: 16px 0;">
            <div style="font-size: 15px; font-weight: 600; color: #18181b;">${leadName}</div>
            ${leadPhone ? `<div style="font-size: 13px; color: #71717a; margin-top: 4px;">Phone: ${leadPhone}</div>` : ''}
            
            <div style="margin-top: 8px; font-size: 13px; color: #3f3f46;">
              <div style="font-weight: 600; color: #18181b; margin-bottom: 4px;">Scheduled Time:</div>
              <div style="padding-left: 8px; border-left: 3px solid #2563eb;">
                <div style="color: #27272a; margin-bottom: 2px;">🇸🇦 <strong>Saudi Arabia (KSA):</strong> ${ksaTime}</div>
                <div style="color: #27272a;">🇮🇳 <strong>India (IST):</strong> ${istTime}</div>
              </div>
            </div>

            ${followupNote ? `<div style="font-size: 13px; color: #3f3f46; margin-top: 10px; font-style: italic;">Note: "${followupNote}"</div>` : ''}
          </div>

          <div style="margin-top: 20px;">
            <a href="${leadUrl}" style="background-color: #2563eb; color: white; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px; display: inline-block;">Open Lead in Adonix CRM</a>
          </div>
        </div>
      `,
    })
  } catch (error) {
    console.error('Failed to send follow-up reminder email:', error)
  }
}

export async function sendClientMessageNotificationEmail({
  recipientEmail,
  recipientName,
  clientName,
  clientCompany,
  clientEmail,
  category,
  subject,
  message,
}: {
  recipientEmail: string
  recipientName: string
  clientName: string
  clientCompany?: string | null
  clientEmail?: string | null
  category: string
  subject: string
  message: string
}) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.includes('YOUR_')) {
    console.log(`[Email Mock] Client message to ${recipientEmail} from ${clientName}: ${subject}`)
    return
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Adonix <info@adonixdigital.com>'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.adonixdigital.com'

  try {
    await resend.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject: `📩 New Client Message: [${clientCompany || clientName}] ${subject}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 20px; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 10px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
            
            <!-- Header Badge & Subtitle Table -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px; width: 100%;">
              <tr>
                <td style="vertical-align: middle; width: 105px;">
                  <span style="background-color: #4f46e5; color: #ffffff; padding: 6px 12px; border-radius: 6px; font-weight: 700; font-size: 13px; display: inline-block; letter-spacing: 0.3px;">
                    Adonix CRM
                  </span>
                </td>
                <td style="vertical-align: middle; color: #71717a; font-size: 13px; font-weight: 500;">
                  Client Portal Notification
                </td>
              </tr>
            </table>

            <h2 style="color: #18181b; margin: 0 0 8px 0; font-size: 18px; font-weight: 700;">New Message from Client</h2>
            <p style="color: #52525b; font-size: 14px; margin: 0 0 16px 0; line-height: 1.4;">
              Hi <strong>${recipientName}</strong>, you received a new message submitted through the client portal:
            </p>

            <!-- Metadata Box -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; font-size: 13px;">
                <tr>
                  <td style="padding: 5px 0; color: #64748b; width: 90px; vertical-align: top;"><strong>Client:</strong></td>
                  <td style="padding: 5px 0; color: #0f172a; font-weight: 600;">${clientName} ${clientCompany ? `(${clientCompany})` : ''}</td>
                </tr>
                ${clientEmail ? `
                <tr>
                  <td style="padding: 5px 0; color: #64748b; vertical-align: top;"><strong>Email:</strong></td>
                  <td style="padding: 5px 0; color: #0f172a;"><a href="mailto:${clientEmail}" style="color: #4f46e5; text-decoration: none;">${clientEmail}</a></td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 5px 0; color: #64748b; vertical-align: top;"><strong>Category:</strong></td>
                  <td style="padding: 5px 0; color: #0f172a;">
                    <span style="background-color: #e0e7ff; color: #4338ca; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                      ${category}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #64748b; vertical-align: top;"><strong>Subject:</strong></td>
                  <td style="padding: 5px 0; color: #0f172a; font-weight: 600;">${subject}</td>
                </tr>
              </table>

              <!-- Message Body Box -->
              <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
                <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Message Content:</div>
                <div style="font-size: 14px; color: #1e293b; line-height: 1.5; white-space: pre-wrap; background: #ffffff; padding: 12px 14px; border-radius: 6px; border: 1px solid #cbd5e1;">${message}</div>
              </div>
            </div>

            <!-- Action Button Table -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 20px auto 8px auto;">
              <tr>
                <td align="center" style="border-radius: 6px; background-color: #4f46e5;">
                  <a href="${appUrl}/dashboard" style="font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block;">
                    Open Adonix CRM
                  </a>
                </td>
              </tr>
            </table>

          </div>
        </body>
        </html>
      `,
    })
  } catch (error) {
    console.error('Failed to send client message notification email:', error)
  }
}
