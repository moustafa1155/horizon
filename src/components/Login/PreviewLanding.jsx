import { useAuth } from "../../contexts/AuthContext";
export default function PreviewLanding({
  onManagerPreview,
  onEmployeePreview,
}) {
  const { startPreview } = useAuth();
  return (
    <main className="flex min-h-screen items-center justify-center bg-lightPrimary p-5 text-navy-700 dark:bg-navy-900 dark:text-white">
      <section className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-xl shadow-shadow-500 dark:bg-navy-800">
        <img
          src="/images/taste-the-best-logo.png"
          alt="Taste The Best"
          width="973"
          height="315"
          className="mx-auto mb-8 h-auto w-64 rounded-xl bg-white"
        />
        <h1 className="text-3xl font-bold">Preview your workspace</h1>
        <p className="mt-3 text-sm leading-6 text-gray-700 dark:text-gray-300">
          Choose a role to explore the website. No account is needed.
        </p>
        <div className="mt-7 space-y-3">
          <button
            onClick={() => startPreview("Admin")}
            className="w-full rounded-xl bg-brand-500 p-4 text-left font-bold text-white"
          >
            Preview Admin
            <span className="mt-1 block text-xs font-normal">
              Dashboard and company management pages
            </span>
          </button>
          <button
            onClick={onManagerPreview}
            className="w-full rounded-xl border border-brand-500 p-4 text-left font-bold text-brand-500 dark:text-brand-200"
          >
            Preview Branch Manager
            <span className="mt-1 block text-xs font-normal">
              Staff, sales entry, product orders and timetables
            </span>
          </button>
          <button
            onClick={onEmployeePreview}
            className="w-full rounded-xl border border-brand-500 p-4 text-left font-bold text-brand-500 dark:text-brand-200"
          >
            Preview Employee
            <span className="mt-1 block text-xs font-normal">
              Weekly stock checking only
            </span>
          </button>
        </div>
        <p className="mt-6 border-t border-gray-200 pt-4 text-xs leading-5 text-gray-700 dark:border-white/10 dark:text-gray-300">
          Preview records stay in this browser. This preview does not access the
          live employee database.
        </p>
      </section>
    </main>
  );
}
