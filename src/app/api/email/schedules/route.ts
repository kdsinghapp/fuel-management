// src/app/api/email/schedules/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ScheduleModel } from '@/models/Schedule';
import { ReportSchedule } from '@/types/schedule';

// GET: list all schedules from MongoDB
export async function GET() {
  try {
    await connectToDatabase();

    const schedules = await ScheduleModel.find({})
      .sort({ createdAt: -1 })
      .lean();

    // Map documents to clean ReportSchedule objects without mongo internal fields
    const sanitizedSchedules = schedules.map((item) => {
      const { _id, __v, ...rest } = item as any;
      return rest as ReportSchedule;
    });

    return NextResponse.json({ success: true, schedules: sanitizedSchedules });
  } catch (err: any) {
    console.error('Error fetching schedules from MongoDB:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch schedules' },
      { status: 500 }
    );
  }
}

// POST: create or update a schedule in MongoDB
export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    if (!body.name || !body.clientName || !body.recipients || body.recipients.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Schedule Name, Target Client, and at least one Recipient email are required.' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const scheduleId = body.id || `sch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const scheduleData = {
      ...body,
      id: scheduleId,
      updatedAt: now,
      ...(body.id ? {} : { createdAt: now }),
    };

    // Upsert into MongoDB
    await ScheduleModel.findOneAndUpdate(
      { id: scheduleId },
      { $set: scheduleData },
      { upsert: true, new: true, runValidators: true }
    );

    const updatedList = await ScheduleModel.find({})
      .sort({ createdAt: -1 })
      .lean();

    const sanitizedList = updatedList.map((item) => {
      const { _id, __v, ...rest } = item as any;
      return rest as ReportSchedule;
    });

    return NextResponse.json({ success: true, schedules: sanitizedList });
  } catch (err: any) {
    console.error('Error saving schedule to MongoDB:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to save schedule' },
      { status: 500 }
    );
  }
}

// DELETE: remove schedule from MongoDB
export async function DELETE(req: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Schedule ID is required' }, { status: 400 });
    }

    await ScheduleModel.deleteOne({ id });

    const updatedList = await ScheduleModel.find({})
      .sort({ createdAt: -1 })
      .lean();

    const sanitizedList = updatedList.map((item) => {
      const { _id, __v, ...rest } = item as any;
      return rest as ReportSchedule;
    });

    return NextResponse.json({ success: true, schedules: sanitizedList });
  } catch (err: any) {
    console.error('Error deleting schedule from MongoDB:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to delete schedule' },
      { status: 500 }
    );
  }
}
