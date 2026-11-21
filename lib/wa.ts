import { getDb, settings, todayStr } from './db';
import { goldBalance } from '@/actions/util';
import { g3, inr } from './gold';

const digits = (s: string) => (s || '').replace(/\D/g, '').slice(-10);

/** Rule-based WhatsApp assistant. Owner → everything. Registered business → own orders/ledger only. */
export function waAnswer(from: string, text: string): string {
  const db = getDb(); const S = settings(); const t = text.toLowerCase(); const me = digits(from);
  const owner = me && me === digits(S.wa_owner_number || '');
  const party = db.prepare('SELECT * FROM parties WHERE active=1').all().find((p: any) => digits(p.mobile) === me) as any;
  if (!owner && !party) return 'Sorry, this number is not registered. Please contact the shop.';
  const ord = t.match(/(?:order\s*#?\s*|ord-?)(\d{3,6})/);
  if (ord) {
    const o = db.prepare('SELECT o.*, j.name jn FROM orders o JOIN jewel_types j ON j.id=o.jewel_type_id WHERE o.no=?').get('ORD-' + ord[1]) as any;
    if (!o || (!owner && o.party_id !== party.id)) return 'Order not found.';
    const st = db.prepare("SELECT d.name FROM order_stages s JOIN departments d ON d.id=s.dept_id WHERE s.order_id=? AND s.status='Active'").get(o.id) as any;
    return `${o.no} (${o.jn}, ${o.weight} g)\nStatus: ${o.status}${st ? '\nNow in: ' + st.name : ''}\nDue: ${o.due_date || '-'}`;
  }
  if (!owner) {
    if (/ledger|balance|pending|due|bill/.test(t)) {
      const c = db.prepare('SELECT COALESCE(SUM(debit-credit),0) b FROM cash_ledger WHERE party_id=?').get(party.id) as any; const g = goldBalance('party', party.id);
      return `Hello ${party.name}\nCash due: ${inr(c.b)}\nGold with us (fine): ${g3(g.fine)} g`;
    }
    const open = db.prepare("SELECT no,status FROM orders WHERE party_id=? AND status NOT IN ('Delivered','Cancelled') LIMIT 8").all(party.id) as any[];
    return open.length ? 'Your open orders:\n' + open.map((o) => `${o.no} – ${o.status}`).join('\n') : 'You have no open orders. Ask “ledger” for your balance.';
  }
  if (/loss/.test(t)) {
    const rows = db.prepare('SELECT d.name n, ROUND(SUM(l.loss_fine),3) f FROM loss_entries l LEFT JOIN departments d ON d.id=l.dept_id WHERE l.date=? GROUP BY d.name').all(todayStr()) as any[];
    return rows.length ? "Today's loss (fine g):\n" + rows.map((r) => `${r.n}: ${r.f}`).join('\n') : 'No loss booked today.';
  }
  const kar = db.prepare("SELECT * FROM users WHERE kind='karigar'").all().find((k: any) => t.includes(k.name.split(' ')[0].toLowerCase())) as any;
  if (kar) { const g = goldBalance('karigar', kar.id); return `${kar.name} holds ${g3(g.gross)} g (fine ${g3(g.fine)} g).`; }
  if (/pending|payment|outstanding/.test(t)) { const c = db.prepare('SELECT COALESCE(SUM(debit-credit),0) b FROM cash_ledger').get() as any; return `Total pending payment: ${inr(c.b)}`; }
  return 'Ask me: “today’s loss”, “where is order #1002?”, “gold with Ramesh”, or “pending payment”.';
}

export async function waSend(to: string, body: string) {
  const S = settings(); if (!S.wa_token || !S.wa_phone_id) return false;
  const r = await fetch(`https://graph.facebook.com/v20.0/${S.wa_phone_id}/messages`, { method: 'POST', headers: { Authorization: 'Bearer ' + S.wa_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }) });
  return r.ok;
}
