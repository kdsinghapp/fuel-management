import sql from 'mssql';
import { User } from '@/types/common';
import { ReportSchedule, ScheduleExecutionLog } from '@/types/schedule';
import { generateId } from '@/lib/utils';

let pool: sql.ConnectionPool | null = null;
let initializedTables = false;

function getSqlConfig(): sql.config {
  const user = process.env.USER_MGMT_SQL_USER as string;
  const password = process.env.USER_MGMT_SQL_PASSWORD as string;
  const server = process.env.USER_MGMT_SQL_SERVER as string;
  const database = process.env.USER_MGMT_SQL_DATABASE as string;
  const port = parseInt(process.env.USER_MGMT_SQL_PORT || '1433', 10);

  if (!user || !password || !server || !database) {
    throw new Error(
      'Missing required Azure SQL User Management environment variables. Please check USER_MGMT_SQL_SERVER, USER_MGMT_SQL_DATABASE, USER_MGMT_SQL_USER, and USER_MGMT_SQL_PASSWORD.'
    );
  }

  return {
    user,
    password,
    server,
    database,
    port,
    options: {
      encrypt: true, // required for Azure SQL
      trustServerCertificate: false,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

export async function getUserSqlPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }
  try {
    const config = getSqlConfig();
    pool = await new sql.ConnectionPool(config).connect();
    if (!initializedTables) {
      await initializeUserTables(pool);
      initializedTables = true;
    }
    return pool;
  } catch (error) {
    pool = null;
    console.error('Error connecting to Azure SQL User Management Database:', error);
    throw error;
  }
}

// Ensure default seeding if table is empty
async function initializeUserTables(p: sql.ConnectionPool) {
  try {
    const countRes = await p.request().query('SELECT COUNT(*) as cnt FROM users');
    const count = countRes.recordset[0]?.cnt || 0;
    if (count === 0) {
      console.log('🌱 Seeding initial users into Azure SQL users table...');
      const now = new Date().toISOString();
      const initialUsers = [
        { id: '1', name: 'Admin User', email: 'admin@example.com', role: 'Administrator', status: 'Active', password: 'admin123', last_login: '2026-08-12 08:30:00', assigned_clients: '[]' },
        { id: '2', name: 'Manager User', email: 'manager@example.com', role: 'Manager', status: 'Active', password: 'manager123', last_login: '2026-08-12 07:45:00', assigned_clients: '[]' },
        { id: '3', name: 'Viewer User', email: 'viewer@example.com', role: 'Viewer', status: 'Active', password: 'viewer123', assigned_clients: JSON.stringify(['St Johns Pom', 'Digicel POM']), last_login: '2026-08-11 16:20:00' },
        { id: '4', name: 'John Smith', email: 'john.smith@example.com', role: 'Manager', status: 'Active', password: 'Password123!', last_login: '2026-08-12 09:15:00', assigned_clients: '[]' },
        { id: '5', name: 'Sarah Johnson', email: 'sarah.johnson@example.com', role: 'Viewer', status: 'Active', password: 'Password123!', assigned_clients: JSON.stringify(['Paradise Foods HQ', 'Paradise Foods Hanta']), last_login: '2026-08-11 14:30:00' },
        { id: '6', name: 'Mike Wilson', email: 'mike.wilson@example.com', role: 'Manager', status: 'Inactive', password: 'Password123!', last_login: '2026-07-20 10:00:00', assigned_clients: '[]' },
        { id: '7', name: 'Emily Brown', email: 'emily.brown@example.com', role: 'Viewer', status: 'Active', password: 'Password123!', assigned_clients: JSON.stringify(['Laga Industries Taraka', 'Laga Industries Gabaka']), last_login: '2026-08-10 11:45:00' },
        { id: '8', name: 'David Lee', email: 'david.lee@example.com', role: 'Administrator', status: 'Active', password: 'Password123!', last_login: '2026-08-12 06:30:00', assigned_clients: '[]' },
        { id: '9', name: 'Lisa Chen', email: 'lisa.chen@example.com', role: 'Manager', status: 'Active', password: 'Password123!', last_login: '2026-08-11 13:15:00', assigned_clients: '[]' },
        { id: '10', name: 'Robert Taylor', email: 'robert.taylor@example.com', role: 'Viewer', status: 'Active', password: 'Password123!', assigned_clients: JSON.stringify(['TWL Lae', 'TWL Hagen']), last_login: '2026-08-10 15:30:00' },
      ];

      for (const u of initialUsers) {
        await p.request()
          .input('id', sql.VarChar(100), u.id)
          .input('name', sql.VarChar(255), u.name)
          .input('email', sql.VarChar(255), u.email)
          .input('role', sql.VarChar(50), u.role)
          .input('status', sql.VarChar(20), u.status)
          .input('password', sql.VarChar(255), u.password)
          .input('assigned_clients', sql.NVarChar(sql.MAX), u.assigned_clients)
          .input('last_login', sql.VarChar(50), u.last_login)
          .input('created_at', sql.VarChar(50), now)
          .input('updated_at', sql.VarChar(50), now)
          .query(`
            INSERT INTO users (id, name, email, role, status, password, assigned_clients, last_login, created_at, updated_at)
            VALUES (@id, @name, @email, @role, @status, @password, @assigned_clients, @last_login, @created_at, @updated_at)
          `);
      }
    }
  } catch (err: any) {
    console.warn('Notice during user tables initialization/seeding:', err?.message || err);
  }
}

// Safe parse for JSON arrays
function parseJsonArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [String(val)];
  } catch {
    return String(val).split(',').map((s) => s.trim()).filter(Boolean);
  }
}

