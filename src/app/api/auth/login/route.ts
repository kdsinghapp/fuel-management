import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { UserModel } from '@/models/User';
import { AuthUser } from '@/types/auth';

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await UserModel.findOne({ email: normalizedEmail });

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (user.status !== 'Active') {
      return NextResponse.json({ error: 'Account is inactive. Please contact your administrator.' }, { status: 403 });
    }

    // Direct password match or fallback default check
    const isMatch = user.password === password || (user.password === undefined && password === 'Password123!');

    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Update lastLogin
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    user.lastLogin = now;
    await user.save();

    const authUser: AuthUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: (user.role as 'Administrator' | 'Manager' | 'Viewer') || 'Viewer',
      assignedClients: user.assignedClients || [],
    };

    return NextResponse.json({
      success: true,
      user: authUser,
    });
  } catch (error: any) {
    console.error('Error during login:', error);
    return NextResponse.json({ error: 'Login failed', details: error.message }, { status: 500 });
  }
}
