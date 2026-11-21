import { NextResponse } from 'next/server';
import fs from 'fs'; import path from 'path';
import { getSession, audit } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function POST() {
  const s = await getSession(); if (!s || !s.isSuper) return NextResponse.json({ ok: false, msg: 'Super Admin only' }, { status: 403 });
  const dir = path.join(process.cwd(), 'backups'); fs.mkdirSync(dir, { recursive: true });
  const name = `erp-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
  await getDb().backup(path.join(dir, name));
  const all = fs.readdirSync(dir).filter((f) => f.endsWith('.db')).sort(); // keep the last 30
  for (const old of all.slice(0, Math.max(0, all.length - 30))) fs.unlinkSync(path.join(dir, old));
  audit(s, 'backup', 'create', name); return NextResponse.json({ ok: true, msg: 'Backup created: ' + name });
}
export async function GET() {
  const s = await getSession(); if (!s || !s.isSuper) return NextResponse.json([], { status: 403 });
  const dir = path.join(process.cwd(), 'backups'); if (!fs.existsSync(dir)) return NextResponse.json([]);
  return NextResponse.json(fs.readdirSync(dir).filter((f) => f.endsWith('.db')).sort().reverse().map((f) => ({ name: f, kb: Math.round(fs.statSync(path.join(dir, f)).size / 1024) })));
}