// ----------------------------------------------------------------------
// USERS REPOSITORY
// ----------------------------------------------------------------------

export interface DbUserRecord {
  id: string;
  name: string;
  email: string;
  role: 'Administrator' | 'Manager' | 'Viewer';
  status: 'Active' | 'Inactive';
  password?: string;
  assignedClients?: string[];
  lastLogin?: string;
  resetToken?: string;
  resetTokenExpiry?: string;
  createdAt: string;
  updatedAt: string;
}

function mapRowToUser(row: any): DbUserRecord {
  return {
    id: String(row.id || ''),
    name: row.name || '',
    email: (row.email || '').toLowerCase().trim(),
    role: (row.role || 'Viewer') as any,
    status: (row.status || 'Active') as any,
    password: row.password || undefined,
    assignedClients: parseJsonArray(row.assigned_clients || row.assignedClients),
    lastLogin: row.last_login || row.lastLogin || '',
    resetToken: row.reset_token || row.resetToken || undefined,
    resetTokenExpiry: row.reset_token_expiry || row.resetTokenExpiry || undefined,
    createdAt: String(row.created_at || row.createdAt || new Date().toISOString()),
    updatedAt: String(row.updated_at || row.updatedAt || new Date().toISOString()),
  };
}

export async function findUserByEmail(email: string): Promise<DbUserRecord | null> {
  const p = await getUserSqlPool();
  const res = await p.request()
    .input('email', sql.VarChar(255), email.toLowerCase().trim())
    .query('SELECT TOP 1 * FROM users WHERE LOWER(email) = LOWER(@email)');

  if (!res.recordset || res.recordset.length === 0) return null;
  return mapRowToUser(res.recordset[0]);
}

export async function findUserById(id: string): Promise<DbUserRecord | null> {
  const p = await getUserSqlPool();
  const res = await p.request()
    .input('id', sql.VarChar(100), id)
    .query('SELECT TOP 1 * FROM users WHERE id = @id');

  if (!res.recordset || res.recordset.length === 0) return null;
  return mapRowToUser(res.recordset[0]);
}

