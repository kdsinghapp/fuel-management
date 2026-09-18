import { NextRequest, NextResponse } from 'next/server';
import { getUsersList, createUserInDb, findUserByEmail } from '@/lib/userSql';

// GET /api/users
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const role = searchParams.get('role') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);

    const result = await getUsersList({ search, status, role, page, pageSize });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching users from Azure SQL:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/users
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, role, status, assignedClients, tempPassword, sendNotificationEmail } = body;

    if (!name || !email || !role) {
      return NextResponse.json(
        { error: 'Missing required fields (name, email, role)' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existing = await findUserByEmail(normalizedEmail);
    if (existing) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    const newUser = await createUserInDb({
      name,
      email: normalizedEmail,
      role,
      status: status || 'Active',
      password: tempPassword || 'Password123!',
      assignedClients: assignedClients || [],
    });

    let emailSent = false;
    let emailError: string | undefined;

    // Send email notification if requested
    if (sendNotificationEmail) {
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
        const emailResult = await sendUserAccountEmail(
          {
            type: 'account_created',
            recipientEmail: newUser.email,
            recipientName: newUser.name,
            role: newUser.role,
            tempPassword: tempPassword || 'Password123!',
            assignedClients: newUser.assignedClients,
          },
          baseUrl
        );

        emailSent = emailResult.success;
        emailError = emailResult.error;
      } catch (err: any) {
        console.warn('Could not dispatch welcome email:', err.message);
        emailError = err.message;
      }
    }

    return NextResponse.json({
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        assignedClients: newUser.assignedClients,
        lastLogin: newUser.lastLogin,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
      },
      emailSent,
      emailError,
    });
  } catch (error: any) {
    console.error('Error creating user in Azure SQL:', error);
    return NextResponse.json(
      { error: 'Failed to create user', details: error.message },
      { status: 500 }
    );
  }
}
