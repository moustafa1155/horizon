import WeekSelector from "components/weekSelector";
import { useAuth } from "../../../contexts/AuthContext";
import { useState } from "react";
import Card from "components/card";
import { FiPackage } from "react-icons/fi";
import useBranches from "../../../hooks/useBranches";
import { eligibleBranchNames } from "../../../data/branches.mjs";

import OrderForm from "./OrderForm";
import { STORAGE_KEY, loadOrders, validateOrder } from "./orderHelpers.mjs";

function initialState() {
  try {
    return { orders: loadOrders(window.localStorage), error: "" };
  } catch {
    return {
      orders: [],
      error:
        "Saved orders could not be loaded. Please check browser storage before placing another order.",
    };
  }
}

export default function WeeklyOrders() {
  const { can } = useAuth();
  const canManage = can("weekly-orders", "manage");
  const { records: branchRecords, branchError } = useBranches();
  const branches = branchRecords
    .filter((record) => !record.removed)
    .map((record) => record.name);
  const [state, setState] = useState(initialState);
  const [showForm, setShowForm] = useState(false);
  const [branch, setBranch] = useState("all");
  const [week, setWeek] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [notice, setNotice] = useState("");
  const filtered = state.orders.filter(
    (order) =>
      (branch === "all" || order.branch === branch) &&
      (!week || order.week === week)
  );
  const selected = filtered.find((order) => order.id === selectedId);
  function placeOrder(draft) {
    if (!canManage)
      return "You do not have permission to add records on this page.";
    if (state.error) return state.error;
    if (branchError) return branchError;
    const error = validateOrder(
      draft,
      eligibleBranchNames(branchRecords, draft.week),
      state.orders
    );
    if (error) return error;
    const order = {
      ...draft,
      id: crypto.randomUUID(),
      manager: draft.manager.trim(),
      notes: draft.notes.trim(),
      items: draft.items.map((item) => ({
        product: item.product.trim(),
        quantity: Number(item.quantity),
      })),
      placedAt: new Date().toISOString(),
    };
    const orders = [order, ...state.orders];
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    } catch {
      return "The order could not be saved. Check browser storage and try again.";
    }
    setState({ orders, error: "" });
    setShowForm(false);
    setSelectedId(order.id);
    setBranch("all");
    setWeek("");
    setNotice(
      "Order saved in this browser. It has not been sent to the company or a supplier."
    );
    return "";
  }
  const field =
    "rounded-xl border border-gray-200 bg-lightPrimary px-3 py-2 text-sm text-navy-700 dark:border-white/10 dark:bg-navy-900 dark:text-white";
  return (
    <div className="mt-3 space-y-5 text-navy-700 dark:text-white">
      {branchError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-300">
          {branchError}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Weekly product orders placed by branch managers.
        </p>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setShowForm(true);
              setNotice("");
            }}
            className="rounded-xl bg-brand-500 px-5 py-3 text-sm font-bold text-white hover:bg-brand-600"
          >
            New weekly order
          </button>
        )}
      </div>
      <p className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 dark:border-white/10 dark:bg-navy-800 dark:text-gray-300">
        Orders are saved on this browser only. Company-wide submission and
        manager accounts across devices are not connected yet.
      </p>
      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-300">
          {state.error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-green-100 p-4 text-sm text-green-800"
        >
          {notice}
        </p>
      )}
      {showForm && canManage && (
        <OrderForm
          branchRecords={branchRecords}
          onPlace={placeOrder}
          onCancel={() => setShowForm(false)}
        />
      )}
      <Card extra="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-bold">
            Weekly orders{" "}
            <span className="text-sm font-normal text-gray-700 dark:text-gray-300">
              ({filtered.length})
            </span>
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              Branch
              <select
                aria-label="Filter orders by branch"
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
                className={field}
              >
                <option value="all">All branches</option>
                {Array.from(
                  new Set([
                    ...branches,
                    ...state.orders.map((order) => order.branch),
                  ])
                ).map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            <WeekSelector
              value={week}
              onChange={setWeek}
              className={field}
              allowAll
              labelPrefix="Orders filter"
            />
            <button
              type="button"
              onClick={() => {
                setBranch("all");
                setWeek("");
              }}
              className="text-sm text-brand-500 hover:underline dark:text-brand-200"
            >
              Clear filters
            </button>
          </div>
        </div>
        {!filtered.length ? (
          <div className="py-14 text-center">
            <FiPackage className="mx-auto mb-4 text-4xl text-gray-600" />
            <h3 className="font-bold">
              {state.orders.length
                ? "No matching orders"
                : "No weekly orders yet"}
            </h3>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              {state.orders.length
                ? "Try another branch or order week."
                : "Branch managers' product orders will appear here once placed."}
            </p>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[600px] text-start text-sm">
              <caption className="sr-only">Weekly product orders</caption>
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-700 dark:border-white/10 dark:text-gray-300">
                  {[
                    "Branch",
                    "Week beginning",
                    "Manager",
                    "Product lines",
                    "",
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="px-2 py-3 text-start"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-gray-100 dark:border-white/10"
                  >
                    <td className="px-2 py-4 font-medium">{order.branch}</td>
                    <td className="px-2 py-4">{order.week}</td>
                    <td className="px-2 py-4">{order.manager}</td>
                    <td className="px-2 py-4">{order.items.length}</td>
                    <td className="px-2 py-4">
                      <button
                        type="button"
                        aria-label={`View ${order.branch} order for ${order.week}`}
                        aria-pressed={selectedId === order.id}
                        onClick={() => setSelectedId(order.id)}
                        className="font-medium text-brand-500 hover:underline dark:text-brand-200"
                      >
                        View order
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {selected && (
        <Card extra="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Order details</h2>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                {selected.branch} · Week beginning {selected.week} ·{" "}
                {selected.manager}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="text-sm text-brand-500 hover:underline dark:text-brand-200"
            >
              Close details
            </button>
          </div>
          <ul className="mt-5 divide-y divide-gray-200 dark:divide-white/10">
            {selected.items.map((item) => (
              <li
                key={item.product}
                className="flex justify-between gap-4 py-3 text-sm"
              >
                <span>{item.product}</span>
                <span className="font-bold">Quantity: {item.quantity}</span>
              </li>
            ))}
          </ul>
          {selected.notes && (
            <p className="mt-4 whitespace-pre-wrap text-sm">
              Notes: {selected.notes}
            </p>
          )}
          <p className="mt-4 text-xs text-gray-700 dark:text-gray-300">
            Saved locally on{" "}
            {new Date(selected.placedAt).toLocaleString("en-GB")}
          </p>
        </Card>
      )}
    </div>
  );
}
