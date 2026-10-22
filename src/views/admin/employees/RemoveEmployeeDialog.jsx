import { useEffect, useRef, useState } from "react";
export default function RemoveEmployeeDialog({ employee, onRemove, onCancel }) {
  const dialog = useRef(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  async function confirm() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await onRemove(employee.id);
      if (result) setError(result);
    } catch {
      setError("The employee could not be removed. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby="remove-employee-title"
      aria-describedby="remove-employee-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      className="backdrop:bg-black/40 m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl bg-white p-6 text-navy-700 shadow-xl dark:bg-navy-800 dark:text-white"
    >
      <h2 id="remove-employee-title" className="text-xl font-bold">
        Remove employee?
      </h2>
      <p id="remove-employee-description" className="mt-4 text-sm leading-6">
        Are you sure you want to remove <strong>{employee.name}</strong>? Their
        staff record will be archived and removed from the active directory.
        Existing timetable records will be kept.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button
          autoFocus
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="rounded-xl border border-gray-200 px-5 py-3 font-medium disabled:opacity-50 dark:border-white/20"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={confirm}
          className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "Removing…" : "Yes, remove employee"}
        </button>
      </div>
    </dialog>
  );
}
