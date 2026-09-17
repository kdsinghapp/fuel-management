import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { UserModel } from '@/models/User';
import { generateId } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await UserModel.findOne({ email: normalizedEmail });

    if (!user) {
      return NextResponse.json({ error: 'No account found with this email address' }, { status: 404 });
    }

    // Generate token
    const token = `rst_${generateId()}_${Date.now()}`;
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    user.resetToken = token;
    user.resetTokenExpiry = expiry;
    await user.save();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fuel-management-kd.vercel.app';
    const resetUrl = `${appUrl}/reset-password?email=${encodeURIComponent(user.email)}&token=${token}`;

    let emailSent = false;
    let emailError: string | undefined;

    try {
      const response = await fetch(`${appUrl}/api/email/user-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'password_reset',
          recipientEmail: user.email,
          recipientName: user.name,
          resetUrl,
        }),
      });

      if (response.ok) {
        emailSent = true;
      } else {
        const errData = await response.json().catch(() => ({}));
        emailError = errData.error || 'Failed to dispatch email';
      }
    } catch (err: any) {
      console.warn('Could not dispatch password reset email:', err.message);
      emailError = err.message;
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset link sent to your email',
      resetUrl,
      emailSent,
      emailError,
    });
  } catch (error: any) {
    console.error('Error handling forgot password:', error);
    return NextResponse.json({ error: 'Failed to process password reset request', details: error.message }, { status: 500 });
  }
}
