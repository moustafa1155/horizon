import { SALES_DAYS } from "../../../data/dailySales.mjs";
import { toCents, formatMoney } from "./salesHelpers.mjs";
export default function DailySalesTable({ rows, onChange, readOnly = false }) {
  const totals = rows.reduce((sum, row) => ({ card: sum.card + (toCents(row.card) || 0), cash: sum.cash + (toCents(row.cash) || 0), cost: row.cost === "" || row.cost == null ? sum.cost : (sum.cost || 0) + (toCents(row.cost) || 0) }), { card: 0, cash: 0, cost: null });
  return <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
    <table className="portal-stacked-table w-full min-w-[650px] text-left text-sm">
      <caption className="sr-only">Daily card sales, cash sales and costs in pounds</caption>
      <thead className="bg-lightPrimary dark:bg-navy-900"><tr>{["Day", "Card (£)", "Cash (£)", "Cost (£)", "Total sales"].map(label => <th key={label} scope="col" className="px-4 py-3">{label}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index} className="border-t border-gray-200 dark:border-white/10">
        <th scope="row" className="px-4 py-3 font-medium">{SALES_DAYS[index]}</th>
        {["card", "cash", "cost"].map(key => <td key={key} data-label={({card:"Card (£)", cash:"Cash (£)", cost:"Cost (£)"})[key]} className="px-4 py-2">{readOnly ? (row[key] === "" ? "—" : formatMoney(toCents(row[key]) || 0)) : <input aria-label={SALES_DAYS[index] + " " + (key === "cost" ? " cost" : " " + key + " sales")} type="number" min="0" max="1000000000" step="0.01" inputMode="decimal" value={row[key]} onChange={event => onChange(index, key, event.target.value)} className="w-full min-w-[100px] rounded-lg border border-gray-200 bg-lightPrimary px-3 py-2 dark:border-white/10 dark:bg-navy-900" />}</td>)}
        <td data-label="Total sales" className="px-4 py-3 font-semibold">{row.card === "" && row.cash === "" ? "—" : formatMoney((toCents(row.card) || 0) + (toCents(row.cash) || 0))}</td>
      </tr>)}</tbody>
      <tfoot className="border-t border-gray-200 bg-lightPrimary font-bold dark:border-white/10 dark:bg-navy-900"><tr><th scope="row" className="px-4 py-4">Week total</th><td data-label="Card (£)" className="px-4 py-4">{formatMoney(totals.card)}</td><td data-label="Cash (£)" className="px-4 py-4">{formatMoney(totals.cash)}</td><td data-label="Cost (£)" className="px-4 py-4">{totals.cost === null ? "—" : formatMoney(totals.cost)}</td><td data-label="Total sales" className="px-4 py-4">{formatMoney(totals.card + totals.cash)}</td></tr></tfoot>
    </table>
  </div>;
}
export function dailyRows(report) {
  return SALES_DAYS.map((_, day) => {
    const row = report?.daily?.find(item => item.day === day);
    return { day, card: row?.cardCents == null ? "" : (row.cardCents / 100).toFixed(2), cash: row?.cashCents == null ? "" : (row.cashCents / 100).toFixed(2), cost: row?.costCents == null ? "" : (row.costCents / 100).toFixed(2) };
  });
}