export async function getUsersList(options: {
  search?: string;
  status?: string;
  role?: string;
  page?: number;
  pageSize?: number;
}) {
  const p = await getUserSqlPool();
  const page = options.page || 1;
  const pageSize = options.pageSize || 10;
  const offset = (page - 1) * pageSize;

  let whereClauses: string[] = [];
  const req = p.request();

  if (options.search) {
    whereClauses.push('(LOWER(name) LIKE @search OR LOWER(email) LIKE @search)');
    req.input('search', sql.VarChar(255), `%${options.search.toLowerCase()}%`);
  }
  if (options.status) {
    whereClauses.push('status = @status');
    req.input('status', sql.VarChar(20), options.status);
  }
  if (options.role) {
    whereClauses.push('role = @role');
    req.input('role', sql.VarChar(50), options.role);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countQuery = `SELECT COUNT(*) as total FROM users ${whereSql}`;
  const countRes = await req.query(countQuery);
  const total = countRes.recordset[0]?.total || 0;

  const dataQuery = `
    SELECT * FROM users
    ${whereSql}
    ORDER BY created_at DESC
    OFFSET ${offset} ROWS
    FETCH NEXT ${pageSize} ROWS ONLY
  `;
  const dataRes = await req.query(dataQuery);

  const users: User[] = (dataRes.recordset || []).map((row: any) => {
    const u = mapRowToUser(row);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      assignedClients: u.assignedClients || [],
      lastLogin: u.lastLogin || '',
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  });

  return {
    data: users,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function createUserInDb(data: {
  name: string;
  email: string;
  role: string;
  status?: string;
  password?: string;
  assignedClients?: string[];
}): Promise<DbUserRecord> {
  const p = await getUserSqlPool();
  const now = new Date().toISOString();
  const id = generateId();
  const normalizedEmail = data.email.toLowerCase().trim();

  await p.request()
    .input('id', sql.VarChar(100), id)
    .input('name', sql.VarChar(255), data.name.trim())
    .input('email', sql.VarChar(255), normalizedEmail)
    .input('role', sql.VarChar(50), data.role || 'Viewer')
    .input('status', sql.VarChar(20), data.status || 'Active')
    .input('password', sql.VarChar(255), data.password || 'Password123!')
    .input('assigned_clients', sql.NVarChar(sql.MAX), JSON.stringify(data.assignedClients || []))
    .input('last_login', sql.VarChar(50), '')
    .input('created_at', sql.VarChar(50), now)
    .input('updated_at', sql.VarChar(50), now)
    .query(`
      INSERT INTO users (id, name, email, role, status, password, assigned_clients, last_login, created_at, updated_at)
      VALUES (@id, @name, @email, @role, @status, @password, @assigned_clients, @last_login, @created_at, @updated_at)
    `);

  return {
    id,
    name: data.name.trim(),
    email: normalizedEmail,
    role: (data.role || 'Viewer') as any,
    status: (data.status || 'Active') as any,
    assignedClients: data.assignedClients || [],
    lastLogin: '',
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateUserInDb(id: string, updates: Partial<DbUserRecord>): Promise<DbUserRecord | null> {
  const existing = await findUserById(id);
  if (!existing) return null;

  const p = await getUserSqlPool();
  const now = new Date().toISOString();
  const req = p.request().input('id', sql.VarChar(100), id);

  const setClauses: string[] = ['updated_at = @updated_at'];
  req.input('updated_at', sql.VarChar(50), now);

  if (updates.name !== undefined) {
    setClauses.push('name = @name');
    req.input('name', sql.VarChar(255), updates.name.trim());
  }
  if (updates.email !== undefined) {
    setClauses.push('email = @email');
    req.input('email', sql.VarChar(255), updates.email.toLowerCase().trim());
  }
  if (updates.role !== undefined) {
    setClauses.push('role = @role');
    req.input('role', sql.VarChar(50), updates.role);
  }
  if (updates.status !== undefined) {
    setClauses.push('status = @status');
    req.input('status', sql.VarChar(20), updates.status);
  }
  if (updates.password !== undefined && updates.password.length > 0) {
    setClauses.push('password = @password');
    req.input('password', sql.VarChar(255), updates.password);
  }
  if (updates.assignedClients !== undefined) {
    setClauses.push('assigned_clients = @assigned_clients');
    req.input('assigned_clients', sql.NVarChar(sql.MAX), JSON.stringify(updates.assignedClients));
  }
  if (updates.lastLogin !== undefined) {
    setClauses.push('last_login = @last_login');
    req.input('last_login', sql.VarChar(50), updates.lastLogin);
  }
  if (updates.resetToken !== undefined) {
    setClauses.push('reset_token = @reset_token');
    req.input('reset_token', sql.VarChar(255), updates.resetToken);
  }
  if (updates.resetTokenExpiry !== undefined) {
    setClauses.push('reset_token_expiry = @reset_token_expiry');
    req.input('reset_token_expiry', sql.VarChar(50), updates.resetTokenExpiry);
  }

  await req.query(`UPDATE users SET ${setClauses.join(', ')} WHERE id = @id`);
  return findUserById(id);
}

export async function deleteUserFromDb(id: string): Promise<boolean> {
  const p = await getUserSqlPool();
  const res = await p.request()
    .input('id', sql.VarChar(100), id)
    .query('DELETE FROM users WHERE id = @id');
  return (res.rowsAffected[0] || 0) > 0;
}

// ----------------------------------------------------------------------
// SCHEDULES REPOSITORY
// ----------------------------------------------------------------------

function mapRowToSchedule(row: any): ReportSchedule {
  return {
    id: String(row.id || ''),
    name: row.name || '',
    enabled: Boolean(row.enabled !== false && row.enabled !== 0),
    clientName: row.client_name || row.clientName || '',
    clientId: row.client_id || row.clientId || undefined,
    reportType: (row.report_type || row.reportType || 'delivery_efficiency') as any,
    datePreset: (row.date_preset || row.datePreset || 'yesterday') as any,
    customStartDate: row.custom_start_date || row.customStartDate || undefined,
    customEndDate: row.custom_end_date || row.customEndDate || undefined,
    time: row.time || '07:00',
    frequency: (row.frequency || 'daily') as any,
    weeklyDay: row.weekly_day !== undefined && row.weekly_day !== null ? Number(row.weekly_day) : undefined,
    monthlyDay: row.monthly_day !== undefined && row.monthly_day !== null ? Number(row.monthly_day) : undefined,
    recipients: parseJsonArray(row.recipients),
    ccRecipients: parseJsonArray(row.cc_recipients || row.ccRecipients),
    formats: parseJsonArray(row.formats) as any,
    subjectTemplate: row.subject_template || row.subjectTemplate || undefined,
    customNotes: row.custom_notes || row.customNotes || undefined,
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || '',
    lastRunAt: row.last_run_at || row.lastRunAt || undefined,
    lastRunStatus: row.last_run_status || row.lastRunStatus || undefined,
    lastRunMessage: row.last_run_message || row.lastRunMessage || undefined,
    lastScheduledSlot: row.last_scheduled_slot || row.lastScheduledSlot || undefined,
  };
}

export async function getAllSchedulesFromDb(): Promise<ReportSchedule[]> {
  const p = await getUserSqlPool();
  const res = await p.request().query('SELECT * FROM schedules ORDER BY created_at DESC');
  return (res.recordset || []).map(mapRowToSchedule);
}

export async function upsertScheduleInDb(scheduleData: Partial<ReportSchedule> & { id: string }): Promise<void> {
  const p = await getUserSqlPool();
  const now = new Date().toISOString();

  const req = p.request()
    .input('id', sql.VarChar(100), scheduleData.id)
    .input('name', sql.VarChar(255), scheduleData.name || '')
    .input('enabled', sql.Bit, scheduleData.enabled !== false ? 1 : 0)
    .input('client_name', sql.VarChar(255), scheduleData.clientName || '')
    .input('client_id', sql.VarChar(100), scheduleData.clientId || null)
    .input('report_type', sql.VarChar(100), scheduleData.reportType || 'delivery_efficiency')
    .input('date_preset', sql.VarChar(100), scheduleData.datePreset || 'yesterday')
    .input('custom_start_date', sql.VarChar(50), scheduleData.customStartDate || null)
    .input('custom_end_date', sql.VarChar(50), scheduleData.customEndDate || null)
    .input('time', sql.VarChar(20), scheduleData.time || '07:00')
    .input('frequency', sql.VarChar(50), scheduleData.frequency || 'daily')
    .input('weekly_day', sql.Int, scheduleData.weeklyDay !== undefined ? scheduleData.weeklyDay : null)
    .input('monthly_day', sql.Int, scheduleData.monthlyDay !== undefined ? scheduleData.monthlyDay : null)
    .input('recipients', sql.NVarChar(sql.MAX), JSON.stringify(scheduleData.recipients || []))
    .input('cc_recipients', sql.NVarChar(sql.MAX), JSON.stringify(scheduleData.ccRecipients || []))
    .input('formats', sql.NVarChar(sql.MAX), JSON.stringify(scheduleData.formats || ['excel', 'pdf']))
    .input('subject_template', sql.NVarChar(sql.MAX), scheduleData.subjectTemplate || null)
    .input('custom_notes', sql.NVarChar(sql.MAX), scheduleData.customNotes || null)
    .input('created_at', sql.VarChar(50), scheduleData.createdAt || now)
    .input('updated_at', sql.VarChar(50), now)
    .input('last_run_at', sql.VarChar(50), scheduleData.lastRunAt || null)
    .input('last_run_status', sql.VarChar(20), scheduleData.lastRunStatus || null)
    .input('last_run_message', sql.NVarChar(sql.MAX), scheduleData.lastRunMessage || null)
    .input('last_scheduled_slot', sql.VarChar(50), scheduleData.lastScheduledSlot || null);

  await req.query(`
    MERGE schedules AS target
    USING (SELECT @id AS id) AS source
    ON (target.id = source.id)
    WHEN MATCHED THEN
      UPDATE SET 
        name = @name,
        enabled = @enabled,
        client_name = @client_name,
        client_id = @client_id,
        report_type = @report_type,
        date_preset = @date_preset,
        custom_start_date = @custom_start_date,
        custom_end_date = @custom_end_date,
        time = @time,
        frequency = @frequency,
        weekly_day = @weekly_day,
        monthly_day = @monthly_day,
        recipients = @recipients,
        cc_recipients = @cc_recipients,
        formats = @formats,
        subject_template = @subject_template,
        custom_notes = @custom_notes,
        updated_at = @updated_at,
        last_run_at = COALESCE(@last_run_at, target.last_run_at),
        last_run_status = COALESCE(@last_run_status, target.last_run_status),
        last_run_message = COALESCE(@last_run_message, target.last_run_message),
        last_scheduled_slot = COALESCE(@last_scheduled_slot, target.last_scheduled_slot)
    WHEN NOT MATCHED THEN
      INSERT (id, name, enabled, client_name, client_id, report_type, date_preset, custom_start_date, custom_end_date, time, frequency, weekly_day, monthly_day, recipients, cc_recipients, formats, subject_template, custom_notes, created_at, updated_at, last_run_at, last_run_status, last_run_message, last_scheduled_slot)
      VALUES (@id, @name, @enabled, @client_name, @client_id, @report_type, @date_preset, @custom_start_date, @custom_end_date, @time, @frequency, @weekly_day, @monthly_day, @recipients, @cc_recipients, @formats, @subject_template, @custom_notes, @created_at, @updated_at, @last_run_at, @last_run_status, @last_run_message, @last_scheduled_slot);
  `);
}

export async function updateScheduleRunStatusInDb(
  id: string,
  lastRunAt: string,
  status: 'success' | 'failed',
  message: string,
  lastScheduledSlot?: string
): Promise<void> {
  const p = await getUserSqlPool();
  const req = p.request()
    .input('id', sql.VarChar(100), id)
    .input('last_run_at', sql.VarChar(50), lastRunAt)
    .input('last_run_status', sql.VarChar(20), status)
    .input('last_run_message', sql.NVarChar(sql.MAX), message);

  let setSql = 'last_run_at = @last_run_at, last_run_status = @last_run_status, last_run_message = @last_run_message';
  if (lastScheduledSlot) {
    req.input('last_scheduled_slot', sql.VarChar(50), lastScheduledSlot);
    setSql += ', last_scheduled_slot = @last_scheduled_slot';
  }

  await req.query(`UPDATE schedules SET ${setSql} WHERE id = @id`);
}

export async function deleteScheduleFromDb(id: string): Promise<void> {
  const p = await getUserSqlPool();
  await p.request()
    .input('id', sql.VarChar(100), id)
    .query('DELETE FROM schedules WHERE id = @id');
}

// ----------------------------------------------------------------------
// SCHEDULE EXECUTION LOGS REPOSITORY
// ----------------------------------------------------------------------

export async function createScheduleLog(log: ScheduleExecutionLog): Promise<void> {
  try {
    const p = await getUserSqlPool();
    await p.request()
      .input('id', sql.VarChar(100), log.id)
      .input('schedule_id', sql.VarChar(100), log.scheduleId || null)
      .input('schedule_name', sql.VarChar(255), log.scheduleName || '')
      .input('client_name', sql.VarChar(255), log.clientName || '')
      .input('report_type', sql.VarChar(100), log.reportType || '')
      .input('date_range', sql.VarChar(255), log.dateRange || '')
      .input('recipients', sql.NVarChar(sql.MAX), JSON.stringify(log.recipients || []))
      .input('formats', sql.NVarChar(sql.MAX), JSON.stringify(log.formats || []))
      .input('status', sql.VarChar(20), log.status || 'failed')
      .input('message', sql.NVarChar(sql.MAX), log.message || '')
      .input('timestamp', sql.VarChar(50), log.timestamp || new Date().toISOString())
      .input('duration_ms', sql.BigInt, log.durationMs || 0)
      .query(`
        INSERT INTO schedule_execution_logs (
          id, schedule_id, schedule_name, client_name, report_type, date_range,
          recipients, formats, status, message, timestamp, duration_ms
        ) VALUES (
          @id, @schedule_id, @schedule_name, @client_name, @report_type, @date_range,
          @recipients, @formats, @status, @message, @timestamp, @duration_ms
        )
      `);
  } catch (err: any) {
    console.error('Error logging schedule execution to Azure SQL:', err?.message || err);
  }
}

export async function getScheduleLogsFromDb(limit: number = 50): Promise<ScheduleExecutionLog[]> {
  const p = await getUserSqlPool();
  const res = await p.request()
    .query(`SELECT TOP ${limit} * FROM schedule_execution_logs ORDER BY timestamp DESC`);

  return (res.recordset || []).map((row: any) => ({
    id: String(row.id || ''),
    scheduleId: row.schedule_id || row.scheduleId || '',
    scheduleName: row.schedule_name || row.scheduleName || '',
    clientName: row.client_name || row.clientName || '',
    reportType: row.report_type || row.reportType || '',
    dateRange: row.date_range || row.dateRange || '',
    recipients: parseJsonArray(row.recipients),
    formats: parseJsonArray(row.formats) as any,
    status: (row.status || 'success') as any,
    message: row.message || '',
    timestamp: row.timestamp || '',
    durationMs: Number(row.duration_ms || row.durationMs || 0),
  }));
}

export { sql };
