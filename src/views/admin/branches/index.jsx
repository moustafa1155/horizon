import { useAuth } from "../../../contexts/AuthContext";
import { useState } from "react";
import Card from "components/card";
import { FiMapPin } from "react-icons/fi";
import useBranches from "../../../hooks/useBranches";
import { branchStatus, validateBranch } from "../../../data/branches.mjs";

const emptyDraft = () => ({
  name: "",
  type: "permanent",
  startDate: "",
  endDate: "",
});
const field =
  "mt-2 w-full rounded-xl border border-gray-200 bg-lightPrimary p-3 text-sm text-navy-700 outline-none focus:border-brand-500 disabled:opacity-60 dark:border-white/10 dark:bg-navy-900 dark:text-white";
const formatDate = (value) =>
  value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

export default function Branches() {
  const { can, isPreview } = useAuth();
  const canManage = can("branches", "manage");
  const { records, branchError, saveBranches } = useBranches();
  const [draft, setDraft] = useState(emptyDraft);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const activeRecords = records.filter((record) => !record.removed);
  const visible = records.filter(
    (record) =>
      (showRemoved || !record.removed) &&
      (type === "all" || record.type === type) &&
      record.name.toLowerCase().includes(query.trim().toLowerCase())
  );
  const update = (key) => (event) =>
    setDraft((current) => ({ ...current, [key]: event.target.value }));
  function openForm(record = null) {
    if (!canManage && !isPreview) return;
    setEditingId(record?.id || null);
    setDraft(record ? { ...record } : emptyDraft());
    setError("");
    setNotice("");
    setShowForm(true);
  }
  function submit(event) {
    event.preventDefault();
    if (!canManage) return;
    const validation = validateBranch(draft, records, editingId);
    if (validation) {
      setError(validation);
      return;
    }
    const record = {
      id: editingId || crypto.randomUUID(),
      name: draft.name.trim(),
      type: draft.type,
      startDate: draft.startDate,
      endDate: draft.endDate,
      removed: false,
    };
    const result = saveBranches(
      editingId
        ? records.map((branch) => (branch.id === editingId ? record : branch))
        : [...records, record]
    );
    if (result) {
      setError(result);
      return;
    }
    setShowForm(false);
    setNotice(
      editingId
        ? "Branch dates updated."
        : "Branch added and available across the company pages."
    );
  }
  function toggleRemoved(record) {
    if (!canManage) return;
    const result = saveBranches(
      records.map((branch) =>
        branch.id === record.id
          ? { ...branch, removed: !branch.removed }
          : branch
      )
    );
    setError(result);
    if (!result)
      setNotice(
        record.removed
          ? `${record.name} restored.`
          : `${record.name} removed from new entries. Historical records are retained. You can restore it using Show removed branches.`
      );
  }
  return (
    <div className="mt-3 space-y-5 text-navy-700 dark:text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Manage permanent locations and temporary branches with their operating
          dates.
        </p>
        {(canManage || isPreview) && (
          <button
            type="button"
            disabled={!!branchError}
            onClick={() => openForm()}
            className="rounded-xl bg-brand-500 px-5 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            Add branch
          </button>
        )}
      </div>
      <p className="text-xs text-gray-700 dark:text-gray-300">
        Branches are saved in this browser and shared with the other pages. Only
        users with Manage Branches permission can save changes.
      </p>
      {(branchError || error) && (
        <p
          role="alert"
          className="rounded-xl bg-red-100 p-4 text-sm text-red-800"
        >
          {branchError || error}
        </p>
      )}
      {isPreview && (
        <p className="text-sm text-brand-500">
          Preview mode: open Add branch to inspect the form. Sign in with an
          admin account to save or remove branches.
        </p>
      )}
      {!canManage && !isPreview && (
        <p className="text-sm text-gray-700">
          Your account can view branches. Ask an admin to enable Manage Branches
          permission to add or remove them.
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
      <div className="grid gap-4 md:grid-cols-3">
        {[
          [
            "Permanent branches",
            activeRecords.filter((record) => record.type === "permanent")
              .length,
          ],
          [
            "Temporary branches",
            activeRecords.filter((record) => record.type === "temporary")
              .length,
          ],
          [
            "Active now",
            activeRecords.filter((record) => branchStatus(record) === "Active")
              .length,
          ],
        ].map(([label, count]) => (
          <Card key={label} extra="p-5">
            <p className="text-sm text-gray-700 dark:text-gray-300">{label}</p>
            <p className="mt-2 text-2xl font-bold">
              {branchError ? "Unavailable" : count}
            </p>
          </Card>
        ))}
      </div>
      {showForm && (canManage || isPreview) && (
        <Card extra="p-6">
          <h2 className="text-xl font-bold">
            {editingId ? "Edit branch operating dates" : "Add branch"}
          </h2>
          <form className="mt-5 space-y-5" onSubmit={submit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="branch-name" className="text-sm font-medium">
                  Branch name
                </label>
                <input
                  id="branch-name"
                  required
                  maxLength={120}
                  disabled={!!editingId}
                  value={draft.name}
                  onChange={update("name")}
                  className={field}
                />
              </div>
              <div>
                <label htmlFor="branch-type" className="text-sm font-medium">
                  Branch type
                </label>
                <select
                  id="branch-type"
                  disabled={!!editingId}
                  value={draft.type}
                  onChange={update("type")}
                  className={field}
                >
                  <option value="permanent">Permanent</option>
                  <option value="temporary">Temporary</option>
                </select>
              </div>
            </div>
            {
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="branch-start" className="text-sm font-medium">
                    Start date
                  </label>
                  <input
                    id="branch-start"
                    type="date"
                    required={draft.type === "temporary"}
                    value={draft.startDate}
                    onChange={update("startDate")}
                    className={field}
                  />
                </div>
                <div>
                  <label htmlFor="branch-end" className="text-sm font-medium">
                    Operates until (inclusive)
                  </label>
                  <input
                    id="branch-end"
                    type="date"
                    required={draft.type === "temporary"}
                    min={draft.startDate || undefined}
                    value={draft.endDate}
                    onChange={update("endDate")}
                    className={field}
                  />
                </div>
              </div>
            }
            <p className="text-xs text-gray-700 dark:text-gray-300">
              Temporary branches require both dates. Permanent branches can
              leave dates blank for ongoing operation. Weekly forms use these
              operating dates.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setError("");
                }}
                className="rounded-xl bg-lightPrimary px-5 py-3 text-sm dark:bg-navy-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canManage}
                className="rounded-xl bg-brand-500 px-5 py-3 text-sm font-bold text-white"
              >
                {editingId ? "Save dates" : "Save branch"}
              </button>
            </div>
          </form>
        </Card>
      )}
      <Card extra="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-bold">Branches ({visible.length})</h2>
          <div className="flex flex-wrap items-center gap-3">
            <input
              aria-label="Search branches"
              type="search"
              placeholder="Search branches"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={field}
            />
            <select
              aria-label="Filter branch type"
              value={type}
              onChange={(event) => setType(event.target.value)}
              className={field}
            >
              <option value="all">All types</option>
              <option value="permanent">Permanent</option>
              <option value="temporary">Temporary</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showRemoved}
                onChange={(event) => setShowRemoved(event.target.checked)}
              />
              Show removed branches
            </label>
          </div>
        </div>
        {!visible.length ? (
          <div className="py-12 text-center">
            <FiMapPin className="mx-auto mb-4 text-4xl text-gray-600" />
            <h3 className="font-bold">
              {records.length
                ? "No matching branches"
                : "No branches added yet"}
            </h3>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              {records.length
                ? "Adjust the filters or show removed branches."
                : "Add a permanent or temporary branch to get started."}
            </p>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[750px] text-sm">
              <caption className="sr-only">
                Permanent and temporary branches with operating dates
              </caption>
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-700 dark:border-white/10 dark:text-gray-300">
                  {[
                    "Branch",
                    "Type",
                    "Start date",
                    "Operates until",
                    "Status",
                    "Actions",
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
                {visible.map((record) => (
                  <tr
                    key={record.id}
                    className="border-b border-gray-100 dark:border-white/10"
                  >
                    <th scope="row" className="px-2 py-4 text-start">
                      {record.name}
                    </th>
                    <td className="px-2 py-4 capitalize">{record.type}</td>
                    <td className="px-2 py-4">
                      {formatDate(record.startDate)}
                    </td>
                    <td className="px-2 py-4">
                      {record.endDate ? formatDate(record.endDate) : "Ongoing"}
                    </td>
                    <td className="px-2 py-4">{branchStatus(record)}</td>
                    <td className="px-2 py-4">
                      <div className="flex gap-3">
                        {record.removed ? (
                          <button
                            type="button"
                            onClick={() => toggleRemoved(record)}
                            className="text-brand-500 hover:underline dark:text-brand-200"
                            disabled={!canManage}
                            aria-label={`Restore ${record.name}`}
                          >
                            Restore
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => openForm(record)}
                              className="text-brand-500 hover:underline dark:text-brand-200"
                              disabled={!canManage}
                              aria-label={`Edit dates for ${record.name}`}
                            >
                              Edit dates
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleRemoved(record)}
                              className="text-red-600 hover:underline dark:text-red-300"
                              disabled={!canManage}
                              aria-label={`Remove ${record.name}`}
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
