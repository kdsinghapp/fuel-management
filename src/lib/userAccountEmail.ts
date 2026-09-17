// src/lib/userAccountEmail.ts
import { sendMicrosoftGraphMail } from '@/lib/microsoftGraph';

export const SYSTEM_SENDER_EMAIL = 'noreply@mastersystems.com.pg';

export interface UserAccountEmailPayload {
  type: 'account_created' | 'password_reset' | 'password_changed_confirmation' | 'admin_reset_notice';
  recipientEmail: string;
  recipientName: string;
  role?: string;
  tempPassword?: string;
  resetLink?: string;
  resetUrl?: string;
  loginUrl?: string;
  assignedClients?: string[];
}

export function generateAccountCreatedHtml(params: {
  name: string;
  email: string;
  role: string;
  tempPassword?: string;
  loginUrl: string;
  assignedClients?: string[];
}): { subject: string; html: string } {
  const subject = `Welcome to FuelMaster - Your Account Has Been Created`;
  const clientsListText =
    params.assignedClients && params.assignedClients.length > 0
      ? params.assignedClients.join(', ')
      : 'All Fleet Clients';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f6f8; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #f26522 0%, #d45316 100%); padding: 32px 30px; text-align: center;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="font-size: 28px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; text-transform: uppercase;">
                      ⛽ FuelMaster
                    </div>
                    <div style="font-size: 12px; font-weight: 600; color: rgba(255, 255, 255, 0.9); margin-top: 4px; letter-spacing: 1.5px; text-transform: uppercase;">
                      Master Systems Fuel Management Platform
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding: 36px 32px 24px 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.3;">
                Welcome aboard, ${params.name}! 👋
              </h1>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Your user account for the <strong>FuelMaster Fleet Intelligence & Fuel Management Platform</strong> has been successfully created. You can now access your dashboard to monitor fuel levels, deliveries, transactions, and analytics.
              </p>

              <!-- Account Details Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <div style="font-size: 12px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                      Your Account Credentials & Access
                    </div>
                    
                    <table width="100%" border="0" cellspacing="0" cellpadding="4" style="font-size: 14px;">
                      <tr>
                        <td width="38%" style="color: #64748b; font-weight: 600; padding: 6px 0;">Account Name:</td>
                        <td style="color: #0f172a; font-weight: 700; padding: 6px 0;">${params.name}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; font-weight: 600; padding: 6px 0;">Login Email:</td>
                        <td style="color: #0f172a; font-weight: 700; padding: 6px 0;">${params.email}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; font-weight: 600; padding: 6px 0;">Assigned Role:</td>
                        <td style="padding: 6px 0;">
                          <span style="display: inline-block; background-color: #e0f0ff; color: #0066cc; font-size: 12px; font-weight: 700; padding: 2px 10px; border-radius: 9999px;">
                            ${params.role}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; font-weight: 600; padding: 6px 0;">Client Access:</td>
                        <td style="color: #0f172a; font-weight: 700; padding: 6px 0;">
                          <span style="display: inline-block; background-color: #f1f5f9; color: #334155; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 6px; border: 1px solid #cbd5e1;">
                            ${clientsListText}
                          </span>
                        </td>
                      </tr>
                      ${
                        params.tempPassword
                          ? `
                      <tr>
                        <td style="color: #64748b; font-weight: 600; padding: 6px 0;">Temporary Password:</td>
                        <td style="color: #f26522; font-family: monospace; font-weight: 800; font-size: 15px; padding: 6px 0;">
                          ${params.tempPassword}
                        </td>
                      </tr>
                      `
                          : ''
                      }
                      <tr>
                        <td style="color: #64748b; font-weight: 600; padding: 6px 0;">Status:</td>
                        <td style="color: #16a34a; font-weight: 700; padding: 6px 0;">● Active</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Action Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${params.loginUrl}" target="_blank" style="display: inline-block; background: #f26522; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 8px; box-shadow: 0 3px 8px rgba(242, 101, 34, 0.35); text-align: center;">
                      Sign In to FuelMaster Portal →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                Or paste this link into your browser: <br>
                <a href="${params.loginUrl}" style="color: #f26522; word-break: break-all;">${params.loginUrl}</a>
              </p>

              <!-- Security Notice -->
              <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin-top: 24px; font-size: 12px; color: #92400e; line-height: 1.5;">
                <strong>Security Tip:</strong> For your protection, please change your password after your first login. Do not share your login credentials with anyone.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #64748b;">
                Master Systems Fuel Management
              </p>
              <p style="margin: 0 0 4px 0; font-size: 11px; color: #94a3b8;">
                This automated email was sent by <strong>noreply@mastersystems.com.pg</strong>. Please do not reply directly to this email.
              </p>
              <p style="margin: 0; font-size: 11px; color: #cbd5e1;">
                &copy; ${new Date().getFullYear()} Master Systems Ltd. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
  return { subject, html };
}

