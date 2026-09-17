import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { UserModel } from '@/models/User';
import { generateId } from '@/lib/utils';
import { User } from '@/types/common';

const INITIAL_USERS = [
  { id: '1', name: 'Admin User', email: 'admin@example.com', role: 'Administrator', status: 'Active', password: 'admin123', lastLogin: '2026-08-12 08:30:00', assignedClients: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  { id: '2', name: 'Manager User', email: 'manager@example.com', role: 'Manager', status: 'Active', password: 'manager123', lastLogin: '2026-08-12 07:45:00', assignedClients: [], createdAt: '2026-01-15T00:00:00Z', updatedAt: '2026-01-15T00:00:00Z' },
  { id: '3', name: 'Viewer User', email: 'viewer@example.com', role: 'Viewer', status: 'Active', password: 'viewer123', assignedClients: ['St Johns Pom', 'Digicel POM'], lastLogin: '2026-08-11 16:20:00', createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z' },
  { id: '4', name: 'John Smith', email: 'john.smith@example.com', role: 'Manager', status: 'Active', password: 'Password123!', lastLogin: '2026-08-12 09:15:00', assignedClients: [], createdAt: '2026-03-10T00:00:00Z', updatedAt: '2026-03-10T00:00:00Z' },
  { id: '5', name: 'Sarah Johnson', email: 'sarah.johnson@example.com', role: 'Viewer', status: 'Active', password: 'Password123!', assignedClients: ['Paradise Foods HQ', 'Paradise Foods Hanta'], lastLogin: '2026-08-11 14:30:00', createdAt: '2026-04-05T00:00:00Z', updatedAt: '2026-04-05T00:00:00Z' },
  { id: '6', name: 'Mike Wilson', email: 'mike.wilson@example.com', role: 'Manager', status: 'Inactive', password: 'Password123!', lastLogin: '2026-07-20 10:00:00', assignedClients: [], createdAt: '2026-05-12T00:00:00Z', updatedAt: '2026-05-12T00:00:00Z' },
  { id: '7', name: 'Emily Brown', email: 'emily.brown@example.com', role: 'Viewer', status: 'Active', password: 'Password123!', assignedClients: ['Laga Industries Taraka', 'Laga Industries Gabaka'], lastLogin: '2026-08-10 11:45:00', createdAt: '2026-06-08T00:00:00Z', updatedAt: '2026-06-08T00:00:00Z' },
  { id: '8', name: 'David Lee', email: 'david.lee@example.com', role: 'Administrator', status: 'Active', password: 'Password123!', lastLogin: '2026-08-12 06:30:00', assignedClients: [], createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z' },
  { id: '9', name: 'Lisa Chen', email: 'lisa.chen@example.com', role: 'Manager', status: 'Active', password: 'Password123!', lastLogin: '2026-08-11 13:15:00', assignedClients: [], createdAt: '2026-07-15T00:00:00Z', updatedAt: '2026-07-15T00:00:00Z' },
  { id: '10', name: 'Robert Taylor', email: 'robert.taylor@example.com', role: 'Viewer', status: 'Active', password: 'Password123!', assignedClients: ['TWL Lae', 'TWL Hagen'], lastLogin: '2026-08-10 15:30:00', createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' },
];

async function ensureSeeded() {
  const count = await UserModel.countDocuments();
  if (count === 0) {
    console.log('🌱 Seeding default users to MongoDB...');
    await UserModel.insertMany(INITIAL_USERS);
  }
}

// GET /api/users
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    await ensureSeeded();

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const role = searchParams.get('role') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);

    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (status) {
      query.status = status;
    }
    if (role) {
      query.role = role;
    }

    const total = await UserModel.countDocuments(query);
    const users = await UserModel.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    const formattedUsers: User[] = users.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      assignedClients: u.assignedClients || [],
      lastLogin: u.lastLogin || '',
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));

    return NextResponse.json({
      data: formattedUsers,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error: any) {
    console.error('Error fetching users from MongoDB:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/users
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
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
    const existing = await UserModel.findOne({ email: normalizedEmail });
    if (existing) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const newUser = await UserModel.create({
      id: generateId(),
      name: name.trim(),
      email: normalizedEmail,
      role: role || 'Viewer',
      status: status || 'Active',
      password: tempPassword || 'Password123!',
      assignedClients: assignedClients || [],
      lastLogin: '',
      createdAt: now,
      updatedAt: now,
    });

    let emailSent = false;
    let emailError: string | undefined;

    // Send email notification if requested
    if (sendNotificationEmail) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fuel-management-kd.vercel.app';
        const loginUrl = `${appUrl}/login`;

        const response = await fetch(`${appUrl}/api/email/user-account`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'account_created',
            recipientEmail: newUser.email,
            recipientName: newUser.name,
            role: newUser.role,
            tempPassword: tempPassword || 'Password123!',
            assignedClients: newUser.assignedClients,
            loginUrl,
          }),
        });

        if (response.ok) {
          emailSent = true;
        } else {
          const errData = await response.json().catch(() => ({}));
          emailError = errData.error || 'Failed to dispatch email';
        }
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
    console.error('Error creating user in MongoDB:', error);
    return NextResponse.json(
      { error: 'Failed to create user', details: error.message },
      { status: 500 }
    );
  }
}
