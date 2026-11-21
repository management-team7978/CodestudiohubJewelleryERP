import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs'; import path from 'path';
import { getSession, audit } from '@/lib/auth';
import { setSetting, setting } from '@/lib/db';

const FILE = path.join(process.cwd(), 'data', 'apk', 'app.apk');
// Download: Super Admin (logged in) OR anyone holding the share token (so business owners can install from a WhatsApp link).
export async function GET(req: NextRequest) {
  const s = await getSession(); const t = req.nextUrl.searchParams.get('t');
  const tokenOk = !!t && t === setting('apk_token');
  if (!(s?.isSuper) && !tokenOk) return new NextResponse('Not allowed', { status: 403 });
  if (!fs.existsSync(FILE)) return new NextResponse('No APK uploaded yet', { status: 404 });
  const buf = fs.readFileSync(FILE);
  return new NextResponse(buf, { headers: { 'Content-Type': 'application/vnd.android.package-archive', 'Content-Disposition': `attachment; filename="${setting('apk_name', 'shakti-gold.apk')}"`, 'Content-Length': String(buf.length) } });
}
export async function POST(req: NextRequest) {
  const s = await getSession(); if (!s?.isSuper) return NextResponse.json({ ok: false, msg: 'Super Admin only' }, { status: 403 });
  const f = (await req.formData()).get('apk') as File | null;
  if (!f || !f.name.toLowerCase().endsWith('.apk')) return NextResponse.json({ ok: false, msg: 'Choose a .apk file' }, { status: 400 });
  if (f.size > 250 * 1024 * 1024) return NextResponse.json({ ok: false, msg: 'File is larger than 250 MB' }, { status: 400 });
  const buf = Buffer.from(await f.arrayBuffer());
  if (buf.subarray(0, 2).toString() !== 'PK') return NextResponse.json({ ok: false, msg: 'This is not a valid APK file' }, { status: 400 });
  fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, buf);
  setSetting('apk_name', f.name.replace(/[^\w.\-]/g, '_')); setSetting('apk_uploaded', new Date().toISOString().slice(0, 16).replace('T', ' ')); setSetting('apk_version', String(new URL(req.url).searchParams.get('v') || ''));
  if (!setting('apk_token')) setSetting('apk_token', crypto.randomUUID().replace(/-/g, ''));
  audit(s, 'mobileapp', 'apk-upload', f.name); return NextResponse.json({ ok: true, msg: 'APK uploaded.' });
}
