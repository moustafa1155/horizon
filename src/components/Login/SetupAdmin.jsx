import { useState } from "react";
import { useNavigate } from "lib/navigation";
import { useAuth } from "../../contexts/AuthContext";

export default function SetupAdmin({ onEmployeePreview, onManagerPreview }) {
  const { saveUser, signIn, previewAvailable, startPreview } = useAuth();
  const navigate = useNavigate();
  const [draft, setDraft] = useState({
    name: "",
    username: "",
    password: "",
    role: "Admin",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const result = await saveUser(draft, null, true);
      if (result) {
        setError(result);
        return;
      }
      const page = await signIn(draft);
      setDraft((current) => ({ ...current, password: "" }));
      navigate(`/admin/${page}`, { replace: true });
    } catch {
      setError(
        "Unable to finish setup. Reload and sign in if your account was already saved."
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-lightPrimary p-5 text-navy-700 dark:bg-navy-900 dark:text-white">
      <section className="w-full max-w-lg rounded-[28px] bg-white p-8 shadow-xl shadow-shadow-500 dark:bg-navy-800">
        <p className="mb-8 font-poppins text-xl font-bold">
          TASTE THE BEST COMPANY PORTAL
        </p>
        <h1 className="text-3xl font-bold">Set up your admin account</h1>
        <p className="mt-3 text-sm leading-6 text-gray-700 dark:text-gray-300">
          Create the first admin account, then add users and choose their page
          permissions. No accounts are prefilled.
        </p>
        {previewAvailable && (
          <button
            type="button"
            onClick={startPreview}
            className="mt-5 w-full rounded-xl border border-brand-500 p-3 text-sm font-bold text-brand-500 dark:text-brand-200"
          >
            Preview workspace without an account
          </button>
        )}
        {previewAvailable && <button type="button" onClick={onEmployeePreview} className="mt-3 w-full rounded-xl bg-brand-500 p-3 text-sm font-bold text-white">Preview employees interface</button>}
        {onManagerPreview && <button type="button" onClick={onManagerPreview} className="mt-3 w-full rounded-xl border border-brand-500 p-3 text-sm font-bold text-brand-500 dark:text-brand-200">Preview branch manager interface</button>}
        <form onSubmit={submit} className="mt-6 space-y-5">
          <fieldset disabled={pending} className="space-y-5">
            {[
              ["name", "Full name", "text"],
              ["username", "Username", "text"],
              ["password", "Password", "password"],
            ].map(([key, label, type]) => (
              <div key={key}>
                <label htmlFor={`setup-${key}`} className="text-sm font-medium">
                  {label}
                </label>
                <input
                  id={`setup-${key}`}
                  type={type}
                  required
                  autoComplete={
                    key === "password"
                      ? "new-password"
                      : key === "username"
                      ? "username"
                      : "name"
                  }
                  minLength={
                    key === "password" ? 12 : key === "username" ? 3 : undefined
                  }
                  maxLength={
                    key === "password" ? 128 : key === "username" ? 32 : 120
                  }
                  value={draft[key]}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-lightPrimary p-3 text-sm outline-none focus:border-brand-500 dark:border-white/10 dark:bg-navy-900"
                />
              </div>
            ))}
            <p className="text-xs text-gray-700 dark:text-gray-300">
              Use a password between 12 and 128 characters.
            </p>
            {error && (
              <p
                role="alert"
                className="text-sm text-red-600 dark:text-red-300"
              >
                {error}
              </p>
            )}
            <button
              type="submit"
              className="w-full rounded-xl bg-brand-500 p-3.5 text-sm font-bold text-white"
            >
              {pending ? "Creating account…" : "Create admin account"}
            </button>
          </fieldset>
        </form>
        <p className="mt-6 border-t border-gray-200 pt-4 text-xs leading-5 text-gray-700 dark:border-white/10 dark:text-gray-300">
          Local setup: accounts apply only to this browser. Server
          authentication is required before using this with shared company data.
        </p>
      </section>
    </main>
  );
}
