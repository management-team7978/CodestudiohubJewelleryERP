'use server';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { audit, guard } from '@/lib/auth';
import { fineOf, grossForFine, lossOf, meltingPlan, r3 } from '@/lib/gold';
import { bad, dateOr, goldBalance, int, nextNo, num, ok, postGold, Res, str } from './util';

/* ---------------- Orders ---------------- */
export async function createOrder(_: Res | null, f: FormData): Promise<Res> {
  const s = await guard('orders', 'add'); const db = getDb();
  const party = int(f, 'party_id'), jt = int(f, 'jewel_type_id'); if (!party || !jt) return bad('Choose the customer and the jewel type.');
  const p = db.prepare('SELECT type FROM parties WHERE id=?').get(party) as any;
  const no = 'ORD-' + (1001 + (db.prepare('SELECT COUNT(*) c FROM orders').get() as any).c);
  const flowRow = db.prepare('SELECT flow FROM jewel_types WHERE id=?').get(jt) as any; const flow: number[] = JSON.parse(flowRow.flow);
  const custom = str(f, 'custom_flow').split(',').filter(Boolean).map(Number); const use = custom.length ? custom : flow;
  if (!use.length) return bad('This jewel has no department flow yet. Set it in Jewel Master.');
  const gRecv = num(f, 'gold_gross'), gTouch = num(f, 'gold_touch') || 100;
  db.transaction(() => {
    const oid = Number(db.prepare('INSERT INTO orders(no,party_id,kind,jewel_type_id,design,purity,weight,size,qty,due_date,status,remarks,gold_received) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(no, party, p?.type === 'B2C' ? 'B2C' : 'B2B', jt, str(f, 'design'), str(f, 'purity') || '22K', num(f, 'weight'), str(f, 'size'), int(f, 'qty') || 1, str(f, 'due_date'), 'New', str(f, 'remarks'), gRecv).lastInsertRowid);
    use.forEach((d, i) => db.prepare('INSERT INTO order_stages(order_id,seq,dept_id,status) VALUES(?,?,?,?)').run(oid, i, d, 'Pending'));
    if (gRecv > 0) {
      const fine = fineOf(gRecv, gTouch);
      postGold({ date: dateOr(f, 'date'), acct_type: 'party', acct_id: party, dir: 'IN', gross: gRecv, touch: gTouch, fine, ref_type: 'receipt', order_id: oid, narration: `Gold received with order ${no}`, by: s.uid });
      postGold({ date: dateOr(f, 'date'), acct_type: 'store', acct_id: 0, dir: 'IN', gross: gRecv, touch: gTouch, fine, ref_type: 'receipt', order_id: oid, narration: `From party – ${no}`, by: s.uid });
    }
    audit(s, 'orders', 'create', no);
  })();
  revalidatePath('/orders'); return ok(`Order ${no} created.`);
}

export async function advanceOrder(_: Res | null, f: FormData): Promise<Res> {
  const s = await guard('orders', 'edit'); const db = getDb(); const id = int(f, 'order_id');
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(id) as any; if (!o) return bad('Order not found.');
  const stages = db.prepare('SELECT * FROM order_stages WHERE order_id=? ORDER BY seq').all(id) as any[];
  const cur = stages.find((x) => x.status === 'Active') || stages.find((x) => x.status === 'Pending');
  if (!cur) return bad('All departments are already complete.');
  const kar = int(f, 'karigar_id') || null; const wout = num(f, 'weight_out'); const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  db.transaction(() => {
    if (cur.status === 'Pending') { db.prepare("UPDATE order_stages SET status='Active', karigar_id=?, weight_in=?, started_at=? WHERE id=?").run(kar, num(f, 'weight_in') || o.weight, now, cur.id); if (o.status === 'New') db.prepare("UPDATE orders SET status='In Process' WHERE id=?").run(id); }
    else {
      db.prepare("UPDATE order_stages SET status='Done', weight_out=?, finished_at=?, karigar_id=COALESCE(?,karigar_id) WHERE id=?").run(wout || cur.weight_in, now, kar, cur.id);
      const next = stages.find((x) => x.seq > cur.seq);
      if (next) db.prepare("UPDATE order_stages SET status='Active', weight_in=?, started_at=? WHERE id=?").run(wout || cur.weight_in, now, next.id);
      else db.prepare("UPDATE orders SET status='Ready' WHERE id=?").run(id);
      db.prepare('UPDATE orders SET current_stage=? WHERE id=?').run(Math.min(cur.seq + 1, stages.length - 1), id);
    }
  })();
  audit(s, 'orders', 'advance', o.no); revalidatePath('/orders', 'layout'); return ok(cur.status === 'Pending' ? 'Department started.' : 'Moved to the next department.');
}
export async function setOrderStatus(f: FormData) {
  const s = await guard('orders', 'edit'); getDb().prepare('UPDATE orders SET status=? WHERE id=?').run(str(f, 'status'), int(f, 'id')); audit(s, 'orders', 'status', str(f, 'status')); revalidatePath('/orders', 'layout');
}

/* ---------------- Metal transfer (sender gives, receiver confirms) ---------------- */
export async function createTransfer(_: Res | null, f: FormData): Promise<Res> {
  const s = await guard('transfers', 'add'); const [ft, fi] = str(f, 'from').split(':'), [tt, ti] = str(f, 'to').split(':');
  const gross = num(f, 'gross'), touch = num(f, 'touch') || 100;
  if (!ft || !tt || (ft === tt && fi === ti)) return bad('Choose two different places.'); if (gross <= 0) return bad('Enter the weight.');
  const bal = goldBalance(ft, Number(fi));
  if (ft !== 'party' && r3(bal.gross) < r3(gross)) return bad(`Not enough gold with the sender — balance is ${bal.gross.toFixed(3)} g.`);
  const fine = fineOf(gross, touch); const d = dateOr(f, 'date'); const order = int(f, 'order_id') || null;
  getDb().transaction(() => {
    const id = Number(getDb().prepare('INSERT INTO transfers(date,from_type,from_id,to_type,to_id,gross,touch,fine,order_id,status,by_user,note) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(d, ft, Number(fi), tt, Number(ti), gross, touch, fine, order, 'Pending', s.uid, str(f, 'note')).lastInsertRowid);
    postGold({ date: d, acct_type: ft, acct_id: Number(fi), dir: 'OUT', gross, touch, fine, ref_type: 'transfer', ref_id: id, order_id: order ?? undefined, narration: 'Sent – ' + str(f, 'note'), by: s.uid });
  })();
  audit(s, 'transfers', 'create', `${ft}:${fi}→${tt}:${ti} ${gross}g @${touch}`); revalidatePath('/transfers', 'layout'); return ok('Sent. The receiver must confirm to complete the transfer.');
}
export async function confirmTransfer(f: FormData) {
  const s = await guard('transfers', 'edit'); const db = getDb(); const t = db.prepare("SELECT * FROM transfers WHERE id=? AND status='Pending'").get(int(f, 'id')) as any; if (!t) return;
  db.transaction(() => {
    db.prepare("UPDATE transfers SET status='Received', confirmed_by=? WHERE id=?").run(s.uid, t.id);
    postGold({ date: new Date().toISOString().slice(0, 10), acct_type: t.to_type, acct_id: t.to_id, dir: 'IN', gross: t.gross, touch: t.touch, fine: t.fine, ref_type: 'transfer', ref_id: t.id, order_id: t.order_id ?? undefined, narration: 'Received & confirmed', by: s.uid });
  })(); audit(s, 'transfers', 'confirm', String(t.id)); revalidatePath('/transfers', 'layout');
}

/* ---------------- Loss booking ---------------- */
export async function bookLoss(_: Res | null, f: FormData): Promise<Res> {
  const s = await guard('loss', 'add'); const db = getDb(); const way = str(f, 'way') === 'SHIFT_END' ? 'SHIFT_END' : 'WEIGHING';
  const kar = int(f, 'karigar_id'); const dept = int(f, 'dept_id'); if (!kar) return bad('Choose the karigar.');
  const touch = num(f, 'touch') || 100; const bal = goldBalance('karigar', kar);
  const given = num(f, 'weight_given') || r3(bal.gross); const recv = num(f, 'weight_received'); const rec = num(f, 'recovered');
  if (given <= 0) return bad('Weight given is zero — nothing to weigh.'); if (recv < 0 || recv > given) return bad('Weight received cannot be more than weight given.');
  const L = lossOf(given, recv, touch, rec); const d = dateOr(f, 'date'); const order = int(f, 'order_id') || null;
  db.transaction(() => {
    const id = Number(db.prepare('INSERT INTO loss_entries(date,way,dept_id,karigar_id,order_id,jewel_type_id,weight_given,weight_received,touch,loss_gross,loss_fine,recovered,note,by_user) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(d, way, dept || null, kar, order, int(f, 'jewel_type_id') || null, given, recv, touch, L.lossGross, L.lossFine, rec, str(f, 'note'), s.uid).lastInsertRowid);
    if (way === 'SHIFT_END') {
      postGold({ date: d, acct_type: 'karigar', acct_id: kar, dir: 'OUT', gross: recv, touch, fine: fineOf(recv, touch), ref_type: 'shift-close', ref_id: id, order_id: order ?? undefined, narration: 'Returned to locker at shift end', by: s.uid });
      postGold({ date: d, acct_type: 'store', acct_id: 0, dir: 'IN', gross: recv, touch, fine: fineOf(recv, touch), ref_type: 'shift-close', ref_id: id, order_id: order ?? undefined, narration: 'Locker – shift end', by: s.uid });
    }
    if (L.lossGross > 0) postGold({ date: d, acct_type: 'karigar', acct_id: kar, dir: 'OUT', gross: L.lossGross, touch, fine: L.lossFine, ref_type: 'loss', ref_id: id, order_id: order ?? undefined, narration: `Loss booked (${way === 'SHIFT_END' ? 'shift end' : 'weighing'})`, by: s.uid });
    if (rec > 0) postGold({ date: d, acct_type: 'store', acct_id: 0, dir: 'IN', gross: rec, touch, fine: fineOf(rec, touch), ref_type: 'dust', ref_id: id, narration: 'Dust / scrap recovered', by: s.uid });
  })();
  audit(s, 'loss', 'book', `${given}→${recv} loss ${L.lossGross}g`); revalidatePath('/loss', 'layout'); revalidatePath('/');
  return ok(`Loss booked: ${L.lossGross.toFixed(3)} g gross · ${L.lossFine.toFixed(3)} g fine · ${L.lossPct}%`);
}

/* ---------------- Inventory ---------------- */
export async function saveItem(_: Res | null, f: FormData): Promise<Res> {
  const s = await guard('inventory', 'add'); const name = str(f, 'name'); if (!name) return bad('Item name is required.');
  try { getDb().prepare('INSERT INTO items(name,unit,category,min_stock,hsn) VALUES(?,?,?,?,?)').run(name, str(f, 'unit') || 'gram', str(f, 'category') || 'Other', num(f, 'min_stock'), str(f, 'hsn') || '7113'); } catch { return bad('Item already exists.'); }
  audit(s, 'inventory', 'item-create', name); revalidatePath('/inventory'); return ok('Item added.');
}
export async function stockEntry(_: Res | null, f: FormData): Promise<Res> {
  const s = await guard('inventory', 'add'); const qty = num(f, 'qty'); const kind = str(f, 'kind'); const item = int(f, 'item_id');
  if (!item || qty === 0) return bad('Choose an item and enter a quantity.');
  getDb().prepare('INSERT INTO stock_txn(date,item_id,kind,qty,dept_id,note) VALUES(?,?,?,?,?,?)').run(dateOr(f, 'date'), item, kind, qty, int(f, 'dept_id') || null, str(f, 'note'));
  audit(s, 'inventory', 'stock-' + kind, `${item}:${qty}`); revalidatePath('/inventory'); return ok('Stock updated.');
}

/* ---------------- Gold: touch → fine receipts, returns, purchases ---------------- */
export async function goldReceive(_: Res | null, f: FormData): Promise<Res> {
  const s = await guard('gold', 'add'); const party = int(f, 'party_id'), gross = num(f, 'gross'), touch = num(f, 'touch');
  if (!party) return bad('Choose who gave the gold.'); if (gross <= 0) return bad('Enter the weight.'); if (touch <= 0 || touch > 100) return bad('Touch must be between 1 and 100 (e.g. 75 for 75 touch).');
  const fine = fineOf(gross, touch); const d = dateOr(f, 'date');
  getDb().transaction(() => {
    postGold({ date: d, acct_type: 'party', acct_id: party, dir: 'IN', gross, touch, fine, ref_type: 'receipt', narration: str(f, 'note') || `${touch} touch gold received`, by: s.uid });
    postGold({ date: d, acct_type: 'store', acct_id: 0, dir: 'IN', gross, touch, fine, ref_type: 'receipt', narration: 'Received from party', by: s.uid });
  })();
  audit(s, 'gold', 'receive', `${gross}g @${touch} = ${fine}g fine`); revalidatePath('/gold', 'layout'); revalidatePath('/ledger');
  return ok(`Recorded: ${gross.toFixed(3)} g at ${touch} touch = ${fine.toFixed(3)} g FINE credited to the party.`);
}
export async function goldReturn(_: Res | null, f: FormData): Promise<Res> {
  const s = await guard('gold', 'add'); const party = int(f, 'party_id'); const touch = num(f, 'touch') || 100; let fine = num(f, 'fine'), gross = num(f, 'gross');
  if (!party) return bad('Choose the party.'); if (fine <= 0 && gross <= 0) return bad('Enter the fine weight to give back (or the gross weight).');
  if (fine > 0) gross = grossForFine(fine, touch); else fine = fineOf(gross, touch);
  const bal = goldBalance('party', party); const d = dateOr(f, 'date');
  getDb().transaction(() => {
    postGold({ date: d, acct_type: 'party', acct_id: party, dir: 'OUT', gross, touch, fine, ref_type: 'return', narration: str(f, 'note') || 'Fine given back', by: s.uid });
    postGold({ date: d, acct_type: 'store', acct_id: 0, dir: 'OUT', gross, touch, fine, ref_type: 'return', narration: 'Given to party', by: s.uid });
  })();
  audit(s, 'gold', 'return', `${fine}g fine @${touch}`); revalidatePath('/gold', 'layout'); revalidatePath('/ledger');
  return ok(`Gave back ${fine.toFixed(3)} g fine (${gross.toFixed(3)} g at ${touch} touch). Party fine balance was ${bal.fine.toFixed(3)} g.`);
}
export async function goldPurchase(_: Res | null, f: FormData): Promise<Res> {
  const s = await guard('gold', 'add'); const party = int(f, 'party_id'), gross = num(f, 'gross'), touch = num(f, 'touch') || 99.9; if (gross <= 0) return bad('Enter the weight.');
  const fine = fineOf(gross, touch); const d = dateOr(f, 'date');
  postGold({ date: d, acct_type: 'store', acct_id: 0, dir: 'IN', gross, touch, fine, ref_type: 'purchase', narration: 'Purchase ' + str(f, 'note'), by: s.uid });
  if (party && num(f, 'amount')) getDb().prepare('INSERT INTO cash_ledger(date,party_id,credit,ref_type,narration) VALUES(?,?,?,?,?)').run(d, party, num(f, 'amount'), 'purchase', 'Gold purchase');
  audit(s, 'gold', 'purchase', `${gross}g`); revalidatePath('/gold', 'layout'); return ok(`Added ${fine.toFixed(3)} g fine to store stock.`);
}

/* ---------------- Melting: many touches → one target touch ---------------- */
export async function saveMelting(_: Res | null, f: FormData): Promise<Res> {
  const s = await guard('melting', 'add'); const db = getDb();
  let rows: { party_id?: number; gross: number; touch: number }[] = [];
  try { rows = JSON.parse(str(f, 'rows')); } catch { /* ignore */ }
  rows = rows.filter((r) => r.gross > 0 && r.touch > 0);
  if (!rows.length) return bad('Add at least one lot (weight + touch).');
  const target = num(f, 'target_touch') || 91.6; const plan = meltingPlan(rows, target);
  const outG = num(f, 'output_gross'), outT = num(f, 'output_touch') || target;
  if (outG <= 0) return bad('Enter the weight you actually got after melting.');
  const outF = fineOf(outG, outT);
  const addedFine = plan.fineGoldToAdd > 0 ? fineOf(num(f, 'fine_added') || plan.fineGoldToAdd, plan.pureTouch) : 0;
  const lossF = r3(plan.totalFine + addedFine - outF);
  const d = dateOr(f, 'date'); const no = 'MLT-' + String((db.prepare('SELECT COUNT(*) c FROM melting_batches').get() as any).c + 1).padStart(3, '0');
  db.transaction(() => {
    const id = Number(db.prepare('INSERT INTO melting_batches(no,date,karigar_id,target_touch,input_gross,input_fine,alloy_added,output_gross,output_touch,output_fine,loss_fine,note) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(no, d, int(f, 'karigar_id') || null, target, plan.totalGross, plan.totalFine, num(f, 'alloy_added') || plan.alloyToAdd, outG, outT, outF, lossF, str(f, 'note')).lastInsertRowid);
    for (const r of rows) db.prepare('INSERT INTO melting_inputs(batch_id,party_id,gross,touch,fine) VALUES(?,?,?,?,?)').run(id, r.party_id || null, r.gross, r.touch, fineOf(r.gross, r.touch));
    postGold({ date: d, acct_type: 'store', acct_id: 0, dir: 'OUT', gross: plan.totalGross, touch: plan.avgTouch, fine: plan.totalFine, ref_type: 'melting', ref_id: id, narration: `${no} – lots melted`, by: s.uid });
    postGold({ date: d, acct_type: 'store', acct_id: 0, dir: 'IN', gross: outG, touch: outT, fine: outF, ref_type: 'melting', ref_id: id, narration: `${no} – melted bar`, by: s.uid });
  })();
  audit(s, 'melting', 'create', no); revalidatePath('/melting'); revalidatePath('/gold', 'layout');
  return ok(`${no} saved. Output ${outG.toFixed(3)} g @ ${outT} = ${outF.toFixed(3)} g fine. Melting loss: ${lossF.toFixed(3)} g fine.`);
}
