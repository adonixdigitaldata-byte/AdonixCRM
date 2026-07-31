import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key')

export async function sendAgentInviteEmail(email: string, name: string, inviteLink: string) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.includes('YOUR_')) {
    console.log(`[Email Mock] Invite link for ${email}: ${inviteLink}`)
    return
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Adonix <info@adonixdigital.com>'

  try {
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: 'You have been invited to Adonix',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
          <h2 style="color: #18181b; margin-bottom: 12px;">Welcome to Adonix CRM</h2>
          <p style="color: #71717a; font-size: 14px;">Hi ${name},</p>
          <p style="color: #71717a; font-size: 14px;">You have been invited to join Adonix CRM as an agent.</p>
          <div style="margin: 24px 0;">
            <a href="${inviteLink}" style="background-color: #4f46e5; color: white; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px; display: inline-block;">Set up your password</a>
          </div>
          <p style="color: #a1a1aa; font-size: 12px;">If you didn't expect this invitation, please ignore this email.</p>
        </div>
      `,
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
