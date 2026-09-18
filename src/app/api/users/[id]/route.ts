import { NextRequest, NextResponse } from 'next/server';
import { findUserById, updateUserInDb, deleteUserFromDb } from '@/lib/userSql';
import { User } from '@/types/common';

// GET /api/users/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await findUserById(id);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const formattedUser: User = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      assignedClients: user.assignedClients || [],
      lastLogin: user.lastLogin || '',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return NextResponse.json(formattedUser);
  } catch (error: any) {
    console.error('Error fetching user from Azure SQL:', error);
    return NextResponse.json({ error: 'Failed to fetch user', details: error.message }, { status: 500 });
  }
}

// PUT /api/users/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await findUserById(id);
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updatedUser = await updateUserInDb(id, {
      name: body.name !== undefined ? body.name.trim() : undefined,
      email: body.email !== undefined ? body.email.toLowerCase().trim() : undefined,
      role: body.role !== undefined ? body.role : undefined,
      status: body.status !== undefined ? body.status : undefined,
      assignedClients: body.assignedClients !== undefined ? body.assignedClients : undefined,
      password: body.password !== undefined && body.password.length > 0 ? body.password : undefined,
      lastLogin: body.lastLogin !== undefined ? body.lastLogin : undefined,
    });

    if (!updatedUser) {
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    return NextResponse.json({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      status: updatedUser.status,
      assignedClients: updatedUser.assignedClients,
      lastLogin: updatedUser.lastLogin,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    });
  } catch (error: any) {
    console.error('Error updating user in Azure SQL:', error);
    return NextResponse.json({ error: 'Failed to update user', details: error.message }, { status: 500 });
  }
}

// DELETE /api/users/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await deleteUserFromDb(id);

    if (!success) {
      return NextResponse.json({ error: 'User not found or already deleted' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting user from Azure SQL:', error);
    return NextResponse.json({ error: 'Failed to delete user', details: error.message }, { status: 500 });
  }
}
