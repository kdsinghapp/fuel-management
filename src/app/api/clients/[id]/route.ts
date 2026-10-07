// src/app/api/clients/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getClientByIdFromDb, updateClientInDb, deleteClientFromDb } from '@/lib/clientSql';

// GET /api/clients/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await getClientByIdFromDb(id);

    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: client,
    });
  } catch (error: any) {
    console.error(`Error fetching client ${params}:`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch client', details: error.message },
      { status: 500 }
    );
  }
}

// PUT or PATCH /api/clients/[id] - Update tank capacity, min stock, lead time, etc.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await getClientByIdFromDb(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      );
    }

    const updated = await updateClientInDb(id, {
      name: body.name !== undefined ? String(body.name) : undefined,
      userid: body.userid !== undefined ? Number(body.userid) : undefined,
      divisionid: body.divisionid !== undefined ? Number(body.divisionid) : undefined,
      tank_capacity: body.tank_capacity !== undefined ? Number(body.tank_capacity) : undefined,
      min_stock: body.min_stock !== undefined ? Number(body.min_stock) : undefined,
      depot: body.depot !== undefined ? (body.depot ? String(body.depot) : null) : undefined,
      lead_time_days: body.lead_time_days !== undefined ? Number(body.lead_time_days) : undefined,
      is_active: body.is_active !== undefined ? Boolean(body.is_active) : undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Client settings updated successfully',
      data: updated,
    });
  } catch (error: any) {
    console.error(`Error updating client:`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to update client', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/clients/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await getClientByIdFromDb(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      );
    }

    const deleted = await deleteClientFromDb(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete client' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Client deleted successfully',
    });
  } catch (error: any) {
    console.error(`Error deleting client:`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete client', details: error.message },
      { status: 500 }
    );
  }
}
