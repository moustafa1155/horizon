import { useState } from "react";
import { loginErrorMessage } from "../../data/loginErrors.mjs";
import { useNavigate } from "lib/navigation";
import {
  FiEye,
  FiEyeOff,
  FiUsers,
  FiShoppingBag,
  FiClipboard,
  FiBarChart2,
  FiLock,
} from "react-icons/fi";

const features = [
  [FiUsers, "Your team", "Employee details and weekly timetables."],
  [FiShoppingBag, "Weekly orders", "Product orders for every branch."],
  [FiClipboard, "Stock checks", "Weekly stock counts and branch activity."],
  [FiBarChart2, "Sales reports", "Card, cash and weekly sales totals."],
];
const inputClass =
  "mt-2 block w-full rounded-xl border border-gray-200 bg-lightPrimary px-4 py-3.5 text-sm text-navy-700 outline-none placeholder:text-gray-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:opacity-60 dark:border-white/10 dark:bg-navy-900 dark:text-white dark:placeholder:text-gray-400";

// Pass an authentication provider as onSignIn({ username, password }).
// It must resolve only after authenticating and reject on failure.
// Role authorization and sessions belong to the authentication service.
export default function Login({
  onSignIn,
  onPreview,
  onEmployeePreview,
  onManagerPreview,
}) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    setError("");
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    if (typeof onSignIn !== "function") {
      setError(
        "Sign-in is not connected yet. Please contact your company administrator."
      );
      return;
    }
    setPending(true);
    try {
      const page = await onSignIn({ username: username.trim(), password });
      setPassword("");
      navigate(`/admin/${page || "default"}`, { replace: true });
    } catch (error) {
      setError(loginErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-lightPrimary p-4 text-navy-700 dark:bg-navy-900 dark:text-white md:p-8">
      <div className="grid w-full max-w-[1120px] overflow-hidden rounded-[28px] bg-white shadow-xl shadow-shadow-500 dark:bg-navy-800 lg:grid-cols-2">
        <section
          aria-labelledby="login-heading"
          className="px-6 py-10 sm:px-10 lg:px-14 lg:py-14"
        >
          <div className="mb-12">
            <p className="font-poppins text-2xl font-bold uppercase tracking-tight">
              Taste The Best{" "}
              <span className="font-medium text-orange-700 dark:text-orange-300">
                Company Portal
              </span>
            </p>
            <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
              Branch management workspace
            </p>
          </div>
          <div
            className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-xl text-brand-500 dark:bg-navy-700 dark:text-brand-200"
            aria-hidden="true"
          >
            <FiLock />
          </div>
          <h1 id="login-heading" className="text-3xl font-bold md:text-4xl">
            Welcome back
          </h1>
          <p className="mt-3 text-sm leading-6 text-gray-700 dark:text-gray-300">
            Sign in with your company account to access your workspace.
          </p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="login-username" className="text-sm font-medium">
                Username
              </label>
              <input
                id="login-username"
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                maxLength={32}
                disabled={pending}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Your company username"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="login-password" className="text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  disabled={pending}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className={`${inputClass} pe-12`}
                />
                <button
                  type="button"
                  disabled={pending}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  aria-controls="login-password"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute end-3 top-3.5 rounded-md p-1 text-gray-700 hover:text-brand-500 focus-visible:outline-brand-500 dark:text-gray-300"
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-navy-900 dark:text-red-300"
              >
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-brand-500 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-wait disabled:opacity-60"
            >
              {pending ? "Signing in…" : "Sign in"}
            </button>
            <p className="text-center text-xs leading-5 text-gray-700 dark:text-gray-300">
              Need access or help with your password?
              <br />
              Contact your company administrator.
            </p>
          </form>
          {onPreview && (
            <button
              type="button"
              onClick={onPreview}
              className="mt-6 w-full rounded-xl border border-brand-500 p-3 text-sm font-medium text-brand-500 dark:text-brand-200"
            >
              Preview workspace without an account
            </button>
          )}
          {onEmployeePreview && (
            <button
              type="button"
              onClick={onEmployeePreview}
              className="mt-3 w-full rounded-xl bg-brand-500 p-3 text-sm font-bold text-white"
            >
              Preview employees interface
            </button>
          )}
          {onManagerPreview && (
            <button
              type="button"
              onClick={onManagerPreview}
              className="mt-3 w-full rounded-xl border border-brand-500 p-3 text-sm font-bold text-brand-500 dark:text-brand-200"
            >
              Preview branch manager interface
            </button>
          )}
          {!onSignIn && (
            <p className="mt-8 border-t border-gray-200 pt-4 text-xs leading-5 text-gray-700 dark:border-white/10 dark:text-gray-300">
              Company sign-in is not connected yet. This screen is ready for
              your authentication service.
            </p>
          )}
        </section>
        <aside
          className="flex flex-col justify-center bg-gradient-to-br from-brand-600 to-brand-800 px-6 py-10 text-white sm:px-10 lg:px-14 lg:py-14"
          aria-label="Company workspace features"
        >
          <span className="mb-6 w-fit rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium">
            One workspace for your company
          </span>
          <h2 className="max-w-sm text-3xl font-bold leading-tight md:text-4xl">
            Keep every branch
            <br />
            working together.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/80">
            Bring your people, stock, orders and sales into one clear weekly
            overview.
          </p>
          <ul className="mt-10 space-y-6">
            {features.map(([Icon, title, description]) => (
              <li key={title} className="flex items-start gap-4">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg"
                  aria-hidden="true"
                >
                  <Icon />
                </span>
                <div>
                  <h3 className="text-sm font-bold">{title}</h3>
                  <p className="mt-1 text-xs leading-5 text-white/80">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-12 text-xs text-white/70">
            For admins, branch managers and employees.
          </p>
        </aside>
      </div>
    </main>
  );
}
