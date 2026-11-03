import { useEffect, useRef } from "react";

export default function OrderDetailsDialog({ order, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="order-details-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      className="backdrop:bg-black/40 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 text-navy-700 shadow-xl dark:bg-navy-800 dark:text-white"
    >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="order-details-title" className="text-lg font-bold">Order details</h2>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                {order.branch} · Week beginning {order.week} ·{" "}
                {order.manager}
              </p>
            </div>
            <button
              autoFocus
              type="button"
              onClick={() => onClose()}
              className="text-sm text-brand-500 hover:underline dark:text-brand-200"
            >
              Close details
            </button>
          </div>
          <ul className="mt-5 divide-y divide-gray-200 dark:divide-white/10">
            {order.items.map((item) => (
              <li
                key={item.product}
                className="flex justify-between gap-4 py-3 text-sm"
              >
                <span>{item.product}</span>
                <span className="font-bold">Quantity: {item.quantity}</span>
              </li>
            ))}
          </ul>
          {order.notes && (
            <p className="mt-4 whitespace-pre-wrap text-sm">
              Notes: {order.notes}
            </p>
          )}
          <p className="mt-4 text-xs text-gray-700 dark:text-gray-300">
            Saved locally on{" "}
            {new Date(order.placedAt).toLocaleString("en-GB")}
          </p>

    </dialog>
  );
}
