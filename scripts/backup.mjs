import Database from 'better-sqlite3'; import fs from 'fs'; import path from 'path';
const db = new Database(process.env.ERP_DB || path.join(process.cwd(), 'data', 'erp.db'), { readonly: true });
const dir = path.join(process.cwd(), 'backups'); fs.mkdirSync(dir, { recursive: true });
const name = `erp-${new Date().toISOString().replace(/[:.]/g, '-')}.db`; await db.backup(path.join(dir, name)); console.log('Backup written:', name);
const all = fs.readdirSync(dir).filter((f) => f.endsWith('.db')).sort(); for (const old of all.slice(0, Math.max(0, all.length - 30))) fs.unlinkSync(path.join(dir, old));
