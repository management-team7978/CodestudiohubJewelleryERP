import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.ERP_DB || path.join(process.cwd(), 'data', 'erp.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS roles(id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL, is_super INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS role_perms(role_id INTEGER, module TEXT, can_view INTEGER DEFAULT 0, can_add INTEGER DEFAULT 0, can_edit INTEGER DEFAULT 0, can_delete INTEGER DEFAULT 0, PRIMARY KEY(role_id,module));
CREATE TABLE IF NOT EXISTS departments(id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL, head TEXT, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, mobile TEXT, email TEXT UNIQUE, password_hash TEXT, role_id INTEGER, dept_id INTEGER, kind TEXT DEFAULT 'staff', wage_type TEXT DEFAULT 'per_gram', wage_rate REAL DEFAULT 0, can_login INTEGER DEFAULT 1, active INTEGER DEFAULT 1, onboarded INTEGER DEFAULT 0, failed INTEGER DEFAULT 0, locked INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS parties(id INTEGER PRIMARY KEY, name TEXT NOT NULL, type TEXT DEFAULT 'B2B', mobile TEXT, gstin TEXT, state TEXT DEFAULT 'Maharashtra', state_code TEXT DEFAULT '27', address TEXT, pincode TEXT, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS jewel_types(id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL, flow TEXT DEFAULT '[]');
CREATE TABLE IF NOT EXISTS items(id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL, unit TEXT DEFAULT 'gram', category TEXT DEFAULT 'Other', min_stock REAL DEFAULT 0, hsn TEXT DEFAULT '7113');
CREATE TABLE IF NOT EXISTS stock_txn(id INTEGER PRIMARY KEY, date TEXT, item_id INTEGER, kind TEXT, qty REAL, dept_id INTEGER, note TEXT);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY, no TEXT UNIQUE, party_id INTEGER, kind TEXT DEFAULT 'B2B', jewel_type_id INTEGER, design TEXT, purity TEXT DEFAULT '22K', weight REAL DEFAULT 0, size TEXT, qty INTEGER DEFAULT 1, due_date TEXT, status TEXT DEFAULT 'New', remarks TEXT, gold_received REAL DEFAULT 0, current_stage INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS order_stages(id INTEGER PRIMARY KEY, order_id INTEGER, seq INTEGER, dept_id INTEGER, karigar_id INTEGER, status TEXT DEFAULT 'Pending', weight_in REAL DEFAULT 0, weight_out REAL DEFAULT 0, started_at TEXT, finished_at TEXT);
CREATE TABLE IF NOT EXISTS gold_ledger(id INTEGER PRIMARY KEY, date TEXT, acct_type TEXT, acct_id INTEGER, dir TEXT, gross REAL DEFAULT 0, touch REAL DEFAULT 100, fine REAL DEFAULT 0, ref_type TEXT, ref_id INTEGER, order_id INTEGER, narration TEXT, by_user INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS gl_acct ON gold_ledger(acct_type, acct_id);
CREATE TABLE IF NOT EXISTS cash_ledger(id INTEGER PRIMARY KEY, date TEXT, party_id INTEGER, debit REAL DEFAULT 0, credit REAL DEFAULT 0, ref_type TEXT, ref_id INTEGER, narration TEXT);
CREATE TABLE IF NOT EXISTS loss_entries(id INTEGER PRIMARY KEY, date TEXT, way TEXT, dept_id INTEGER, karigar_id INTEGER, order_id INTEGER, jewel_type_id INTEGER, weight_given REAL, weight_received REAL, touch REAL DEFAULT 100, loss_gross REAL, loss_fine REAL, recovered REAL DEFAULT 0, note TEXT, by_user INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS melting_batches(id INTEGER PRIMARY KEY, no TEXT, date TEXT, karigar_id INTEGER, target_touch REAL, input_gross REAL, input_fine REAL, alloy_added REAL DEFAULT 0, output_gross REAL, output_touch REAL, output_fine REAL, loss_fine REAL, note TEXT);
CREATE TABLE IF NOT EXISTS melting_inputs(id INTEGER PRIMARY KEY, batch_id INTEGER, party_id INTEGER, gross REAL, touch REAL, fine REAL);
CREATE TABLE IF NOT EXISTS invoices(id INTEGER PRIMARY KEY, no TEXT UNIQUE, type TEXT, date TEXT, party_id INTEGER, order_id INTEGER, place_of_supply TEXT DEFAULT '27', gold_gross REAL DEFAULT 0, gold_fine REAL DEFAULT 0, gold_rate REAL DEFAULT 0, labour REAL DEFAULT 0, other_charges REAL DEFAULT 0, taxable REAL DEFAULT 0, cgst REAL DEFAULT 0, sgst REAL DEFAULT 0, igst REAL DEFAULT 0, total REAL DEFAULT 0, paid REAL DEFAULT 0, status TEXT DEFAULT 'Issued', irn TEXT, ack_no TEXT, ack_date TEXT, signed_qr TEXT, einv_status TEXT DEFAULT 'NA', note TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS invoice_items(id INTEGER PRIMARY KEY, invoice_id INTEGER, description TEXT, hsn TEXT, qty REAL, gross REAL DEFAULT 0, touch REAL DEFAULT 100, fine REAL DEFAULT 0, rate REAL DEFAULT 0, amount REAL DEFAULT 0, gst_rate REAL DEFAULT 0);
CREATE TABLE IF NOT EXISTS receipts(id INTEGER PRIMARY KEY, no TEXT, date TEXT, party_id INTEGER, invoice_id INTEGER, mode TEXT, amount REAL DEFAULT 0, gross REAL DEFAULT 0, touch REAL DEFAULT 100, fine REAL DEFAULT 0, note TEXT);
CREATE TABLE IF NOT EXISTS transfers(id INTEGER PRIMARY KEY, date TEXT, from_type TEXT, from_id INTEGER, to_type TEXT, to_id INTEGER, gross REAL, touch REAL, fine REAL, order_id INTEGER, status TEXT DEFAULT 'Pending', by_user INTEGER, confirmed_by INTEGER, note TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS gold_rates(id INTEGER PRIMARY KEY, date TEXT UNIQUE, rate_24k REAL);
CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY, at TEXT DEFAULT CURRENT_TIMESTAMP, user_id INTEGER, user_name TEXT, module TEXT, action TEXT, ref TEXT, old_value TEXT, new_value TEXT, ip TEXT);
CREATE TABLE IF NOT EXISTS einvoice_log(id INTEGER PRIMARY KEY, at TEXT DEFAULT CURRENT_TIMESTAMP, invoice_id INTEGER, mode TEXT, ok INTEGER, message TEXT, request TEXT, response TEXT);
CREATE TABLE IF NOT EXISTS chat_messages(id INTEGER PRIMARY KEY, at TEXT DEFAULT CURRENT_TIMESTAMP, from_user INTEGER, to_user INTEGER, body TEXT, party_id INTEGER, from_party INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS otp_codes(id INTEGER PRIMARY KEY, mobile TEXT, code_hash TEXT, expires TEXT, tries INTEGER DEFAULT 0, used INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS push_tokens(party_id INTEGER, token TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS designs(id INTEGER PRIMARY KEY, code TEXT UNIQUE, title TEXT, category TEXT, weight REAL, image TEXT, visible INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS design_access(design_id INTEGER, party_id INTEGER, PRIMARY KEY(design_id,party_id));
CREATE TABLE IF NOT EXISTS design_views(id INTEGER PRIMARY KEY, at TEXT DEFAULT CURRENT_TIMESTAMP, user_id INTEGER, party_id INTEGER, design_id INTEGER, event TEXT, device TEXT, snapshot TEXT);
CREATE TABLE IF NOT EXISTS blocked_parties(party_id INTEGER PRIMARY KEY, reason TEXT);
CREATE TABLE IF NOT EXISTS ip_rules(id INTEGER PRIMARY KEY, ip TEXT, label TEXT);
CREATE TABLE IF NOT EXISTS login_log(id INTEGER PRIMARY KEY, at TEXT DEFAULT CURRENT_TIMESTAMP, email TEXT, ip TEXT, ok INTEGER, reason TEXT);
`;

export const MODULES = [
  'dashboard', 'departments', 'karigars', 'jewels', 'orders', 'transfers', 'loss', 'inventory',
  'gold', 'melting', 'ledger', 'billing', 'gst', 'designs', 'chat', 'users', 'audit', 'settings', 'backup', 'mobileapp', 'guide',
] as const;

type G = typeof globalThis & { __db?: Database.Database };

function init(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = OFF');
  db.exec(SCHEMA);
  const has = db.prepare('SELECT COUNT(*) c FROM roles').get() as { c: number };
  if (!has.c) seed(db);
  return db;
}

export function getDb(): Database.Database {
  const g = globalThis as G;
  if (!g.__db) g.__db = init();
  return g.__db;
}

const today = (off = 0) => {
  const d = new Date(); d.setDate(d.getDate() + off);
  return d.toISOString().slice(0, 10);
};

function seed(db: Database.Database) {
  const run = db.transaction(() => {
    const role = db.prepare('INSERT INTO roles(name,is_super) VALUES(?,?)');
    const perm = db.prepare('INSERT INTO role_perms VALUES(?,?,?,?,?,?)');
    const roles: Record<string, number> = {};
    for (const [n, s] of [['Super Admin', 1], ['Admin', 0], ['Accountant', 0], ['Department Head', 0], ['Karigar', 0]] as const)
      roles[n] = Number(role.run(n, s).lastInsertRowid);
    const grant = (r: string, mods: string[], a = 1, e = 1, d = 0) => mods.forEach((m) => perm.run(roles[r], m, 1, a, e, d));
    for (const m of MODULES) perm.run(roles['Super Admin'], m, 1, 1, 1, 1);
    grant('Admin', MODULES.filter((m) => !['users', 'audit', 'backup'].includes(m)) as unknown as string[], 1, 1, 0);
    grant('Accountant', ['dashboard', 'ledger', 'billing', 'gst', 'gold', 'guide'], 1, 1, 0);
    grant('Department Head', ['dashboard', 'orders', 'transfers', 'loss', 'guide'], 1, 1, 0);
    perm.run(roles['Karigar'], 'dashboard', 1, 0, 0, 0); perm.run(roles['Karigar'], 'guide', 1, 0, 0, 0);

    const dept = db.prepare('INSERT INTO departments(name,head) VALUES(?,?)');
    const D: Record<string, number> = {};
    for (const [n, h] of [['Melting', 'Suresh'], ['Casting', 'Mahesh'], ['Filing', 'Ramesh'], ['Setting', 'Dinesh'], ['Polishing', 'Kailash'], ['Hallmarking', 'Naresh'], ['QC', 'Rajesh'], ['Packing', 'Lokesh']])
      D[n] = Number(dept.run(n, h).lastInsertRowid);

    const hash = (p: string) => bcrypt.hashSync(p, 10);
    const user = db.prepare('INSERT INTO users(name,mobile,email,password_hash,role_id,dept_id,kind,wage_type,wage_rate) VALUES(?,?,?,?,?,?,?,?,?)');
    user.run('Amarjeet Panda', '9867153231', 'admin@erp.local', hash('Admin@123'), roles['Super Admin'], null, 'staff', 'per_gram', 0);
    user.run('Priya Accounts', '9000000002', 'accounts@erp.local', hash('Accounts@123'), roles['Accountant'], null, 'staff', 'per_gram', 0);
    const K: number[] = [];
    for (const [n, d, w] of [['Ramesh Sonar', 'Filing', 120], ['Kailash Verma', 'Polishing', 90], ['Dinesh Patil', 'Setting', 150], ['Mahesh Jadhav', 'Casting', 100], ['Suresh Kale', 'Melting', 80]] as const)
      K.push(Number(user.run(n, '98' + Math.floor(10000000 + Math.random() * 89999999), null, null, roles['Karigar'], D[d], 'karigar', 'per_gram', w).lastInsertRowid));

    const party = db.prepare('INSERT INTO parties(name,type,mobile,gstin,state,state_code,address,pincode) VALUES(?,?,?,?,?,?,?,?)');
    const P = [
      Number(party.run('Zaveri Traders', 'B2B', '9820000001', '27AABCZ9876M1Z2', 'Maharashtra', '27', 'Kalbadevi Road, Mumbai', '400002').lastInsertRowid),
      Number(party.run('Rajesh Jewellers', 'B2B', '9820000002', '24AAACR5055K1Z8', 'Gujarat', '24', 'Ring Road, Surat', '395002').lastInsertRowid),
      Number(party.run('Anita Sharma', 'B2C', '9820000003', null, 'Maharashtra', '27', 'Vashi, Navi Mumbai', '400703').lastInsertRowid),
      Number(party.run('Gold Bullion Supplier', 'SUPPLIER', '9820000004', null, 'Maharashtra', '27', 'Opera House, Mumbai', '400004').lastInsertRowid),
    ];

    const jt = db.prepare('INSERT INTO jewel_types(name,flow) VALUES(?,?)');
    const flows: Record<string, string[]> = {
      Ring: ['Casting', 'Filing', 'Setting', 'Polishing', 'QC'], Chain: ['Melting', 'Casting', 'Filing', 'Polishing', 'Hallmarking', 'QC'],
      Bangle: ['Casting', 'Filing', 'Polishing', 'Hallmarking', 'QC', 'Packing'], Necklace: ['Casting', 'Filing', 'Setting', 'Polishing', 'QC', 'Packing'],
      Earring: ['Casting', 'Filing', 'Setting', 'Polishing', 'QC'], Pendant: ['Casting', 'Filing', 'Setting', 'Polishing', 'QC'],
    };
    const J: Record<string, number> = {};
    for (const [n, f] of Object.entries(flows)) J[n] = Number(jt.run(n, JSON.stringify(f.map((x) => D[x]))).lastInsertRowid);

    const item = db.prepare('INSERT INTO items(name,unit,category,min_stock,hsn) VALUES(?,?,?,?,?)');
    const I = [['Fine Gold 24K', 'gram', 'Gold', 100, '7108'], ['Silver', 'gram', 'Silver', 500, '7106'], ['Diamond (VVS)', 'carat', 'Stone', 10, '7102'], ['Alloy (Copper)', 'gram', 'Alloy', 200, '7403'], ['Findings / Clasps', 'piece', 'Other', 100, '7113']]
      .map((r) => Number(item.run(...r).lastInsertRowid));
    const st = db.prepare('INSERT INTO stock_txn(date,item_id,kind,qty,dept_id,note) VALUES(?,?,?,?,?,?)');
    st.run(today(-20), I[0], 'IN', 500, null, 'Opening stock'); st.run(today(-5), I[0], 'OUT', 120, D['Casting'], 'Issued to casting');
    st.run(today(-20), I[1], 'IN', 300, null, 'Opening'); st.run(today(-20), I[2], 'IN', 25, null, 'Opening');
    st.run(today(-20), I[3], 'IN', 800, null, 'Opening'); st.run(today(-10), I[4], 'IN', 60, null, 'Opening');

    const rate = db.prepare('INSERT INTO gold_rates(date,rate_24k) VALUES(?,?)');
    for (let i = 14; i >= 0; i--) rate.run(today(-i), 7400 + Math.round(Math.sin(i) * 40 + (14 - i) * 6));

    const gl = db.prepare('INSERT INTO gold_ledger(date,acct_type,acct_id,dir,gross,touch,fine,ref_type,narration) VALUES(?,?,?,?,?,?,?,?,?)');
    const fine = (g: number, t: number) => Math.round(g * t * 10) / 1000;
    // 75 touch example + others received from parties
    gl.run(today(-12), 'party', P[0], 'IN', 200, 75, fine(200, 75), 'receipt', '75 touch gold received (old ornaments)');
    gl.run(today(-10), 'party', P[0], 'IN', 100, 91.6, fine(100, 91.6), 'receipt', '22K gold received');
    gl.run(today(-8), 'party', P[1], 'IN', 150, 99.5, fine(150, 99.5), 'receipt', 'Bar gold received');
    gl.run(today(-7), 'party', P[0], 'OUT', 60, 100, 60, 'return', 'Fine returned');
    gl.run(today(-6), 'store', 0, 'IN', 300, 99.9, fine(300, 99.9), 'purchase', 'Bullion purchase');
    const op = db.prepare('INSERT INTO gold_ledger(date,acct_type,acct_id,dir,gross,touch,fine,ref_type,narration) VALUES(?,?,?,?,?,?,?,?,?)');
    op.run(today(-5), 'store', 0, 'OUT', 80, 91.6, fine(80, 91.6), 'transfer', 'Issued to Casting'); op.run(today(-5), 'dept', D['Casting'], 'IN', 80, 91.6, fine(80, 91.6), 'transfer', 'From store');
    op.run(today(-4), 'dept', D['Casting'], 'OUT', 50, 91.6, fine(50, 91.6), 'transfer', 'To Mahesh'); op.run(today(-4), 'karigar', K[3], 'IN', 50, 91.6, fine(50, 91.6), 'transfer', 'From Casting');

    const ord = db.prepare('INSERT INTO orders(no,party_id,kind,jewel_type_id,design,purity,weight,size,qty,due_date,status,remarks,gold_received,current_stage) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const os = db.prepare('INSERT INTO order_stages(order_id,seq,dept_id,karigar_id,status,weight_in,weight_out,started_at,finished_at) VALUES(?,?,?,?,?,?,?,?,?)');
    const orders: [string, number, string, string, string, number, number, string, number][] = [
      ['ORD-1001', P[0], 'B2B', 'Ring', 'R-204', 22, 1, 'Delivered', 5], ['ORD-1002', P[0], 'B2B', 'Chain', 'C-118', 45, 2, 'In Process', 2],
      ['ORD-1003', P[1], 'B2B', 'Bangle', 'B-77', 60, 2, 'In Process', 1], ['ORD-1004', P[2], 'B2C', 'Necklace', 'N-301', 80, 1, 'New', 0],
      ['ORD-1005', P[1], 'B2B', 'Earring', 'E-45', 12, 6, 'Ready', 4],
    ].map((o) => [o[0], o[1], o[2], o[3], o[4], o[5], o[6], o[7], o[8]] as never);
    let n = 0;
    for (const o of orders) {
      n++;
      const flow = JSON.parse((db.prepare('SELECT flow FROM jewel_types WHERE id=?').get(J[o[3]]) as { flow: string }).flow) as number[];
      const oid = Number(ord.run(o[0], o[1], o[2], J[o[3]], o[4], '22K', o[5], '', o[6], today(5 + n), o[7], '', o[5], Math.min(o[8], flow.length - 1)).lastInsertRowid);
      flow.forEach((d, i) => {
        const done = o[7] === 'Delivered' || o[7] === 'Ready' || i < o[8];
        const cur = !done && i === o[8] && o[7] === 'In Process';
        os.run(oid, i, d, K[i % K.length], done ? 'Done' : cur ? 'Active' : 'Pending', done || cur ? o[5] : 0, done ? o[5] - 0.05 * (i + 1) : 0, done || cur ? today(-6 + i) : null, done ? today(-5 + i) : null);
      });
    }

    const loss = db.prepare('INSERT INTO loss_entries(date,way,dept_id,karigar_id,order_id,jewel_type_id,weight_given,weight_received,touch,loss_gross,loss_fine,recovered,note) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const depts = Object.values(D);
    for (let i = 20; i >= 1; i--) {
      const d = depts[i % 6]; const k = K[i % K.length]; const given = 40 + (i * 7) % 30;
      const lg = Math.round((0.15 + ((i * 37) % 60) / 100) * 1000) / 1000;
      loss.run(today(-i), i % 3 ? 'SHIFT_END' : 'WEIGHING', d, k, (i % 5) + 1, Object.values(J)[i % 6], given, Math.round((given - lg) * 1000) / 1000, 91.6, lg, Math.round(lg * 0.916 * 1000) / 1000, i % 4 === 0 ? 0.05 : 0, '');
    }

    const mb = db.prepare('INSERT INTO melting_batches(no,date,karigar_id,target_touch,input_gross,input_fine,alloy_added,output_gross,output_touch,output_fine,loss_fine,note) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
    const mi = db.prepare('INSERT INTO melting_inputs(batch_id,party_id,gross,touch,fine) VALUES(?,?,?,?,?)');
    const b = Number(mb.run('MLT-001', today(-9), K[4], 80.5, 300, 241.6, 0, 299.8, 80.5, 0, 0, 'Mixed touch melting').lastInsertRowid);
    mi.run(b, P[0], 200, 75, fine(200, 75)); mi.run(b, P[0], 100, 91.6, fine(100, 91.6));
    db.prepare('UPDATE melting_batches SET input_fine=?, output_fine=?, loss_fine=? WHERE id=?').run(fine(200, 75) + fine(100, 91.6), fine(299.8, 80.5), Math.round((fine(200, 75) + fine(100, 91.6) - fine(299.8, 80.5)) * 1000) / 1000, b);

    // demo bills: GST (same state), GST (inter-state → IGST), Gold bill, Cash bill
    const inv = db.prepare('INSERT INTO invoices(no,type,date,party_id,place_of_supply,gold_gross,gold_fine,gold_rate,labour,taxable,cgst,sgst,igst,total,paid,einv_status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const ii = db.prepare('INSERT INTO invoice_items(invoice_id,description,hsn,qty,gross,touch,fine,rate,amount,gst_rate) VALUES(?,?,?,?,?,?,?,?,?,?)');
    const cl = db.prepare('INSERT INTO cash_ledger(date,party_id,debit,credit,ref_type,ref_id,narration) VALUES(?,?,?,?,?,?,?)');
    let a = Number(inv.run('GST/26-27/0001', 'GST', today(-6), P[0], '27', 0, 0, 0, 0, 333000, 4995, 4995, 0, 342990, 100000, 'Pending').lastInsertRowid);
    ii.run(a, '22K Gold Chain C-118', '7113', 45, 0, 100, 0, 7400, 333000, 3); cl.run(today(-6), P[0], 342990, 0, 'invoice', a, 'Invoice GST/26-27/0001');
    db.prepare('INSERT INTO receipts(no,date,party_id,invoice_id,mode,amount) VALUES(?,?,?,?,?,?)').run('RC-0001', today(-4), P[0], a, 'UPI', 100000); cl.run(today(-4), P[0], 0, 100000, 'receipt', 0, 'UPI receipt RC-0001');
    a = Number(inv.run('GST/26-27/0002', 'GST', today(-3), P[1], '24', 0, 0, 0, 0, 444000, 0, 0, 13320, 457320, 0, 'Pending').lastInsertRowid);
    ii.run(a, '22K Temple Bangle B-77', '7113', 60, 0, 100, 0, 7400, 444000, 3); cl.run(today(-3), P[1], 457320, 0, 'invoice', a, 'Invoice GST/26-27/0002');
    a = Number(inv.run('GB/26-27/0001', 'GOLD', today(-2), P[0], '27', 22, 20.152, 7484, 1500, 1500, 0, 0, 0, 1500, 0, 'NA').lastInsertRowid);
    ii.run(a, '22K Ring R-204', '7113', 22, 22, 91.6, 20.152, 0, 1500, 0); cl.run(today(-2), P[0], 1500, 0, 'invoice', a, 'Gold bill GB/26-27/0001');
    gl.run(today(-2), 'party', P[0], 'OUT', 22, 91.6, 20.152, 'invoice', 'Gold bill GB/26-27/0001');
    a = Number(inv.run('CB/26-27/0001', 'CASH', today(-1), P[2], '27', 0, 0, 0, 0, 8000, 0, 0, 0, 8000, 0, 'NA').lastInsertRowid);
    ii.run(a, 'Silver Pooja Set', '7114', 1, 0, 100, 0, 8000, 8000, 0); cl.run(today(-1), P[2], 8000, 0, 'invoice', a, 'Cash bill CB/26-27/0001');

    const set = db.prepare('INSERT INTO settings VALUES(?,?)');
    const S: Record<string, string> = {
      company_name: 'Shakti Gold', company_gstin: '27ABCDE1234F1Z5', company_state: 'Maharashtra', company_state_code: '27',
      company_address: 'Patwa Chawl, Zaveri Bazar, Mumbai', company_pincode: '400002', company_phone: '+91 98200 00000', company_email: 'info@shaktigold.example',
      invoice_prefix_gst: 'GST/26-27/', invoice_prefix_gold: 'GB/26-27/', invoice_prefix_cash: 'CB/26-27/', fy: '2026-27',
      gst_jewellery: '3', gst_making: '5', hsn_jewellery: '7113', session_minutes: '30', max_attempts: '5', ip_enforce: '0',
      einv_mode: 'manual', einv_provider: 'generic', einv_env: 'sandbox', einv_base_url: '', einv_client_id: '', einv_client_secret: '',
      einv_username: '', einv_password: '', einv_gstin: '', einv_auth_path: '/auth', einv_irn_path: '/einvoice/generate', einv_auto: '0',
      onboarding_done: '0',
    };
    for (const [k, v] of Object.entries(S)) set.run(k, v);

    const dz = db.prepare('INSERT INTO designs(code,title,category,weight,image) VALUES(?,?,?,?,?)');
    [['R-204', 'Solitaire Band', 'Ring', 6.2], ['C-118', 'Rope Chain', 'Chain', 22], ['B-77', 'Temple Bangle', 'Bangle', 30], ['N-301', 'Bridal Necklace', 'Necklace', 80]].forEach((r, i) => { const id = Number(dz.run(r[0], r[1], r[2], r[3], '').lastInsertRowid); db.prepare('INSERT INTO design_access VALUES(?,?)').run(id, P[0]); if (i % 2 === 0) db.prepare('INSERT INTO design_access VALUES(?,?)').run(id, P[1]); });
  });
  run();
}

export function setting(key: string, def = ''): string {
  const r = getDb().prepare('SELECT value FROM settings WHERE key=?').get(key) as { value: string } | undefined;
  return r ? r.value : def;
}
export function settings(): Record<string, string> {
  const rows = getDb().prepare('SELECT key,value FROM settings').all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
export function setSetting(key: string, value: string) {
  getDb().prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value);
}
export const todayStr = today;
