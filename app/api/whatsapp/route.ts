import { NextRequest, NextResponse } from 'next/server';
import { settings } from '@/lib/db';
import crypto from 'crypto';
import { waAnswer, waSend } from '@/lib/wa';

// Meta WhatsApp Cloud API webhook. Client supplies: phone-number-id, permanent token, verify token (Settings → WhatsApp).
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams; const S = settings();
  if (q.get('hub.mode') === 'subscribe' && S.wa_verify_token && q.get('hub.verify_token') === S.wa_verify_token) return new NextResponse(q.get('hub.challenge'));
  return new NextResponse('Forbidden', { status: 403 });
}
export async function POST(req: NextRequest) {
  const raw = await req.text(); const S = settings();
  if (S.wa_app_secret) { // Meta signs every webhook call with the app secret
    const sig = req.headers.get('x-hub-signature-256') || ''; const want = 'sha256=' + crypto.createHmac('sha256', S.wa_app_secret).update(raw).digest('hex');
    if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return new NextResponse('Bad signature', { status: 401 });
  }
  const j: any = (() => { try { return JSON.parse(raw); } catch { return {}; } })();
  const m = j?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (m?.type === 'text') { const reply = waAnswer(m.from, m.text.body); await waSend(m.from, reply); return NextResponse.json({ ok: true, reply }); }
  return NextResponse.json({ ok: true });
}
