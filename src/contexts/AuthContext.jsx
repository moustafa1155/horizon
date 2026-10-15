import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, Link } from "lib/navigation";
import {
  USER_STORAGE_KEY,
  SESSION_KEY,
  loadUsers,
  canAccess,
  firstPage,
  rolePermissions,
  validateUser,
  validateChange,
  passwordRecord,
  verifyPassword,
  PAGES,
} from "../data/userHelpers.mjs";

const AuthContext = createContext(null);
const PREVIEW_ID = "horizon-temporary-preview";
const EMPLOYEE_PREVIEW_ID = "horizon-employee-preview";
const MANAGER_PREVIEW_ID = "horizon-manager-preview";
const previewAvailable = process.env.NODE_ENV === "development";
const previewUser = {
  id: PREVIEW_ID,
  name: "Workspace preview",
  role: "Admin",
  permissions: rolePermissions("Admin"),
  removed: false,
  preview: true,
};
const employeePreviewUser = {
  ...previewUser,
  id: EMPLOYEE_PREVIEW_ID,
  name: "Employee preview",
  role: "Employee",
  permissions: rolePermissions("Employee"),
  employeePreview: true,
};
const managerPreviewUser = { ...previewUser, id: MANAGER_PREVIEW_ID, name: "Branch Manager preview", role: "Branch Manager", permissions: rolePermissions("Branch Manager"), managerPreview: true };
function readState() {
  try {
    return {
      users: loadUsers(window.localStorage),
      session: window.sessionStorage.getItem(SESSION_KEY),
      error: "",
    };
  } catch {
    return {
      users: [],
      session: null,
      error:
        "User accounts could not be loaded. Check browser storage; existing accounts have not been overwritten.",
    };
  }
}
export function AuthProvider({ children }) {
  const [state, setState] = useState(readState);
  const user =
    (previewAvailable && state.session === PREVIEW_ID
      ? previewUser
      : previewAvailable && state.session === EMPLOYEE_PREVIEW_ID
      ? employeePreviewUser
      : previewAvailable && state.session === MANAGER_PREVIEW_ID ? managerPreviewUser
      : state.users.find(
          (user) => user.id === state.session && !user.removed
        )) || null;
  useEffect(() => {
    const refresh = () => setState(readState());
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  function persist(users) {
    const serialized = JSON.stringify(users);
    loadUsers({ getItem: () => serialized });
    window.localStorage.setItem(USER_STORAGE_KEY, serialized);
    setState((current) => ({ ...current, users }));
  }
  async function signIn({ username, password }) {
    if (state.error) throw new Error(state.error);
    const users = loadUsers(window.localStorage);
    const account = users.find(
      (account) =>
        !account.removed &&
        account.username.toLowerCase() === username.trim().toLowerCase()
    );
    if (!account || !(await verifyPassword(password, account.credentials)))
      throw new Error("Username or password is incorrect.");
    window.sessionStorage.setItem(SESSION_KEY, account.id);
    setState({ users, session: account.id, error: "" });
    return firstPage(account);
  }
  function startPreview(role = "Admin") {
    if (!previewAvailable || state.error) return;
    const previewId = role === "Employee" ? EMPLOYEE_PREVIEW_ID : role === "Branch Manager" ? MANAGER_PREVIEW_ID : PREVIEW_ID;
    window.sessionStorage.setItem(SESSION_KEY, previewId);
    setState((current) => ({ ...current, session: previewId }));
  }
  function signOut() {
    window.sessionStorage.removeItem(SESSION_KEY);
    setState((current) => ({ ...current, session: null }));
  }
  async function saveUser(draft, editingId = null, setup = false) {
    if (user?.preview)
      return "Preview mode is read-only. Create an admin account to save changes.";
    if (state.error) return state.error;
    try {
      const users = loadUsers(window.localStorage);
      if (setup && users.length)
        return "An admin account already exists. Sign in to continue.";
      const actor = users.find(
        (account) => account.id === state.session && !account.removed
      );
      if (!setup && actor?.role !== "Admin")
        return "Only admins can manage users.";
      const target = editingId
        ? users.find((account) => account.id === editingId)
        : null;
      if (editingId && !target) return "This user no longer exists.";
      const role = setup ? "Admin" : draft.role;
      const validation =
        validateUser({ ...draft, role }, users, editingId) ||
        (!setup && validateChange(users, actor, target, role));
      if (validation) return validation;
      const permissions =
        role === "Admin" || role === "Employee"
          ? rolePermissions(role)
          : Object.fromEntries(
              PAGES.map((page) => [
                page.key,
                {
                  view:
                    page.key === "users"
                      ? false
                      : !!draft.permissions?.[page.key]?.view,
                  manage:
                    page.key !== "users" &&
                    page.editable &&
                    !!draft.permissions?.[page.key]?.view &&
                    !!draft.permissions?.[page.key]?.manage,
                },
              ])
            );
      const credentials = draft.password
        ? await passwordRecord(draft.password)
        : target.credentials;
      // Recheck after hashing so a concurrent update cannot silently be overwritten.
      if (
        JSON.stringify(loadUsers(window.localStorage)) !== JSON.stringify(users)
      )
        return "Accounts changed in another tab. Please reload and try again.";
      const account = {
        id: editingId || crypto.randomUUID(),
        branchId: role === "Branch Manager" ? String(draft.branchId || "") : "",
        name: draft.name.trim(),
        username: draft.username.trim().toLowerCase(),
        role,
        permissions,
        credentials,
        removed: false,
      };
      persist(
        editingId
          ? users.map((user) => (user.id === editingId ? account : user))
          : [...users, account]
      );
      return "";
    } catch {
      return "The account could not be saved. Check browser storage and try again.";
    }
  }
  function setRemoved(id, removed) {
    if (state.error) return state.error;
    try {
      const users = loadUsers(window.localStorage);
      const actor = users.find(
        (account) => account.id === state.session && !account.removed
      );
      const target = users.find((account) => account.id === id);
      if (!target) return "This user no longer exists.";
      const validation = validateChange(
        users,
        actor,
        target,
        target.role,
        removed
      );
      if (validation) return validation;
      persist(
        users.map((account) =>
          account.id === id ? { ...account, removed } : account
        )
      );
      return "";
    } catch {
      return "The account could not be updated. Check browser storage and try again.";
    }
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        users: state.users.map(({ credentials, ...account }) => account),
        error: state.error,
        needsSetup: !state.error && !state.users.length,
        previewAvailable,
        isPreview: !!user?.preview,
        startPreview,
        signIn,
        signOut,
        saveUser,
        setRemoved,
        can: (page, action = "view") =>
          (!user?.preview || user?.employeePreview || user?.managerPreview || action === "view") &&
          canAccess(user, page, action),
        firstPage: firstPage(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
export function RequireLogin({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}
export function PageAccess({ page, children }) {
  const { can, firstPage } = useAuth();
  if (can(page)) return children;
  return (
    <div className="rounded-[20px] bg-white p-8 text-navy-700 dark:bg-navy-800 dark:text-white">
      <h1 className="text-xl font-bold">Access unavailable</h1>
      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
        You do not have permission to view this page. Ask your administrator to
        update your access.
      </p>
      {firstPage !== "no-access" && (
        <Link
          to={`/admin/${firstPage}`}
          className="mt-4 inline-block text-sm text-brand-500 dark:text-brand-200"
        >
          Go to an available page
        </Link>
      )}
    </div>
  );
}
