// src/lib/microsoftGraph.ts

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let cachedGraphToken: TokenCache | null = null;

export interface GraphCredentials {
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  senderEmail?: string;
}

export function getGraphCredentials(override?: GraphCredentials): {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  senderEmail: string;
} {
  const tenantId = override?.tenantId || process.env.MICROSOFT_TENANT_ID || '';
  const clientId = override?.clientId || process.env.MICROSOFT_CLIENT_ID || '';
  const clientSecret = override?.clientSecret || process.env.MICROSOFT_CLIENT_SECRET || '';
  const senderEmail = override?.senderEmail || process.env.MICROSOFT_SENDER_EMAIL || '';

  return { tenantId, clientId, clientSecret, senderEmail };
}

export async function getMicrosoftGraphAccessToken(credentials?: GraphCredentials): Promise<string> {
  const { tenantId, clientId, clientSecret } = getGraphCredentials(credentials);

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      'Missing Microsoft Graph credentials. Please ensure MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, and MICROSOFT_CLIENT_SECRET are configured.'
    );
  }

  // Use cached token if still valid (with 5 min safety buffer)
  if (cachedGraphToken && Date.now() < cachedGraphToken.expiresAt - 5 * 60 * 1000) {
    return cachedGraphToken.accessToken;
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('scope', 'https://graph.microsoft.com/.default');
  params.append('grant_type', 'client_credentials');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Microsoft Azure OAuth error (${response.status}): ${errorData}`);
  }

  const data = await response.json();
  const accessToken = data.access_token;
  const expiresIn = data.expires_in || 3600; // seconds

  cachedGraphToken = {
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  return accessToken;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  contentBase64: string;
}

export interface SendMailOptions {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  htmlBody: string;
  attachments?: EmailAttachment[];
  credentials?: GraphCredentials;
}

export async function sendMicrosoftGraphMail(options: SendMailOptions): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    const { senderEmail } = getGraphCredentials(options.credentials);

    if (!senderEmail) {
      throw new Error('Sender email address (MICROSOFT_SENDER_EMAIL) is not configured.');
    }

    if (!options.to || options.to.length === 0) {
      throw new Error('At least one recipient email address is required.');
    }

    const token = await getMicrosoftGraphAccessToken(options.credentials);

    const messagePayload: any = {
      subject: options.subject,
      body: {
        contentType: 'HTML',
        content: options.htmlBody,
      },
      toRecipients: options.to.map((email) => ({
        emailAddress: {
          address: email.trim(),
        },
      })),
    };

    if (options.cc && options.cc.length > 0) {
      messagePayload.ccRecipients = options.cc.map((email) => ({
        emailAddress: {
          address: email.trim(),
        },
      }));
    }

    if (options.bcc && options.bcc.length > 0) {
      messagePayload.bccRecipients = options.bcc.map((email) => ({
        emailAddress: {
          address: email.trim(),
        },
      }));
    }

    if (options.attachments && options.attachments.length > 0) {
      messagePayload.attachments = options.attachments.map((att) => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: att.filename,
        contentType: att.contentType,
        contentBytes: att.contentBase64,
      }));
    }

    const sendMailUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderEmail)}/sendMail`;

    const response = await fetch(sendMailUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: messagePayload,
        saveToSentItems: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson: any = null;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        // ignore
      }
      const detailedMessage = errorJson?.error?.message || errorText || `HTTP ${response.status}`;
      throw new Error(`Microsoft Graph API sendMail error: ${detailedMessage}`);
    }

    return {
      success: true,
    };
  } catch (err: any) {
    console.error('Microsoft Graph sendMail failed:', err);
    return {
      success: false,
      error: err?.message || 'Failed to send email via Microsoft Graph API',
    };
  }
}

export async function testMicrosoftGraphConnection(credentials?: GraphCredentials): Promise<{
  connected: boolean;
  sender: string;
  tenantConfigured: boolean;
  clientConfigured: boolean;
  secretConfigured: boolean;
  error?: string;
}> {
  const { tenantId, clientId, clientSecret, senderEmail } = getGraphCredentials(credentials);

  const tenantConfigured = Boolean(tenantId && !tenantId.includes('xxxx'));
  const clientConfigured = Boolean(clientId && !clientId.includes('xxxx'));
  const secretConfigured = Boolean(clientSecret && !clientSecret.includes('xxxx'));

  if (!tenantConfigured || !clientConfigured || !secretConfigured) {
    return {
      connected: false,
      sender: senderEmail || 'Not set',
      tenantConfigured,
      clientConfigured,
      secretConfigured,
      error: 'Microsoft Graph credentials contain placeholder xxxxxxxx values or are not configured.',
    };
  }

  try {
    const token = await getMicrosoftGraphAccessToken(credentials);
    return {
      connected: !!token,
      sender: senderEmail,
      tenantConfigured: true,
      clientConfigured: true,
      secretConfigured: true,
    };
  } catch (err: any) {
    return {
      connected: false,
      sender: senderEmail,
      tenantConfigured: true,
      clientConfigured: true,
      secretConfigured: true,
      error: err?.message || 'Failed to connect to Microsoft Graph',
    };
  }
}
