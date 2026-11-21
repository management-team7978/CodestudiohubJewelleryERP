import { guard } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { sendChat, sendPartyChat } from '@/actions/core';
import { ActionForm, Field } from '@/components/Form';
import { Card, PageHeader } from '@/components/ui';
export const dynamic = 'force-dynamic';

export default async function Chat({ searchParams }: { searchParams: Promise<{ with?: string; party?: string }> }) {
  const s = await guard('chat'); const db = getDb(); const sp = await searchParams; const w = sp.with; const other = Number(w || 0); const party = Number(sp.party || 0);
  const parties = db.prepare("SELECT id,name FROM parties WHERE type='B2B' AND active=1").all() as any[];
  const pmsgs = party ? db.prepare("SELECT m.*, CASE m.from_party WHEN 1 THEN (SELECT name FROM parties WHERE id=m.party_id) ELSE (SELECT name FROM users WHERE id=m.from_user) END un FROM chat_messages m WHERE party_id=? ORDER BY id").all(party) as any[] : [];
  const users = db.prepare('SELECT id,name,role_id FROM users WHERE active=1 AND id!=?').all(s.uid) as any[];
  const msgs = (other ? db.prepare('SELECT m.*, u.name un FROM chat_messages m JOIN users u ON u.id=m.from_user WHERE (from_user=? AND to_user=?) OR (from_user=? AND to_user=?) ORDER BY m.id').all(s.uid, other, other, s.uid) : db.prepare('SELECT m.*, u.name un FROM chat_messages m JOIN users u ON u.id=m.from_user WHERE to_user IS NULL ORDER BY m.id DESC LIMIT 50').all().reverse()) as any[];
  return (
    <>
      <PageHeader title="Chat" subtitle="Talk to admin, business owners and karigars" id="chat" help={{ steps: ['Pick a person on the left — or stay on “Everyone” for the team room.', 'Type a message and press Send. History is saved and visible in the audit trail.'] }} />
      <div className="grid gap-6 lg:grid-cols-4">
        <Card pad={false}><ul className="divide-y divide-slate-100"><li><a href="/chat" className={`block px-4 py-3 text-sm font-semibold ${!other ? 'bg-brand-50 text-brand-700' : ''}`}>👥 Everyone</a></li><li className="bg-slate-50 px-4 py-1.5 text-[11px] font-bold uppercase text-slate-400">Business owners (app)</li>{parties.map((u) => <li key={'p'+u.id}><a href={`/chat?party=${u.id}`} className={`block px-4 py-3 text-sm font-semibold ${party === u.id ? 'bg-brand-50 text-brand-700' : ''}`}>{u.name}</a></li>)}<li className="bg-slate-50 px-4 py-1.5 text-[11px] font-bold uppercase text-slate-400">Staff</li>{users.map((u) => <li key={u.id}><a href={`/chat?with=${u.id}`} className={`block px-4 py-3 text-sm font-semibold ${other === u.id ? 'bg-brand-50 text-brand-700' : ''}`}>{u.name}</a></li>)}</ul></Card>
        {party ? <Card className="lg:col-span-3"><div className="mb-4 flex max-h-96 min-h-48 flex-col gap-2 overflow-y-auto">{pmsgs.length ? pmsgs.map((m) => <div key={m.id} className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${m.from_party ? 'bg-slate-100' : 'ml-auto bg-brand-500 text-white'}`}><p className="text-[11px] font-bold opacity-70">{m.un} · {m.at}</p>{m.body}</div>) : <p className="m-auto text-sm text-slate-400">No messages from this business yet.</p>}</div><ActionForm action={sendPartyChat} submit="Reply"><input type="hidden" name="party_id" value={party} /><Field label="Message"><input name="body" className="input" autoComplete="off" required /></Field></ActionForm></Card> : <Card className="lg:col-span-3"><div className="mb-4 flex max-h-96 min-h-48 flex-col gap-2 overflow-y-auto">{msgs.length ? msgs.map((m) => <div key={m.id} className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${m.from_user === s.uid ? 'ml-auto bg-brand-500 text-white' : 'bg-slate-100'}`}><p className="text-[11px] font-bold opacity-70">{m.un} · {m.at}</p>{m.body}</div>) : <p className="m-auto text-sm text-slate-400">No messages yet — say hello 👋</p>}</div>
          <ActionForm action={sendChat} submit="Send"><input type="hidden" name="to_user" value={other || ''} /><Field label="Message"><input name="body" className="input" autoComplete="off" required /></Field></ActionForm></Card>}
      </div>
    </>
  );
}
