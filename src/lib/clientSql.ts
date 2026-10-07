// src/lib/clientSql.ts
import sql from 'mssql';

export interface ClientDbRecord {
  clientid: string;
  name: string;
  userid: number;
  divisionid: number;
  tank_capacity: number;
  min_stock: number;
  depot?: string | null;
  lead_time_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function getClientSqlConfig(): sql.config {
  const user = (process.env.USER_MGMT_SQL_USER || '').replace(/^"|"$/g, '');
  const password = (process.env.USER_MGMT_SQL_PASSWORD || '').replace(/^"|"$/g, '');
  const server = (process.env.USER_MGMT_SQL_SERVER || process.env.AZURE_SQL_SERVER || '').replace(/^"|"$/g, '');
  const database = (process.env.AZURE_SQL_DATABASE || 'FuelReconDash').replace(/^"|"$/g, '');
  const port = parseInt(process.env.USER_MGMT_SQL_PORT || process.env.AZURE_SQL_PORT || '1433', 10);

  if (!user || !password || !server || !database) {
    throw new Error(
      'Missing required Azure SQL environment variables for Clients database access. Please check USER_MGMT_SQL_USER, USER_MGMT_SQL_PASSWORD, and AZURE_SQL_DATABASE in .env.local.'
    );
  }

  return {
    user,
    password,
    server,
    database,
    port,
    options: {
      encrypt: true,
      trustServerCertificate: false,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

let clientPool: sql.ConnectionPool | null = null;

export async function getClientSqlPool(): Promise<sql.ConnectionPool> {
  if (clientPool && clientPool.connected) {
    return clientPool;
  }
  try {
    const config = getClientSqlConfig();
    clientPool = await new sql.ConnectionPool(config).connect();
    return clientPool;
  } catch (error) {
    clientPool = null;
    console.error('Error connecting to FuelReconDash as FuelReconUserAPI:', error);
    throw error;
  }
}

export async function ensureClientsTable(): Promise<void> {
  // Table is already created in database
}

function mapRowToClient(row: any): ClientDbRecord {
  return {
    clientid: String(row.clientid || ''),
    name: row.name || '',
    userid: Number(row.userid || 0),
    divisionid: Number(row.divisionid || 0),
    tank_capacity: Number(row.tank_capacity != null ? row.tank_capacity : 10000),
    min_stock: Number(row.min_stock != null ? row.min_stock : 5000),
    depot: row.depot || null,
    lead_time_days: Number(row.lead_time_days != null ? row.lead_time_days : 2),
    is_active: Boolean(row.is_active === 1 || row.is_active === true),
    created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

export async function getAllClientsFromDb(options?: {
  search?: string;
  isActiveOnly?: boolean;
}): Promise<ClientDbRecord[]> {
  const pool = await getClientSqlPool();
  const req = pool.request();
  const whereClauses: string[] = [];

  if (options?.search) {
    whereClauses.push('(LOWER(name) LIKE @search OR LOWER(clientid) LIKE @search OR LOWER(depot) LIKE @search)');
    req.input('search', sql.VarChar(255), `%${options.search.toLowerCase()}%`);
  }

  if (options?.isActiveOnly) {
    whereClauses.push('is_active = 1');
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const query = `SELECT * FROM dbo.Clients ${whereSql} ORDER BY is_active DESC, name ASC`;
  const result = await req.query(query);

  return (result.recordset || []).map(mapRowToClient);
}

export async function getClientByIdFromDb(clientid: string): Promise<ClientDbRecord | null> {
  const pool = await getClientSqlPool();
  const result = await pool.request()
    .input('clientid', sql.VarChar(50), clientid)
    .query('SELECT TOP 1 * FROM dbo.Clients WHERE clientid = @clientid');

  if (!result.recordset || result.recordset.length === 0) return null;
  return mapRowToClient(result.recordset[0]);
}

export async function createClientInDb(data: {
  clientid: string;
  name: string;
  userid: number;
  divisionid: number;
  tank_capacity: number;
  min_stock: number;
  depot?: string | null;
  lead_time_days?: number;
  is_active?: boolean;
}): Promise<ClientDbRecord> {
  const pool = await getClientSqlPool();
  const now = new Date();

  await pool.request()
    .input('clientid', sql.VarChar(50), String(data.clientid).trim())
    .input('name', sql.NVarChar(255), data.name.trim())
    .input('userid', sql.Int, Number(data.userid))
    .input('divisionid', sql.Int, Number(data.divisionid))
    .input('tank_capacity', sql.Int, Number(data.tank_capacity) || 10000)
    .input('min_stock', sql.Int, Number(data.min_stock) || 5000)
    .input('depot', sql.NVarChar(100), data.depot ? data.depot.trim() : null)
    .input('lead_time_days', sql.Int, Number(data.lead_time_days != null ? data.lead_time_days : 2))
    .input('is_active', sql.Bit, data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1)
    .input('created_at', sql.DateTime, now)
    .input('updated_at', sql.DateTime, now)
    .query(`
      INSERT INTO dbo.Clients (clientid, name, userid, divisionid, tank_capacity, min_stock, depot, lead_time_days, is_active, created_at, updated_at)
      VALUES (@clientid, @name, @userid, @divisionid, @tank_capacity, @min_stock, @depot, @lead_time_days, @is_active, @created_at, @updated_at)
    `);

  const created = await getClientByIdFromDb(data.clientid);
  if (!created) {
    throw new Error('Failed to retrieve newly created client');
  }
  return created;
}

export async function updateClientInDb(
  clientid: string,
  data: Partial<{
    name: string;
    userid: number;
    divisionid: number;
    tank_capacity: number;
    min_stock: number;
    depot: string | null;
    lead_time_days: number;
    is_active: boolean;
  }>
): Promise<ClientDbRecord | null> {
  const pool = await getClientSqlPool();
  const now = new Date();

  const updates: string[] = ['updated_at = @updated_at'];
  const req = pool.request()
    .input('clientid', sql.VarChar(50), clientid)
    .input('updated_at', sql.DateTime, now);

  if (data.name !== undefined) {
    updates.push('name = @name');
    req.input('name', sql.NVarChar(255), data.name.trim());
  }
  if (data.userid !== undefined) {
    updates.push('userid = @userid');
    req.input('userid', sql.Int, Number(data.userid));
  }
  if (data.divisionid !== undefined) {
    updates.push('divisionid = @divisionid');
    req.input('divisionid', sql.Int, Number(data.divisionid));
  }
  if (data.tank_capacity !== undefined) {
    updates.push('tank_capacity = @tank_capacity');
    req.input('tank_capacity', sql.Int, Number(data.tank_capacity));
  }
  if (data.min_stock !== undefined) {
    updates.push('min_stock = @min_stock');
    req.input('min_stock', sql.Int, Number(data.min_stock));
  }
  if (data.depot !== undefined) {
    updates.push('depot = @depot');
    req.input('depot', sql.NVarChar(100), data.depot ? data.depot.trim() : null);
  }
  if (data.lead_time_days !== undefined) {
    updates.push('lead_time_days = @lead_time_days');
    req.input('lead_time_days', sql.Int, Number(data.lead_time_days));
  }
  if (data.is_active !== undefined) {
    updates.push('is_active = @is_active');
    req.input('is_active', sql.Bit, data.is_active ? 1 : 0);
  }

  await req.query(`
    UPDATE dbo.Clients 
    SET ${updates.join(', ')}
    WHERE clientid = @clientid
  `);

  return getClientByIdFromDb(clientid);
}

export async function deleteClientFromDb(clientid: string): Promise<boolean> {
  const pool = await getClientSqlPool();
  const result = await pool.request()
    .input('clientid', sql.VarChar(50), clientid)
    .query('DELETE FROM dbo.Clients WHERE clientid = @clientid');

  return (result.rowsAffected[0] || 0) > 0;
}
