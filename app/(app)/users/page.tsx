import { guard } from '@/lib/auth';
import { getDb, MODULES } from '@/lib/db';
import { saveUser, userToggle, createRole, savePerms, addIp, delIp } from '@/actions/core';
import { ActionForm, Field } from '@/components/Form';
import { Badge, Card, PageHeader, Table, Td } from '@/components/ui';
export const dynamic = 'force-dynamic';

export default async function Users({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  await guard('users'); const db = getDb(); const sp = await searchParams;
  const users = db.prepare("SELECT u.*, r.name rname, d.name dept FROM users u LEFT JOIN roles r ON r.id=u.role_id LEFT JOIN departments d ON d.id=u.dept_id WHERE u.kind='staff' OR u.can_login=1 ORDER BY u.id").all() as any[];
  const roles = db.prepare('SELECT * FROM roles').all() as any[]; const depts = db.prepare('SELECT id,name FROM departments WHERE active=1').all() as any[];
  const rid = Number(sp.role || roles.find((r) => !r.is_super)?.id); const role = roles.find((r) => r.id === rid);
  const perms = Object.fromEntries((db.prepare('SELECT * FROM role_perms WHERE role_id=?').all(rid) as any[]).map((p) => [p.module, p]));
  const ips = db.prepare('SELECT * FROM ip_rules').all() as any[]; const enforce = (db.prepare("SELECT value FROM settings WHERE key='ip_enforce'").get() as any)?.value === '1';
  const logins = db.prepare('SELECT * FROM login_log ORDER BY id DESC LIMIT 8').all() as any[];
  return (
    <>
      <PageHeader title="Users, Roles & Access" subtitle="Who can do what — and from where" id="users" help={{ steps: ['Create users and give each one a role.', 'Pick a role below and tick View / Add / Edit / Delete for every module. Changes apply instantly, no code needed.', 'Optional: switch on IP restriction in Settings, then approve your shop / factory IPs here.'], tip: 'Permissions are checked on the server for every page and action — hiding a menu is not the only protection.' }} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Users" pad={false}><Table head={['Name', 'Email', 'Role', 'Status', '']}>{users.map((u) => (<tr key={u.id}><Td className="font-semibold">{u.name}</Td><Td>{u.email}</Td><Td>{u.rname}</Td><Td>{u.locked ? <span className="chip bg-rose-50 text-rose-600">Locked</span> : u.active ? <Badge>Active</Badge> : <span className="chip bg-slate-100">Blocked</span>}</Td>
            <Td right><div className="flex justify-end gap-1.5">{u.locked ? <form action={userToggle}><input type="hidden" name="id" value={u.id} /><input type="hidden" name="what" value="unlock" /><button className="btn-ghost !px-2.5 !py-1 text-xs">Unlock</button></form> : null}<form action={userToggle}><input type="hidden" name="id" value={u.id} /><input type="hidden" name="what" value="block" /><button className="btn-ghost !px-2.5 !py-1 text-xs">{u.active ? 'Block' : 'Unblock'}</button></form></div></Td></tr>))}</Table></Card>
          <Card title="Permissions">
            <div className="mb-4 flex flex-wrap gap-2">{roles.map((r) => <a key={r.id} href={`/users?role=${r.id}`} className={`chip !px-3 !py-1.5 ${r.id === rid ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600'}`}>{r.name}{r.is_super ? ' (full)' : ''}</a>)}</div>
            {role?.is_super ? <p className="text-sm text-slate-500">Super Admin always has full access.</p> : (
              <form action={savePerms}><input type="hidden" name="role_id" value={rid} /><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="th">Module</th>{['view', 'add', 'edit', 'delete'].map((k) => <th key={k} className="th text-center">{k}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{MODULES.map((m) => (<tr key={m}><td className="px-4 py-2 font-semibold capitalize">{m}</td>{['view', 'add', 'edit', 'delete'].map((k) => <td key={k} className="text-center"><input type="checkbox" name={`${m}.${k}`} defaultChecked={!!perms[m]?.[`can_${k}`]} className="h-4 w-4 accent-brand-500" /></td>)}</tr>))}</tbody></table></div><button className="btn-primary mt-4">Save permissions for {role?.name}</button></form>)}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Add user"><ActionForm action={saveUser} submit="Create user"><div className="space-y-3"><Field label="Name"><input name="name" className="input" required /></Field><Field label="Email"><input name="email" type="email" className="input" required /></Field><Field label="Mobile"><input name="mobile" className="input" /></Field><Field label="Role"><select name="role_id" className="input">{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field><Field label="Department"><select name="dept_id" className="input"><option value="">—</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field><Field label="Password (min 8)"><input name="password" type="password" className="input" required /></Field></div></ActionForm></Card>
          <Card title="Create new role"><ActionForm action={createRole} submit="Create role"><Field label="Role name"><input name="name" className="input" placeholder="Store Manager" required /></Field></ActionForm></Card>
          <Card title={`IP restriction — ${enforce ? 'ON' : 'OFF'}`}><p className="mb-3 text-xs text-slate-500">Turn on in Settings → Security. When ON, only these IPs can sign in.</p><ul className="mb-3 space-y-1">{ips.map((i) => <li key={i.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm"><span className="min-w-0 break-all">{i.ip} <span className="text-slate-400">{i.label}</span></span><form action={delIp}><input type="hidden" name="id" value={i.id} /><button className="text-rose-500">✕</button></form></li>)}</ul><ActionForm action={addIp} submit="Approve IP"><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><input name="ip" className="input" placeholder="203.0.113.5" /><input name="label" className="input" placeholder="Shop" /></div></ActionForm></Card>
          <Card title="Recent logins" pad={false}><ul className="divide-y divide-slate-100 text-xs">{logins.map((l) => <li key={l.id} className="flex items-start justify-between gap-3 px-4 py-2"><span className="min-w-0 break-all">{l.email || '—'} <span className="text-slate-400">{l.ip}</span></span><span className={`shrink-0 ${l.ok ? 'text-leaf-600' : 'text-rose-600'}`}>{l.ok ? 'OK' : l.reason}</span></li>)}</ul></Card>
        </div>
      </div>
    </>
  );
}
