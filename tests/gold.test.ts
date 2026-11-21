import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fineOf, grossForFine, meltingPlan, lossOf, gstSplit, rupeesInWords } from '../lib/gold';

test('75 touch: 200 g → 150 g fine', () => { assert.equal(fineOf(200, 75), 150); });
test('give back 150 g fine at 91.6 touch = 163.755 g gross', () => { assert.equal(grossForFine(150, 91.6), 163.755); });
test('fine round-trips', () => { assert.equal(fineOf(grossForFine(150, 91.6), 91.6), 150); });
test('melting 200@75 + 100@91.6 → 91.6: adds alloy? avg below target → pure gold needed', () => {
  const p = meltingPlan([{ gross: 200, touch: 75 }, { gross: 100, touch: 91.6 }], 91.6);
  assert.equal(p.totalGross, 300); assert.equal(p.totalFine, 241.6); assert.equal(p.avgTouch, 80.533);
  assert.ok(p.fineGoldToAdd > 0 && p.alloyToAdd === 0);
  // adding the pure gold must hit the target touch
  const after = (p.totalFine + p.fineGoldToAdd * 0.999) / (p.totalGross + p.fineGoldToAdd) * 100;
  assert.ok(Math.abs(after - 91.6) < 0.01, 'touch after = ' + after);
});
test('melting high touch down to 91.6 adds alloy', () => {
  const p = meltingPlan([{ gross: 100, touch: 99.5 }], 91.6);
  assert.ok(p.alloyToAdd > 0 && p.fineGoldToAdd === 0);
  assert.ok(Math.abs((p.totalFine / (p.totalGross + p.alloyToAdd)) * 100 - 91.6) < 0.01);
});
test('loss with dust recovery', () => {
  const l = lossOf(50, 49.6, 91.6, 0.1); assert.equal(l.lossGross, 0.3); assert.equal(l.lossFine, 0.275);
});
test('GST intra-state splits equally, inter-state is IGST', () => {
  assert.deepEqual(gstSplit(1000, 3, true), { cgst: 15, sgst: 15, igst: 0 });
  assert.deepEqual(gstSplit(1000, 3, false), { cgst: 0, sgst: 0, igst: 30 });
});
test('amount in words (Indian system)', () => {
  assert.equal(rupeesInWords(125000.5), 'One Lakh Twenty Five Thousand Rupees and Fifty Paise Only');
});
