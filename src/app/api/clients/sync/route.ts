// src/app/api/clients/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { syncAllDefaultClients, getAllClientsFromDb } from '@/lib/clientSql';

// POST /api/clients/sync - Synchronize all client definitions from code into Azure SQL dbo.Clients
export async function POST(request: NextRequest) {
  try {
    const result = await syncAllDefaultClients();
    const allClients = await getAllClientsFromDb();

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized client definitions (${result.inserted} newly added)`,
      data: allClients,
      stats: result,
    });
  } catch (error: any) {
    console.error('Error syncing clients to Azure SQL:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sync client definitions', details: error.message },
      { status: 500 }
    );
  }
}