export function generatePasswordResetHtml(params: {
  name: string;
  email: string;
  resetLink: string;
}): { subject: string; html: string } {
  const subject = `Reset Your FuelMaster Account Password`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f6f8; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #f26522 0%, #d45316 100%); padding: 32px 30px; text-align: center;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="font-size: 28px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; text-transform: uppercase;">
                      🔒 FuelMaster
                    </div>
                    <div style="font-size: 12px; font-weight: 600; color: rgba(255, 255, 255, 0.9); margin-top: 4px; letter-spacing: 1.5px; text-transform: uppercase;">
                      Password Reset Request
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding: 36px 32px 24px 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.3;">
                Hello ${params.name || 'there'},
              </h1>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                We received a request to reset the password for your FuelMaster account associated with <strong>${params.email}</strong>.
              </p>
              <p style="margin: 0 0 28px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Click the button below to choose a new password. For security purposes, this password reset link is valid for <strong>1 hour</strong>.
              </p>

              <!-- Action Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${params.resetLink}" target="_blank" style="display: inline-block; background: #f26522; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 8px; box-shadow: 0 3px 8px rgba(242, 101, 34, 0.35); text-align: center;">
                      Reset Password →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                Or copy and paste this link into your browser: <br>
                <a href="${params.resetLink}" style="color: #f26522; word-break: break-all;">${params.resetLink}</a>
              </p>

              <!-- Warning Box -->
              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 4px; margin-top: 24px; font-size: 12px; color: #991b1b; line-height: 1.5;">
                <strong>Didn't request this?</strong> If you did not make this request, you can safely ignore this email. Your password will remain unchanged.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #64748b;">
                Master Systems Fuel Management
              </p>
              <p style="margin: 0 0 4px 0; font-size: 11px; color: #94a3b8;">
                This automated email was sent by <strong>noreply@mastersystems.com.pg</strong>. Please do not reply directly to this email.
              </p>
              <p style="margin: 0; font-size: 11px; color: #cbd5e1;">
                &copy; ${new Date().getFullYear()} Master Systems Ltd. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
  return { subject, html };
}

export function generatePasswordChangedHtml(params: {
  name: string;
  email: string;
  loginUrl: string;
}): { subject: string; html: string } {
  const subject = `Password Changed Successfully - FuelMaster`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f6f8; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 32px 30px; text-align: center;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="font-size: 28px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; text-transform: uppercase;">
                      ✓ FuelMaster
                    </div>
                    <div style="font-size: 12px; font-weight: 600; color: rgba(255, 255, 255, 0.9); margin-top: 4px; letter-spacing: 1.5px; text-transform: uppercase;">
                      Security Notification
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding: 36px 32px 24px 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.3;">
                Password Successfully Updated
              </h1>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Hello <strong>${params.name}</strong>, this is confirmation that the password for your FuelMaster account (<strong>${params.email}</strong>) has been changed successfully.
              </p>

              <!-- Action Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${params.loginUrl}" target="_blank" style="display: inline-block; background: #16a34a; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 8px; box-shadow: 0 3px 8px rgba(22, 163, 74, 0.35); text-align: center;">
                      Sign In with New Password →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Alert Box -->
              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 4px; margin-top: 24px; font-size: 12px; color: #991b1b; line-height: 1.5;">
                <strong>Did not make this change?</strong> If you did not change your password, please contact your FuelMaster administrator immediately to secure your account.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #64748b;">
                Master Systems Fuel Management
              </p>
              <p style="margin: 0 0 4px 0; font-size: 11px; color: #94a3b8;">
                This automated email was sent by <strong>noreply@mastersystems.com.pg</strong>. Please do not reply directly to this email.
              </p>
              <p style="margin: 0; font-size: 11px; color: #cbd5e1;">
                &copy; ${new Date().getFullYear()} Master Systems Ltd. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
  return { subject, html };
}

export async function sendUserAccountEmail(
  payload: UserAccountEmailPayload,
  baseUrl: string
): Promise<{ success: boolean; message?: string; error?: string; resetLink?: string }> {
  const {
    type,
    recipientEmail,
    recipientName,
    role = 'Viewer',
    tempPassword,
    resetLink,
    resetUrl,
    assignedClients,
  } = payload;

  if (!recipientEmail) {
    return { success: false, error: 'Recipient email address is required.' };
  }

  const loginUrl = `${baseUrl}/login`;
  const effectiveResetLink =
    resetLink ||
    resetUrl ||
    `${baseUrl}/reset-password?email=${encodeURIComponent(recipientEmail)}&token=${encodeURIComponent('reset_' + Math.random().toString(36).substring(2, 10))}`;

  let emailDetails: { subject: string; html: string };

  switch (type) {
    case 'account_created':
      emailDetails = generateAccountCreatedHtml({
        name: recipientName || recipientEmail.split('@')[0],
        email: recipientEmail,
        role,
        tempPassword,
        loginUrl,
        assignedClients,
      });
      break;

    case 'password_reset':
    case 'admin_reset_notice':
      emailDetails = generatePasswordResetHtml({
        name: recipientName || recipientEmail.split('@')[0],
        email: recipientEmail,
        resetLink: effectiveResetLink,
      });
      break;

    case 'password_changed_confirmation':
      emailDetails = generatePasswordChangedHtml({
        name: recipientName || recipientEmail.split('@')[0],
        email: recipientEmail,
        loginUrl,
      });
      break;

    default:
      return { success: false, error: `Unsupported email notification type: ${type}` };
  }

  try {
    const sendResult = await sendMicrosoftGraphMail({
      to: [recipientEmail],
      subject: emailDetails.subject,
      htmlBody: emailDetails.html,
      credentials: {
        senderEmail: SYSTEM_SENDER_EMAIL,
      },
    });

    if (!sendResult.success) {
      console.warn(`Microsoft Graph send error: ${sendResult.error}`);
      return {
        success: false,
        error: sendResult.error,
        resetLink: effectiveResetLink,
      };
    }

    return {
      success: true,
      message: `Email notification (${type}) successfully dispatched from ${SYSTEM_SENDER_EMAIL} to ${recipientEmail}`,
      resetLink: effectiveResetLink,
    };
  } catch (err: any) {
    console.error('Error in sendUserAccountEmail:', err);
    return {
      success: false,
      error: err?.message || 'Failed to dispatch email via Microsoft Graph',
      resetLink: effectiveResetLink,
    };
  }
}
