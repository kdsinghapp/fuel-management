// src/app/api/clients/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAllClientsFromDb, createClientInDb, getClientByIdFromDb } from '@/lib/clientSql';

// GET /api/clients - List all configured clients with their tank capacity & critical levels
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const isActiveOnly = searchParams.get('activeOnly') === 'true';

    const clients = await getAllClientsFromDb({ search, isActiveOnly });
    return NextResponse.json({
      success: true,
      data: clients,
      total: clients.length,
    });
  } catch (error: any) {
    console.error('Error fetching clients from Azure SQL:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch client settings', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/clients - Create new client configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientid, name, userid, divisionid, tank_capacity, min_stock, depot, lead_time_days, is_active } = body;

    if (!clientid || !name || userid === undefined || divisionid === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: clientid, name, userid, divisionid' },
        { status: 400 }
      );
    }

    const existing = await getClientByIdFromDb(String(clientid));
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Client with ID '${clientid}' already exists` },
        { status: 409 }
      );
    }

    const created = await createClientInDb({
      clientid: String(clientid),
      name: String(name),
      userid: Number(userid),
      divisionid: Number(divisionid),
      tank_capacity: Number(tank_capacity) || 10000,
      min_stock: Number(min_stock) || 5000,
      depot: depot ? String(depot) : null,
      lead_time_days: Number(lead_time_days != null ? lead_time_days : 2),
      is_active: is_active !== undefined ? Boolean(is_active) : true,
    });

    return NextResponse.json({
      success: true,
      message: 'Client created successfully',
      data: created,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating client in Azure SQL:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create client', details: error.message },
      { status: 500 }
    );
  }
}
