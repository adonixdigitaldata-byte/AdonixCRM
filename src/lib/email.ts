import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key')

export async function sendAgentInviteEmail(email: string, name: string, inviteLink: string) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.includes('YOUR_')) {
    console.log(`[Email Mock] Invite link for ${email}: ${inviteLink}`)
    return
  }

  try {
    await resend.emails.send({
      from: 'Adonix CRM <onboarding@resend.dev>',
      to: email,
      subject: 'You have been invited to Adonix CRM',
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
