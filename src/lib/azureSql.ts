import sql from 'mssql';

const sqlConfig: sql.config = {
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  port: parseInt(process.env.AZURE_SQL_PORT || '1433', 10),
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

let pool: sql.ConnectionPool | null = null;

export async function getSqlPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }
  try {
    pool = await new sql.ConnectionPool(sqlConfig).connect();
    return pool;
  } catch (error) {
    console.error('Error connecting to Azure SQL Database:', error);
    throw error;
  }
}

export { sql };
