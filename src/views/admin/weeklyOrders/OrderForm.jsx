import WeekSelector from "components/weekSelector";
import { eligibleBranchNames } from "../../../data/branches.mjs";
import { useState } from "react";
import Card from "components/card";
import { currentWeek } from "./orderHelpers.mjs";

const field =
  "mt-2 w-full rounded-xl border border-gray-200 bg-lightPrimary p-3 text-sm text-navy-700 outline-none focus:border-brand-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-navy-900 dark:text-white";
const blankItem = () => ({ product: "", quantity: "" });

export default function OrderForm({ branchRecords, onPlace, onCancel }) {
  const [branch, setBranch] = useState("");
  const [manager, setManager] = useState("");
  const [week, setWeek] = useState(currentWeek);
  const [items, setItems] = useState([blankItem()]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const branches = eligibleBranchNames(branchRecords, week);
  function updateItem(index, key, value) {
    setItems((current) =>
      current.map((item, position) =>
        position === index ? { ...item, [key]: value } : item
      )
    );
  }
  function submit(event) {
    event.preventDefault();
    setError(onPlace({ branch, manager, week, items, notes }));
  }
  return (
    <Card extra="p-6">
      <h2 className="text-xl font-bold text-navy-700 dark:text-white">
        New weekly order
      </h2>
      <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
        Choose a branch, order week, and the products required.
      </p>
      {!branches.length && (
        <p className="mt-4 rounded-xl bg-lightPrimary p-3 text-sm text-gray-700 dark:bg-navy-900 dark:text-gray-300">
          No branches are available for this week. Add a branch or choose a week
          within a temporary branch's operating dates.
        </p>
      )}
      <form onSubmit={submit} className="mt-5 space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="order-branch" className="text-sm font-medium">
              Branch
            </label>
            <select
              id="order-branch"
              required
              disabled={!branches.length}
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              className={field}
            >
              <option value="">
                {branches.length
                  ? "Select branch"
                  : "No branches available for this week"}
              </option>
              {branches.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="order-manager" className="text-sm font-medium">
              Branch manager
            </label>
            <input
              id="order-manager"
              required
              maxLength={120}
              value={manager}
              onChange={(event) => setManager(event.target.value)}
              placeholder="Manager's name"
              className={field}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <WeekSelector
              value={week}
              onChange={setWeek}
              className={field}
              labelPrefix="Order"
            />
          </div>
        </div>
        <fieldset>
          <legend className="mb-3 text-sm font-bold">Products</legend>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="grid items-end gap-3 rounded-xl border border-gray-200 p-3 dark:border-white/10 md:grid-cols-[1fr_140px_auto]"
              >
                <div>
                  <label
                    htmlFor={`product-${index}`}
                    className="text-xs text-gray-700 dark:text-gray-300"
                  >
                    Product {index + 1}
                  </label>
                  <input
                    id={`product-${index}`}
                    required
                    maxLength={160}
                    value={item.product}
                    onChange={(event) =>
                      updateItem(index, "product", event.target.value)
                    }
                    placeholder="Product name or code"
                    className={field}
                  />
                </div>
                <div>
                  <label
                    htmlFor={`quantity-${index}`}
                    className="text-xs text-gray-700 dark:text-gray-300"
                  >
                    Quantity
                  </label>
                  <input
                    id={`quantity-${index}`}
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={item.quantity}
                    onChange={(event) =>
                      updateItem(index, "quantity", event.target.value)
                    }
                    className={field}
                  />
                </div>
                <button
                  type="button"
                  disabled={items.length === 1}
                  aria-label={`Remove product ${index + 1}`}
                  onClick={() =>
                    setItems((current) =>
                      current.filter((_, position) => position !== index)
                    )
                  }
                  className="rounded-lg px-3 py-3 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setItems((current) => [...current, blankItem()])}
            className="mt-3 text-sm font-medium text-brand-500 hover:underline dark:text-brand-200"
          >
            + Add product
          </button>
        </fieldset>
        <div>
          <label htmlFor="order-notes" className="text-sm font-medium">
            Notes (optional)
          </label>
          <textarea
            id="order-notes"
            rows={3}
            maxLength={2000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className={field}
            placeholder="Delivery instructions or other requirements"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl bg-lightPrimary px-5 py-3 text-sm font-medium dark:bg-navy-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!branches.length}
            className="rounded-xl bg-brand-500 px-5 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Place weekly order
          </button>
        </div>
      </form>
    </Card>
  );
}
