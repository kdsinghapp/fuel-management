import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail, updateUserInDb } from '@/lib/userSql';
import { generateId } from '@/lib/utils';
import { sendUserAccountEmail } from '@/lib/userAccountEmail';

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

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await findUserByEmail(normalizedEmail);

    if (!user) {
      return NextResponse.json({ error: 'No account found with this email address' }, { status: 404 });
    }

    // Generate token
    const token = `rst_${generateId()}_${Date.now()}`;
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await updateUserInDb(user.id, {
      resetToken: token,
      resetTokenExpiry: expiry,
    });

    const baseUrl = getBaseUrl(request);
    const resetUrl = `${baseUrl}/reset-password?email=${encodeURIComponent(user.email)}&token=${encodeURIComponent(token)}`;

    // Dispatch email directly
    const emailResult = await sendUserAccountEmail(
      {
        type: 'password_reset',
        recipientEmail: user.email,
        recipientName: user.name,
        resetLink: resetUrl,
      },
      baseUrl
    );

    return NextResponse.json({
      success: true,
      message: emailResult.success
        ? `Password reset link dispatched from noreply@mastersystems.com.pg to ${user.email}`
        : `Reset token created. Notice: ${emailResult.error || 'Email dispatch failed'}`,
      resetUrl,
      emailSent: emailResult.success,
      emailError: emailResult.error,
    });
  } catch (error: any) {
    console.error('Error handling forgot password:', error);
    return NextResponse.json(
      { error: 'Failed to process password reset request', details: error.message },
      { status: 500 }
    );
  }
}
