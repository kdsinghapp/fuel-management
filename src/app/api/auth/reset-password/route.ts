import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { UserModel } from '@/models/User';

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const { email, token, newPassword } = await request.json();

    if (!email || !newPassword) {
      return NextResponse.json({ error: 'Email and new password are required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await UserModel.findOne({ email: normalizedEmail });

    if (!user) {
      return NextResponse.json({ error: 'No account found with this email' }, { status: 404 });
    }

    // Verify token if token was stored and provided
    if (user.resetToken && token && user.resetToken !== token) {
      return NextResponse.json({ error: 'Invalid or expired password reset link' }, { status: 400 });
    }

    // Update password
    user.password = newPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    user.updatedAt = new Date().toISOString();
    await user.save();

    // Send confirmation email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fuel-management-kd.vercel.app';
    const loginUrl = `${appUrl}/login`;

    try {
      await fetch(`${appUrl}/api/email/user-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'password_changed_confirmation',
          recipientEmail: user.email,
          recipientName: user.name,
          loginUrl,
        }),
      });
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
