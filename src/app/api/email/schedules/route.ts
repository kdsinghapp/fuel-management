// src/app/api/email/schedules/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ReportSchedule } from '@/types/schedule';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const SCHEDULES_FILE = path.join(DATA_DIR, 'schedules.json');

// Default initial schedule demo
const DEFAULT_SCHEDULES: ReportSchedule[] = [
  {
    id: 'sch-daily-recon-digicel',
    name: 'Daily Digicel Reconciliation Dispatch',
    enabled: true,
    clientName: 'Digicel POM',
    reportType: 'reconciliation',
    datePreset: 'yesterday',
    time: '08:00',
    frequency: 'daily',
    recipients: ['operations@fuelmaster.com'],
    formats: ['excel', 'pdf'],
    subjectTemplate: '⛽ [Automated Report] Digicel POM Daily Reconciliation',
    customNotes: 'Automated daily report generated every morning for Digicel POM.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sch-daily-trans-all',
    name: 'Daily Fleet Fuel Transactions',
    enabled: true,
    clientName: 'Digicel POM',
    reportType: 'fuel-issues',
    datePreset: 'yesterday',
    time: '09:00',
    frequency: 'daily',
    recipients: ['fleetmanager@fuelmaster.com'],
    formats: ['excel'],
    subjectTemplate: '⛽ [Daily Log] Fuel Transactions Summary',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function readSchedules(): ReportSchedule[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(SCHEDULES_FILE)) {
      fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(DEFAULT_SCHEDULES, null, 2), 'utf-8');
      return DEFAULT_SCHEDULES;
    }
    const content = fs.readFileSync(SCHEDULES_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading schedules:', err);
    return DEFAULT_SCHEDULES;
  }
}

function writeSchedules(schedules: ReportSchedule[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(schedules, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing schedules:', err);
  }
}

// GET: list all schedules
export async function GET() {
  const schedules = readSchedules();
  return NextResponse.json({ success: true, schedules });
}

// POST: create or update a schedule
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const schedules = readSchedules();

    if (!body.name || !body.clientName || !body.recipients || body.recipients.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Schedule Name, Target Client, and at least one Recipient email are required.' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    let updatedList: ReportSchedule[];

    if (body.id) {
      // Update existing
      const index = schedules.findIndex((s) => s.id === body.id);
      if (index !== -1) {
        schedules[index] = {
          ...schedules[index],
          ...body,
          updatedAt: now,
        };
        updatedList = schedules;
      } else {
        const newSched: ReportSchedule = {
          ...body,
          id: body.id,
          createdAt: now,
          updatedAt: now,
        };
        updatedList = [newSched, ...schedules];
      }
    } else {
      // Create new
      const newSched: ReportSchedule = {
        ...body,
        id: `sch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        createdAt: now,
        updatedAt: now,
      };
      updatedList = [newSched, ...schedules];
    }

    writeSchedules(updatedList);
    return NextResponse.json({ success: true, schedules: updatedList });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to save schedule' }, { status: 500 });
  }
}

// DELETE: remove schedule
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Schedule ID is required' }, { status: 400 });
    }

    let schedules = readSchedules();
    schedules = schedules.filter((s) => s.id !== id);
    writeSchedules(schedules);

    return NextResponse.json({ success: true, schedules });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to delete schedule' }, { status: 500 });
  }
}
