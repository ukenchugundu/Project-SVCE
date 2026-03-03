import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const readDatabaseUrlFromEnvFile = (): string | undefined => {
  const envPath = path.resolve(__dirname, '../../.env');
  if (!fs.existsSync(envPath)) {
    return undefined;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key === 'DATABASE_URL') {
      return value.replace(/^['"]|['"]$/g, '');
    }
  }

  return undefined;
};

const defaultDatabaseUrl = 'postgresql://user:password@localhost:5432/eduhub';
const connectionString =
  process.env.DATABASE_URL || readDatabaseUrlFromEnvFile() || defaultDatabaseUrl;
const forceSsl = process.env.DB_SSL?.toLowerCase() === 'true';
const disableSsl = process.env.DB_SSL?.toLowerCase() === 'false';
const isSupabaseConnection = connectionString.includes('.supabase.co');
const sslConfig =
  disableSsl ? false : forceSsl || isSupabaseConnection ? { rejectUnauthorized: false } : false;

if (!process.env.DATABASE_URL) {
  console.warn(
    `[db] DATABASE_URL not found in process env. Using ${
      connectionString === defaultDatabaseUrl ? 'default local URL' : 'backend/.env'
    }.`
  );
}

const pool = new Pool({
  connectionString,
  ssl: sslConfig,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 10000,
});

export default pool;
