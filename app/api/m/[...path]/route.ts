import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';
import { getDb, settings } from '@/lib/db';
import { goldBalance } from '@/actions/util';

const SECRET = new TextEncoder().encode(process.env.ERP_SECRET || 'dev-only-change-me-in-production-please');
const digits = (s: string) => (s || '').replace(/\D/g, '').slice(-10);
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const sign = (d: string) => crypto.createHmac('sha256', String(process.env.ERP_SECRET || 'dev-only-change-me-in-production-please')).update(d).digest('hex').slice(0, 32);
const json = (o: unknown, status = 200) => NextResponse.json(o, { status });

async function auth(req: NextRequest) {
  const t = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, SECRET); const db = getDb();
    const p = db.prepare("SELECT * FROM parties WHERE id=? AND active=1 AND type='B2B'").get(payload.pid as number) as any;
    if (!p || db.prepare('SELECT 1 FROM blocked_parties WHERE party_id=?').get(p.id)) return null;
    return p;
  } catch { return null; }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.join('/'); const db = getDb(); const q = req.nextUrl.searchParams;
  if (path === 'img') { // signed, expiring image link
    const id = Number(q.get('d')), exp = Number(q.get('exp')), sg = q.get('sig') || '';
    if (Date.now() > exp || sign(`${id}.${exp}.${q.get('p')}`) !== sg) return new NextResponse('Link expired', { status: 403 });
    const d = db.prepare('SELECT image FROM designs WHERE id=?').get(id) as any; if (!d?.image) return new NextResponse('No image', { status: 404 });
    const r = await fetch(d.image); return new NextResponse(await r.arrayBuffer(), { headers: { 'Content-Type': r.headers.get('content-type') || 'image/jpeg', 'Cache-Control': 'no-store' } });
  }
  const p = await auth(req); if (!p) return json({ error: 'unauthorized' }, 401);
  if (path === 'me') return json({ id: p.id, name: p.name, mobile: p.mobile });
  if (path === 'designs') {
    const rows = db.prepare('SELECT d.* FROM designs d JOIN design_access a ON a.design_id=d.id WHERE a.party_id=? AND d.visible=1 ORDER BY d.id DESC').all(p.id) as any[];
    const exp = Date.now() + 120000;
    return json(rows.map((d) => ({ id: d.id, code: d.code, title: d.title, category: d.category, weight: d.weight, imageUrl: d.image ? `/api/m/img?d=${d.id}&exp=${exp}&p=${p.id}&sig=${sign(`${d.id}.${exp}.${p.id}`)}` : null, watermark: `${p.name} · ${p.mobile}` })));
  }
  if (path === 'orders') {
    return json(db.prepare(`SELECT o.id,o.no,o.status,o.due_date,o.weight,o.design,j.name jewel,(SELECT d.name FROM order_stages s JOIN departments d ON d.id=s.dept_id WHERE s.order_id=o.id AND s.status='Active') dept,
      (SELECT COUNT(*) FROM order_stages WHERE order_id=o.id) total,(SELECT COUNT(*) FROM order_stages WHERE order_id=o.id AND status='Done') done FROM orders o JOIN jewel_types j ON j.id=o.jewel_type_id WHERE o.party_id=? ORDER BY o.id DESC`).all(p.id));
  }
  if (path === 'ledger') {
    const cash = db.prepare('SELECT COALESCE(SUM(debit-credit),0) b FROM cash_ledger WHERE party_id=?').get(p.id) as any; const g = goldBalance('party', p.id);
    return json({ cashDue: cash.b, goldGross: Math.round(g.gross * 1000) / 1000, goldFine: Math.round(g.fine * 1000) / 1000, cash: db.prepare('SELECT date,narration,debit,credit FROM cash_ledger WHERE party_id=? ORDER BY id DESC LIMIT 50').all(p.id), gold: db.prepare('SELECT date,narration,dir,gross,touch,fine FROM gold_ledger WHERE acct_type=? AND acct_id=? ORDER BY id DESC LIMIT 50').all('party', p.id) });
  }
  if (path === 'bills') return json(db.prepare("SELECT id,no,type,date,total,paid,gold_fine,status FROM invoices WHERE party_id=? AND status!='Cancelled' ORDER BY id DESC").all(p.id));
  if (path === 'chat') return json(db.prepare('SELECT id,at,body,from_party FROM chat_messages WHERE party_id=? ORDER BY id').all(p.id));
  return json({ error: 'not found' }, 404);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.join('/'); const db = getDb(); const b: any = await req.json().catch(() => ({})); const S = settings();
  if (path === 'otp') {
    const m = digits(b.mobile); const p = db.prepare("SELECT * FROM parties WHERE active=1 AND type='B2B'").all().find((x: any) => digits(x.mobile) === m) as any;
    const recent = db.prepare("SELECT COUNT(*) c FROM otp_codes WHERE mobile=? AND expires>?").get(m, new Date(Date.now() - 3600000 + 600000).toISOString()) as any;
    if (recent.c >= 5) return json({ ok: false, error: 'Too many requests. Try later.' }, 429);
    const reply: any = { ok: true, message: 'If this number is approved, an OTP has been sent.' };
    if (p && !db.prepare('SELECT 1 FROM blocked_parties WHERE party_id=?').get(p.id)) {
      const code = String(crypto.randomInt(100000, 999999));
      db.prepare('INSERT INTO otp_codes(mobile,code_hash,expires) VALUES(?,?,?)').run(m, sha(code + m), new Date(Date.now() + 600000).toISOString());
      if (S.sms_webhook) fetch(S.sms_webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile: m, message: `Your Shakti Gold login OTP is ${code}. Valid 10 minutes.` }) }).catch(() => {});
      if (process.env.ERP_DEV_OTP === '1') reply.devOtp = code;
    }
    return json(reply);
  }
  if (path === 'login') {
    const m = digits(b.mobile); const row = db.prepare('SELECT * FROM otp_codes WHERE mobile=? AND used=0 AND expires>? ORDER BY id DESC LIMIT 1').get(m, new Date().toISOString()) as any;
    if (!row || row.tries >= 5) return json({ error: 'OTP expired. Request a new one.' }, 401);
    if (row.code_hash !== sha(String(b.otp) + m)) { db.prepare('UPDATE otp_codes SET tries=tries+1 WHERE id=?').run(row.id); return json({ error: 'Wrong OTP.' }, 401); }
    db.prepare('UPDATE otp_codes SET used=1 WHERE id=?').run(row.id);
    const p = db.prepare("SELECT * FROM parties WHERE active=1 AND type='B2B'").all().find((x: any) => digits(x.mobile) === m) as any; if (!p) return json({ error: 'Not approved.' }, 403);
    const token = await new SignJWT({ pid: p.id }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('30d').sign(SECRET);
    return json({ token, party: { id: p.id, name: p.name, mobile: p.mobile } });
  }
  const p = await auth(req); if (!p) return json({ error: 'unauthorized' }, 401);
  if (path === 'event') { // design view / screenshot / recording / proctoring alert
    const allowed = ['view', 'screenshot', 'screen-recording', 'proctor-face-away', 'proctor-second-face', 'proctor-camera-denied'];
    if (!allowed.includes(b.event)) return json({ error: 'bad event' }, 400);
    db.prepare('INSERT INTO design_views(party_id,design_id,event,device,snapshot) VALUES(?,?,?,?,?)').run(p.id, Number(b.design_id) || null, b.event, String(b.device || '').slice(0, 80), b.snapshot ? String(b.snapshot).slice(0, 400000) : null);
    return json({ ok: true });
  }
  if (path === 'chat') { const t = String(b.body || '').trim().slice(0, 1000); if (!t) return json({ error: 'empty' }, 400); db.prepare('INSERT INTO chat_messages(party_id,from_party,body) VALUES(?,1,?)').run(p.id, t); return json({ ok: true }); }
  if (path === 'push-token') { db.prepare('INSERT OR REPLACE INTO push_tokens VALUES(?,?)').run(p.id, String(b.token)); return json({ ok: true }); }
  if (path === 'orders') { // business places an order request from a design
    const d = db.prepare('SELECT d.* FROM designs d JOIN design_access a ON a.design_id=d.id WHERE d.id=? AND a.party_id=?').get(Number(b.design_id), p.id) as any; if (!d) return json({ error: 'Design not available' }, 404);
    const jt = db.prepare('SELECT id FROM jewel_types WHERE lower(name)=lower(?)').get(d.category) as any || db.prepare('SELECT id FROM jewel_types LIMIT 1').get() as any;
    const flow: number[] = JSON.parse((db.prepare('SELECT flow FROM jewel_types WHERE id=?').get(jt.id) as any).flow);
    const no = 'ORD-' + (1001 + (db.prepare('SELECT COUNT(*) c FROM orders').get() as any).c);
    db.transaction(() => { const oid = Number(db.prepare("INSERT INTO orders(no,party_id,kind,jewel_type_id,design,purity,weight,qty,due_date,status,remarks) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(no, p.id, 'B2B', jt.id, d.code, '22K', d.weight, Math.max(1, Number(b.qty) || 1), String(b.due_date || ''), 'New', 'Placed from mobile app: ' + String(b.remarks || '')).lastInsertRowid); flow.forEach((dp, i) => db.prepare("INSERT INTO order_stages(order_id,seq,dept_id,status) VALUES(?,?,?,'Pending')").run(oid, i, dp)); })();
    return json({ ok: true, no });
  }
  return json({ error: 'not found' }, 404);
}
