// src/app/api/email/user-account/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendUserAccountEmail, UserAccountEmailPayload, SYSTEM_SENDER_EMAIL } from '@/lib/userAccountEmail';

function getBaseUrl(req: NextRequest): string {
  const origin = req.headers.get('origin');
  if (origin) return origin;
  const forwardedHost = req.headers.get('x-forwarded-host');
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  const host = req.headers.get('host');
  if (host) {
    const protocol = host.includes('localhost') ? 'http' : 'https';
    return `${protocol}://${host}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'https://fuelleshh.vercel.app';
}

export async function POST(req: NextRequest) {
  try {
    const body: UserAccountEmailPayload = await req.json();
    const baseUrl = getBaseUrl(req);

    const result = await sendUserAccountEmail(body, baseUrl);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          sender: SYSTEM_SENDER_EMAIL,
          recipient: body.recipientEmail,
          type: body.type,
          resetLink: result.resetLink,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      sender: SYSTEM_SENDER_EMAIL,
      recipient: body.recipientEmail,
      type: body.type,
      resetLink: result.resetLink,
    });
  } catch (err: any) {
    console.error('API Error in user-account email route:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Internal server error while dispatching user account email.',
      },
      { status: 500 }
    );
  }
}
