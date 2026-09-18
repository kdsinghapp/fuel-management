import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail, updateUserInDb } from '@/lib/userSql';

export async function POST(request: NextRequest) {
  try {
    const { email, token, newPassword } = await request.json();

    if (!email || !newPassword) {
      return NextResponse.json({ error: 'Email and new password are required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await findUserByEmail(normalizedEmail);

    if (!user) {
      return NextResponse.json({ error: 'No account found with this email' }, { status: 404 });
    }

    // Verify token if token was stored and provided
    if (user.resetToken && token && user.resetToken !== token) {
      return NextResponse.json({ error: 'Invalid or expired password reset link' }, { status: 400 });
    }

    // Update password
    await updateUserInDb(user.id, {
      password: newPassword,
      resetToken: '',
      resetTokenExpiry: '',
    });

    // Send confirmation email
    try {
      const origin = request.headers.get('origin');
      const forwardedHost = request.headers.get('x-forwarded-host');
      const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
      const host = request.headers.get('host');
      const baseUrl =
        origin ||
        (forwardedHost ? `${forwardedProto}://${forwardedHost}` : '') ||
        (host ? `${host.includes('localhost') ? 'http' : 'https'}://${host}` : '') ||
        process.env.NEXT_PUBLIC_APP_URL ||
        'https://fuelleshh.vercel.app';

      const { sendUserAccountEmail } = await import('@/lib/userAccountEmail');
      await sendUserAccountEmail(
        {
          type: 'password_changed_confirmation',
          recipientEmail: user.email,
          recipientName: user.name,
        },
        baseUrl
      );
    } catch (err: any) {
      console.warn('Could not dispatch password changed confirmation email:', err.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Password has been successfully updated',
    });
  } catch (error: any) {
    console.error('Error resetting password:', error);
    return NextResponse.json({ error: 'Failed to reset password', details: error.message }, { status: 500 });
  }
}
