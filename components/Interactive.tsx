'use client';
import { useMemo, useState } from 'react';
import { ActionForm, Field } from './Form';
import { fineOf, grossForFine, meltingPlan, PURITY, g3, inr, gstSplit, r2 } from '@/lib/gold';
import { Plus, Trash2, ArrowUp, ArrowDown, X } from 'lucide-react';

/* ---- Live "weight × touch = fine" helper used on Gold Desk ---- */
export function TouchForm({ action, parties, mode }: { action: any; parties: { id: number; name: string }[]; mode: 'receive' | 'return' | 'purchase' }) {
  const [gross, setGross] = useState(''); const [touch, setTouch] = useState(mode === 'purchase' ? '99.9' : ''); const [fineIn, setFineIn] = useState('');
  const g = parseFloat(gross) || 0, t = parseFloat(touch) || 0, fi = parseFloat(fineIn) || 0;
  const wrapped = async (prev: any, f: FormData) => { const r = await action(prev, f); if (r.ok) { setGross(''); setFineIn(''); if (mode !== 'purchase') setTouch(''); } return r; };
  const fine = mode === 'return' && fi ? fi : fineOf(g, t); const gr = mode === 'return' && fi ? grossForFine(fi, t || 100) : g;
  return (
    <ActionForm action={wrapped} submit={mode === 'receive' ? 'Record gold received' : mode === 'return' ? 'Give back fine' : 'Add to stock'} tone={mode === 'return' ? 'green' : 'primary'}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={mode === 'purchase' ? 'Supplier (optional)' : 'Party'}><select name="party_id" className="input" required={mode !== 'purchase'}><option value="">Select…</option>{parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Date"><input type="date" name="date" className="input" /></Field>
        {mode !== 'return' && <Field label="Gross weight (g)"><input name="gross" type="number" step="0.001" className="input num" value={gross} onChange={(e) => setGross(e.target.value)} placeholder="0.000" /></Field>}
        {mode === 'return' && <Field label="Fine to give (g)" hint="Type the FINE you owe — we work out the gross."><input name="fine" type="number" step="0.001" className="input num" value={fineIn} onChange={(e) => setFineIn(e.target.value)} placeholder="0.000" /></Field>}
        <Field label="Touch (purity %)" hint="e.g. 75, 91.6, 99.5"><input name="touch" type="number" step="0.01" max="100" className="input num" value={touch} onChange={(e) => setTouch(e.target.value)} placeholder="75" required /></Field>
        {mode === 'purchase' && <Field label="Amount paid (₹)"><input name="amount" type="number" step="0.01" className="input num" /></Field>}
        <Field label="Note" className={mode === 'purchase' ? '' : 'sm:col-span-2'}><input name="note" className="input" placeholder="Old ornaments / bar / …" /></Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">{[75, 91.6, 99.5, 99.9].map((p) => <button type="button" key={p} onClick={() => setTouch(String(p))} className="chip bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700">{p}</button>)}<span className="text-xs text-slate-400">quick touch</span></div>
      <div className="mt-3 grid grid-cols-3 gap-3 rounded-2xl bg-gradient-to-r from-amber-50 to-brand-50 p-4 text-center">
        <div><p className="text-[11px] font-bold uppercase text-slate-500">Gross</p><p className="num text-lg font-extrabold">{g3(gr)} g</p></div>
        <div><p className="text-[11px] font-bold uppercase text-slate-500">Touch</p><p className="num text-lg font-extrabold">{t || 0}%</p></div>
        <div><p className="text-[11px] font-bold uppercase text-amber-600">Fine gold</p><p className="num text-lg font-extrabold text-amber-700">{g3(fine)} g</p></div>
      </div>
    </ActionForm>
  );
}

/* ---- Melting: many lots with different touches → target touch ---- */
type Row = { party_id: string; gross: string; touch: string };
export function MeltingForm({ action, parties, karigars }: { action: any; parties: { id: number; name: string }[]; karigars: { id: number; name: string }[] }) {
  const [rows, setRows] = useState<Row[]>([{ party_id: '', gross: '200', touch: '75' }, { party_id: '', gross: '100', touch: '91.6' }]);
  const [target, setTarget] = useState('91.6'); const [og, setOg] = useState(''); const [ot, setOt] = useState('');
  const nums = rows.map((r) => ({ gross: parseFloat(r.gross) || 0, touch: parseFloat(r.touch) || 0 }));
  const plan = useMemo(() => meltingPlan(nums, parseFloat(target) || 0), [rows, target]); // eslint-disable-line
  const actualFine = fineOf(parseFloat(og) || 0, parseFloat(ot || target) || 0);
  const addedFine = plan.fineGoldToAdd * (plan.pureTouch / 100);
  const loss = og ? plan.totalFine + addedFine - actualFine : 0;
  const upd = (i: number, k: keyof Row, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <ActionForm action={action} submit="Save melting record" resetOnOk={false} tone="green">
      <input type="hidden" name="rows" value={JSON.stringify(rows.map((r) => ({ party_id: Number(r.party_id) || 0, gross: parseFloat(r.gross) || 0, touch: parseFloat(r.touch) || 0 })))} />
      <input type="hidden" name="alloy_added" value={plan.alloyToAdd} /><input type="hidden" name="fine_added" value={plan.fineGoldToAdd} />
      <p className="label">1 · Lots going into the furnace</p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_110px_90px_36px] gap-2">
            <select className="input" value={r.party_id} onChange={(e) => upd(i, 'party_id', e.target.value)}><option value="">Own / mixed</option>{parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <input className="input num" type="number" step="0.001" placeholder="Gross g" value={r.gross} onChange={(e) => upd(i, 'gross', e.target.value)} />
            <input className="input num" type="number" step="0.01" placeholder="Touch" value={r.touch} onChange={(e) => upd(i, 'touch', e.target.value)} />
            <button type="button" className="btn-danger !px-2" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <button type="button" className="btn-ghost mt-2" onClick={() => setRows([...rows, { party_id: '', gross: '', touch: '' }])}><Plus className="h-4 w-4" />Add lot</button>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Field label="2 · Target touch"><input name="target_touch" type="number" step="0.01" className="input num" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
        <Field label="Melted by"><select name="karigar_id" className="input"><option value="">—</option>{karigars.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></Field>
        <Field label="Date"><input type="date" name="date" className="input" /></Field>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-gradient-to-r from-brand-50 to-leaf-50 p-4 sm:grid-cols-4">
        <div><p className="text-[11px] font-bold uppercase text-slate-500">Total gross</p><p className="num text-lg font-extrabold">{g3(plan.totalGross)} g</p></div>
        <div><p className="text-[11px] font-bold uppercase text-slate-500">Total fine</p><p className="num text-lg font-extrabold text-amber-700">{g3(plan.totalFine)} g</p></div>
        <div><p className="text-[11px] font-bold uppercase text-slate-500">Average touch</p><p className="num text-lg font-extrabold">{plan.avgTouch}%</p></div>
        <div><p className="text-[11px] font-bold uppercase text-slate-500">Expected bar</p><p className="num text-lg font-extrabold">{g3(plan.outputGross)} g</p></div>
        <p className="col-span-full rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700">
          {plan.alloyToAdd > 0 && <>➕ Add <b className="text-brand-700">{g3(plan.alloyToAdd)} g alloy</b> to bring {plan.avgTouch}% down to {target}%.</>}
          {plan.fineGoldToAdd > 0 && <>➕ Add <b className="text-brand-700">{g3(plan.fineGoldToAdd)} g pure gold (99.9)</b> to raise {plan.avgTouch}% up to {target}%.</>}
          {plan.alloyToAdd === 0 && plan.fineGoldToAdd === 0 && <>Average touch already matches the target.</>}
        </p>
      </div>
      <p className="label mt-5">3 · What you actually got after melting</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Output weight (g)"><input name="output_gross" type="number" step="0.001" className="input num" value={og} onChange={(e) => setOg(e.target.value)} required /></Field>
        <Field label="Output touch (assay)"><input name="output_touch" type="number" step="0.01" className="input num" value={ot} placeholder={target} onChange={(e) => setOt(e.target.value)} /></Field>
        <Field label="Note"><input name="note" className="input" /></Field>
      </div>
      {og && <p className={`mt-3 rounded-xl px-3 py-2 text-sm font-bold ${loss > 0.001 ? 'bg-rose-50 text-rose-700' : 'bg-leaf-50 text-leaf-700'}`}>Output fine {g3(actualFine)} g → melting loss {g3(loss)} g fine</p>}
    </ActionForm>
  );
}

/* ---- Jewel department flow picker ---- */
export function FlowPicker({ depts, action, initial, name = '', id = 0 }: { depts: { id: number; name: string }[]; action: any; initial: number[]; name?: string; id?: number }) {
  const [flow, setFlow] = useState<number[]>(initial);
  const move = (i: number, d: number) => { const n = [...flow]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; setFlow(n); };
  const nm = (x: number) => depts.find((d) => d.id === x)?.name || '?';
  return (
    <ActionForm action={action} submit={id ? 'Update flow' : 'Save jewel & flow'}>
      <input type="hidden" name="flow" value={flow.join(',')} /><input type="hidden" name="id" value={id} />
      <Field label="Jewel name"><input name="name" className="input" defaultValue={name} placeholder="e.g. Mangalsutra" required /></Field>
      <p className="label mt-4">Tap departments to add (order matters)</p>
      <div className="flex flex-wrap gap-2">{depts.filter((d) => !flow.includes(d.id)).map((d) => <button type="button" key={d.id} onClick={() => setFlow([...flow, d.id])} className="chip bg-slate-100 !px-3 !py-1.5 text-slate-700 hover:bg-brand-50 hover:text-brand-700">+ {d.name}</button>)}</div>
      <p className="label mt-4">Flow</p>
      <ol className="space-y-1.5">{flow.map((d, i) => (
        <li key={d} className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800"><span className="grid h-5 w-5 place-items-center rounded-full bg-brand-500 text-[11px] text-white">{i + 1}</span>{nm(d)}
          <span className="ml-auto flex gap-1"><button type="button" onClick={() => move(i, -1)} aria-label="Up"><ArrowUp className="h-4 w-4" /></button><button type="button" onClick={() => move(i, 1)} aria-label="Down"><ArrowDown className="h-4 w-4" /></button><button type="button" onClick={() => setFlow(flow.filter((x) => x !== d))} aria-label="Remove"><X className="h-4 w-4 text-rose-500" /></button></span></li>))}
        {!flow.length && <li className="text-sm text-slate-400">No departments yet.</li>}</ol>
    </ActionForm>
  );
}

/* ---- Invoice composer for the three bill kinds ---- */
type Line = { description: string; hsn: string; qty: string; gross: string; touch: string; rate: string; amount: string; gst_rate: string };
const blank = (gst = '3'): Line => ({ description: '', hsn: '7113', qty: '', gross: '', touch: '91.6', rate: '', amount: '', gst_rate: gst });
export function InvoiceForm({ action, parties, orders, defaults }: { action: any; parties: { id: number; name: string; state_code: string; gstin: string | null }[]; orders: { id: number; no: string }[]; defaults: { rate: number; gst: string; company_state: string } }) {
  const [type, setType] = useState<'GST' | 'GOLD' | 'CASH'>('GST'); const [lines, setLines] = useState<Line[]>([blank(defaults.gst)]); const [party, setParty] = useState(''); const [rate, setRate] = useState(String(defaults.rate || ''));
  const wrapped = async (prev: any, f: FormData) => { const r = await action(prev, f); if (r.ok) setLines([blank(defaults.gst)]); return r; };
  const p = parties.find((x) => String(x.id) === party); const intra = !p || p.state_code === defaults.company_state;
  const upd = (i: number, k: keyof Line, v: string) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const calc = lines.map((l) => { const gross = +l.gross || 0, touch = +l.touch || 0; if (type === 'GOLD') return { amt: +l.amount || 0, fine: fineOf(gross, touch), gross, tax: 0, t: { cgst: 0, sgst: 0, igst: 0 } }; const amt = l.amount ? +l.amount : (+l.qty || 0) * (+l.rate || 0); const t = type === 'GST' ? gstSplit(amt, +l.gst_rate || 0, intra) : { cgst: 0, sgst: 0, igst: 0 }; return { amt, fine: 0, gross: 0, tax: t.cgst + t.sgst + t.igst, t }; });
  const sub = r2(calc.reduce((s, c) => s + c.amt, 0)), tax = r2(calc.reduce((s, c) => s + c.tax, 0)), fine = calc.reduce((s, c) => s + c.fine, 0), gross = calc.reduce((s, c) => s + c.gross, 0);
  const cg = r2(calc.reduce((s, c) => s + c.t.cgst, 0)), sg = r2(calc.reduce((s, c) => s + c.t.sgst, 0)), ig = r2(calc.reduce((s, c) => s + c.t.igst, 0));
  const kinds = [['GST', 'GST Invoice', 'Tax invoice with CGST/SGST/IGST. Can go to the e-Invoice portal.'], ['GOLD', 'Gold Bill', 'Jewellery billed in fine gold + labour in cash.'], ['CASH', 'Cash Bill', 'Simple bill without GST.']] as const;
  return (
    <ActionForm action={wrapped} submit="Create bill" resetOnOk={false}>
      <input type="hidden" name="type" value={type} /><input type="hidden" name="lines" value={JSON.stringify(lines.map((l) => ({ description: l.description, hsn: l.hsn, qty: +l.qty || 0, gross: +l.gross || 0, touch: +l.touch || 100, rate: +l.rate || 0, amount: +l.amount || 0, gst_rate: +l.gst_rate || 0 })))} />
      <div className="grid gap-3 sm:grid-cols-3">{kinds.map(([k, t, d]) => (<button type="button" key={k} onClick={() => setType(k)} className={`rounded-2xl border-2 p-4 text-left transition ${type === k ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-brand-200'}`}><p className="font-bold text-ink-800">{t}</p><p className="mt-0.5 text-xs text-slate-500">{d}</p></button>))}</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Field label="Customer" className="sm:col-span-2"><select name="party_id" className="input" value={party} onChange={(e) => setParty(e.target.value)} required><option value="">Select…</option>{parties.map((x) => <option key={x.id} value={x.id}>{x.name}{x.gstin ? ` · ${x.gstin}` : ''}</option>)}</select></Field>
        <Field label="Date"><input type="date" name="date" className="input" /></Field>
        <Field label="Order (optional)"><select name="order_id" className="input"><option value="">—</option>{orders.map((o) => <option key={o.id} value={o.id}>{o.no}</option>)}</select></Field>
        {type === 'GST' && <Field label="Place of supply (state code)" hint={intra ? 'Same state → CGST + SGST' : 'Other state → IGST'}><input name="place_of_supply" className="input" defaultValue={p?.state_code || defaults.company_state} key={p?.id} /></Field>}
        {type === 'GOLD' && <Field label="Gold rate ₹/g (for value)"><input name="gold_rate" type="number" className="input num" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>}
        <Field label="Other charges (₹)"><input name="other_charges" type="number" step="0.01" className="input num" defaultValue={0} /></Field>
      </div>
      <p className="label mt-5">Items</p>
      <div className="space-y-2">{lines.map((l, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3 md:grid-cols-12">
          <input className="input md:col-span-4" placeholder="Description (e.g. 22K Chain)" value={l.description} onChange={(e) => upd(i, 'description', e.target.value)} />
          {type === 'GOLD' ? (<>
            <input className="input num md:col-span-2" type="number" step="0.001" placeholder="Gross g" value={l.gross} onChange={(e) => upd(i, 'gross', e.target.value)} />
            <input className="input num md:col-span-2" type="number" step="0.01" placeholder="Touch" value={l.touch} onChange={(e) => upd(i, 'touch', e.target.value)} />
            <input className="input num md:col-span-3" type="number" step="0.01" placeholder="Labour ₹" value={l.amount} onChange={(e) => upd(i, 'amount', e.target.value)} />
          </>) : (<>
            {type === 'GST' && <input className="input md:col-span-1" placeholder="HSN" value={l.hsn} onChange={(e) => upd(i, 'hsn', e.target.value)} />}
            <input className="input num md:col-span-2" type="number" step="0.001" placeholder="Qty / g" value={l.qty} onChange={(e) => upd(i, 'qty', e.target.value)} />
            <input className="input num md:col-span-2" type="number" step="0.01" placeholder="Rate ₹" value={l.rate} onChange={(e) => upd(i, 'rate', e.target.value)} />
            {type === 'GST' && <input className="input num md:col-span-1" type="number" step="0.01" placeholder="GST%" value={l.gst_rate} onChange={(e) => upd(i, 'gst_rate', e.target.value)} />}
            <div className={`num flex items-center justify-end px-2 text-sm font-bold ${type === 'GST' ? 'md:col-span-1' : 'md:col-span-3'}`}>{inr(calc[i].amt)}</div>
          </>)}
          <button type="button" className="btn-danger md:col-span-1" onClick={() => setLines(lines.length > 1 ? lines.filter((_, j) => j !== i) : lines)} aria-label="Remove line"><Trash2 className="h-4 w-4" /></button>
        </div>))}</div>
      <button type="button" className="btn-ghost mt-2" onClick={() => setLines([...lines, blank(defaults.gst)])}><Plus className="h-4 w-4" />Add item</button>
      <div className="mt-4 ml-auto max-w-sm space-y-1 rounded-2xl bg-gradient-to-br from-brand-50 to-leaf-50 p-4 text-sm">
        {type === 'GOLD' ? (<>
          <Row l="Gross gold" v={g3(gross) + ' g'} /><Row l="FINE gold to settle" v={g3(fine) + ' g'} b />{+rate > 0 && <Row l="Fine value @ rate" v={inr(fine * +rate)} />}<Row l="Labour / charges (cash)" v={inr(sub)} b />
        </>) : (<>
          <Row l="Taxable" v={inr(sub)} />{type === 'GST' && (intra ? <><Row l="CGST" v={inr(cg)} /><Row l="SGST" v={inr(sg)} /></> : <Row l="IGST" v={inr(ig)} />)}<Row l="Total" v={inr(sub + tax)} b />
        </>)}
      </div>
      <Field label="Note" className="mt-3"><input name="note" className="input" placeholder="Optional" /></Field>
    </ActionForm>
  );
}
const Row = ({ l, v, b }: { l: string; v: string; b?: boolean }) => (<div className={`flex justify-between ${b ? 'border-t border-white pt-1 text-base font-extrabold text-ink-900' : 'text-slate-600'}`}><span>{l}</span><span className="num">{v}</span></div>);
