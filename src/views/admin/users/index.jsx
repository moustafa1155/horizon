import { useState } from "react";
import Card from "components/card";
import { useAuth } from "../../../contexts/AuthContext";
import { PAGES, canAccess } from "../../../data/userHelpers.mjs";
import UserForm from "./UserForm";

export default function Users() {
  const {
    users,
    user,
    isPreview,
    error: accountError,
    saveUser,
    setRemoved,
  } = useAuth();
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [showRemoved, setShowRemoved] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const visible = users.filter(
    (account) =>
      (showRemoved || !account.removed) &&
      `${account.name} ${account.username} ${account.role}`
        .toLowerCase()
        .includes(query.trim().toLowerCase())
  );
  async function save(draft, id) {
    const result = await saveUser(draft, id);
    if (!result) {
      setShowForm(false);
      setNotice(
        id
          ? "User and permissions updated."
          : "User added. They can now sign in on this browser."
      );
    }
    return result;
  }
  function remove(account, removed) {
    const result = setRemoved(account.id, removed);
    setError(result);
    if (!result)
      setNotice(
        removed
          ? `${account.name} removed. Their sign-in access is disabled; existing company records are retained.`
          : `${account.name} restored.`
      );
  }
  return (
    <div className="mt-3 space-y-5 text-navy-700 dark:text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Manage user accounts, roles and the pages they can access.
        </p>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
            setNotice("");
            setError("");
          }}
          className="rounded-xl bg-brand-500 px-5 py-3 text-sm font-bold text-white"
        >
          Add user
        </button>
      </div>
      <p className="rounded-xl bg-white p-4 text-xs leading-5 text-gray-700 dark:bg-navy-800 dark:text-gray-300">
        Accounts and permissions apply in this browser only. These local access
        checks are not server security and do not share accounts between
        devices. Connect a backend before company-wide use.
      </p>
      {(accountError || error) && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-300">
          {accountError || error}
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
      {showForm && (
        <UserForm
          key={editing?.id || "new"}
          account={editing}
          currentId={user.id}
          readOnly={isPreview}
          onSave={save}
          onCancel={() => setShowForm(false)}
        />
      )}
      <Card extra="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-bold">Users ({visible.length})</h2>
          <div className="flex flex-wrap gap-4">
            <input
              aria-label="Search users"
              type="search"
              placeholder="Name, username or role"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="rounded-xl border border-gray-200 bg-lightPrimary p-3 text-sm dark:border-white/10 dark:bg-navy-900"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showRemoved}
                onChange={(event) => setShowRemoved(event.target.checked)}
              />
              Show removed users
            </label>
          </div>
        </div>
        {!visible.length ? (
          <p className="py-10 text-center text-sm text-gray-700 dark:text-gray-300">
            No users match your search.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[750px] text-sm">
              <caption className="sr-only">User roles and page access</caption>
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-700 dark:border-white/10 dark:text-gray-300">
                  {["User", "Role", "Page access", "Status", "Actions"].map(
                    (label) => (
                      <th
                        key={label}
                        scope="col"
                        className="px-2 py-3 text-start"
                      >
                        {label}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map((account) => (
                  <tr
                    key={account.id}
                    className="border-b border-gray-100 dark:border-white/10"
                  >
                    <th scope="row" className="px-2 py-4 text-start">
                      <p>
                        {account.name}
                        {account.id === user.id && " (you)"}
                      </p>
                      <p className="mt-1 text-xs font-normal text-gray-700 dark:text-gray-300">
                        {account.username}
                      </p>
                    </th>
                    <td className="px-2 py-4">{account.role}</td>
                    <td className="max-w-[300px] px-2 py-4 text-xs text-gray-700 dark:text-gray-300">
                      {account.removed
                        ? "Access disabled"
                        : PAGES.filter((page) => canAccess(account, page.key))
                            .map(
                              (page) =>
                                `${page.label}${
                                  page.editable &&
                                  canAccess(account, page.key, "manage")
                                    ? " (manage)"
                                    : " (view)"
                                }`
                            )
                            .join(", ") || "No page access"}
                    </td>
                    <td className="px-2 py-4">
                      {account.removed ? "Removed" : "Active"}
                    </td>
                    <td className="px-2 py-4">
                      <div className="flex gap-3">
                        {account.removed ? (
                          <button
                            type="button"
                            disabled={isPreview}
                            aria-label={`Restore ${account.name}`}
                            onClick={() => remove(account, false)}
                            className="text-brand-500 hover:underline dark:text-brand-200"
                          >
                            Restore
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              aria-label={`Edit ${account.name}`}
                              onClick={() => {
                                setEditing(account);
                                setShowForm(true);
                                setError("");
                              }}
                              className="text-brand-500 hover:underline dark:text-brand-200"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={isPreview || account.id === user.id}
                              aria-label={`Remove ${account.name}`}
                              onClick={() => remove(account, true)}
                              className="text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-300"
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
