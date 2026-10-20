import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { Navigate, Link } from "lib/navigation";
import { canAccess, firstPage as landingPage } from "../data/userHelpers.mjs";
const AuthContext = createContext(null);
async function api(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
export function AuthProvider({ children }) {
  const [state, setState] = useState({
    user: null,
    users: [],
    loading: true,
    error: "",
  });
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      if (response.status === 401) {
        setState({ user: null, users: [], loading: false, error: "" });
        return;
      }
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      let users = [];
      if (data.user.role === "Admin") users = (await api("/api/users")).users;
      setState({ user: data.user, users, loading: false, error: "" });
    } catch (e) {
      setState({
        user: null,
        users: [],
        loading: false,
        error: e.message || "Sign-in service unavailable.",
      });
    }
  }, []);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);
  async function signIn(details) {
    const { user } = await api("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details),
    });
    setState({ user, users: [], loading: false, error: "" });
    await refresh();
    return landingPage(user);
  }
  async function signOut() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      setState({ user: null, users: [], loading: false, error: "" });
      window.location.assign("/login");
    } catch (e) {
      setState((s) => ({ ...s, error: e.message }));
    }
  }
  async function saveUser(draft, id = null) {
    try {
      await api("/api/users", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, ...(id ? { id } : {}) }),
      });
      await refresh();
      return "";
    } catch (e) {
      return e.message;
    }
  }
  async function setRemoved(id, removed) {
    try {
      await api("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, removed }),
      });
      await refresh();
      return "";
    } catch (e) {
      return e.message;
    }
  }
  return (
    <AuthContext.Provider
      value={{
        ...state,
        needsSetup: false,
        previewAvailable: false,
        isPreview: false,
        signIn,
        signOut,
        saveUser,
        setRemoved,
        can: (page, action = "view") => canAccess(state.user, page, action),
        firstPage: landingPage(state.user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
export function RequireLogin({ children }) {
  const { user, loading, error } = useAuth();
  if (loading) return <p className="p-8">Checking access…</p>;
  if (error)
    return (
      <p role="alert" className="p-8">
        {error}
      </p>
    );
  return user ? children : <Navigate to="/login" replace />;
}
export function PageAccess({ page, children }) {
  const { can, firstPage } = useAuth();
  return can(page) ? (
    children
  ) : (
    <div className="rounded-[20px] bg-white p-8 text-navy-700 dark:bg-navy-800 dark:text-white">
      <h1 className="text-xl font-bold">Access unavailable</h1>
      <p className="mt-2">Ask your administrator to update your access.</p>
      <Link to={"/admin/" + firstPage}>Go to an available page</Link>
    </div>
  );
}
