// Pure gold maths — no I/O. All weights are grams, 3-decimal (milligram) precision.
export const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Fine (pure) gold in a lot: gross × touch% */
export const fineOf = (gross: number, touch: number) => r3((gross * touch) / 100);
/** Gross weight needed to hold `fine` at `touch` */
export const grossForFine = (fine: number, touch: number) => (touch > 0 ? r3((fine / touch) * 100) : 0);

export const PURITY: Record<string, number> = { '24K': 99.9, '22K': 91.6, '20K': 83.3, '18K': 75.0, '14K': 58.5, '9K': 37.5 };

export type MeltInput = { gross: number; touch: number };
export type MeltPlan = {
  totalGross: number; totalFine: number; avgTouch: number;
  targetTouch: number; outputGross: number;
  /** positive: alloy (copper etc.) to add. */
  alloyToAdd: number;
  /** positive: pure gold to add to raise touch (when average touch is below target). */
  fineGoldToAdd: number; pureTouch: number;
};

/** Mix several lots of different touch, work out what to add to reach a target touch. */
export function meltingPlan(inputs: MeltInput[], targetTouch: number, pureTouch = 99.9): MeltPlan {
  const totalGross = r3(inputs.reduce((s, i) => s + i.gross, 0));
  const totalFine = r3(inputs.reduce((s, i) => s + fineOf(i.gross, i.touch), 0));
  const avgTouch = totalGross ? r3((totalFine / totalGross) * 100) : 0;
  let alloyToAdd = 0, fineGoldToAdd = 0, outputGross = totalGross;
  if (totalGross > 0 && targetTouch > 0) {
    if (avgTouch > targetTouch) { outputGross = grossForFine(totalFine, targetTouch); alloyToAdd = r3(outputGross - totalGross); }
    else if (avgTouch < targetTouch && pureTouch > targetTouch) {
      fineGoldToAdd = r3((targetTouch * totalGross - 100 * totalFine) / (pureTouch - targetTouch));
      outputGross = r3(totalGross + fineGoldToAdd);
    }
  }
  return { totalGross, totalFine, avgTouch, targetTouch, outputGross, alloyToAdd, fineGoldToAdd, pureTouch };
}

/** Loss on a job: given − received, valued in fine gold at the job's touch. */
export function lossOf(given: number, received: number, touch: number, recovered = 0) {
  const lossGross = r3(given - received - recovered);
  return { lossGross, lossFine: fineOf(lossGross, touch), lossPct: given > 0 ? r2((lossGross / given) * 100) : 0 };
}

/** Taxes. `intra` = same state → CGST+SGST, else IGST. */
export function gstSplit(taxable: number, ratePct: number, intra: boolean) {
  const tax = r2((taxable * ratePct) / 100);
  return intra ? { cgst: r2(tax / 2), sgst: r2(tax - r2(tax / 2)), igst: 0 } : { cgst: 0, sgst: 0, igst: tax };
}

const A = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const B = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const two = (n: number): string => (n < 20 ? A[n] : B[Math.floor(n / 10)] + (n % 10 ? ' ' + A[n % 10] : ''));
const three = (n: number): string => (n >= 100 ? A[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + two(n % 100) : '') : two(n));
export function rupeesInWords(amount: number): string {
  const rupees = Math.floor(Math.abs(amount)); const paise = Math.round((Math.abs(amount) - rupees) * 100);
  if (!rupees && !paise) return 'Zero Rupees Only';
  const parts: string[] = []; let n = rupees;
  const cr = Math.floor(n / 1e7); n %= 1e7; const lk = Math.floor(n / 1e5); n %= 1e5; const th = Math.floor(n / 1e3); n %= 1e3;
  if (cr) parts.push(three(cr) + ' Crore'); if (lk) parts.push(two(lk) + ' Lakh'); if (th) parts.push(two(th) + ' Thousand'); if (n) parts.push(three(n));
  return (parts.join(' ') || 'Zero') + ' Rupees' + (paise ? ' and ' + two(paise) + ' Paise' : '') + ' Only';
}

export const inr = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const g3 = (n: number) => (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
