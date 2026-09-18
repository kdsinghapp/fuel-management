// src/app/api/email/schedules/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAllSchedulesFromDb, upsertScheduleInDb, deleteScheduleFromDb } from '@/lib/userSql';

// GET: list all schedules from Azure SQL
export async function GET() {
  try {
    const schedules = await getAllSchedulesFromDb();
    return NextResponse.json({ success: true, schedules });
  } catch (err: any) {
    console.error('Error fetching schedules from Azure SQL:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch schedules' },
      { status: 500 }
    );
  }
}

// POST: create or update a schedule in Azure SQL
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.name || !body.clientName || !body.recipients || body.recipients.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Schedule Name, Target Client, and at least one Recipient email are required.' },
        { status: 400 }
      );
    }

    const scheduleId = body.id || `sch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const scheduleData = {
      ...body,
      id: scheduleId,
    };

    await upsertScheduleInDb(scheduleData);
    const updatedList = await getAllSchedulesFromDb();

    return NextResponse.json({ success: true, schedules: updatedList });
  } catch (err: any) {
    console.error('Error saving schedule to Azure SQL:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to save schedule' },
      { status: 500 }
    );
  }
}

// DELETE: remove schedule from Azure SQL
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Schedule ID is required' }, { status: 400 });
    }

    await deleteScheduleFromDb(id);
    const updatedList = await getAllSchedulesFromDb();

    return NextResponse.json({ success: true, schedules: updatedList });
  } catch (err: any) {
    console.error('Error deleting schedule from Azure SQL:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to delete schedule' },
      { status: 500 }
    );
  }
}
