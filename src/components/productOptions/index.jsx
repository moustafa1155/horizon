import { useEffect, useMemo, useRef, useState } from "react";
import { FiChevronDown } from "react-icons/fi";
export default function ProductInput({ id, catalog, value, onChange, className, ...props }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef(null);
  const list = useRef(null);
  const listId = id + "-options";
  const matches = useMemo(() => {
    const query = value.trim().toLocaleLowerCase("en-GB");
    return [...catalog.records]
      .sort((a, b) => a.name.localeCompare(b.name, "en-GB", { sensitivity: "base", numeric: true }))
      .filter(product => !query || product.name.toLocaleLowerCase("en-GB").includes(query) || product.category.toLocaleLowerCase("en-GB").includes(query));
  }, [catalog.records, value]);
  useEffect(() => { setActive(-1); }, [value, catalog.records]);
  useEffect(() => { if (open && active >= 0) list.current?.children[active]?.scrollIntoView({ block: "nearest" }); }, [open, active]);
  function select(product) {
    onChange(product.name);
    setOpen(false);
    setActive(-1);
    input.current?.focus();
  }
  return <div className="relative">
    <div className="relative">
      <input {...props} ref={input} id={id} value={value} autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId} aria-activedescendant={open && active >= 0 ? listId + "-" + active : undefined}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onChange={event => { onChange(event.target.value); setActive(-1); setOpen(true); }}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setOpen(true);
            if (matches.length) setActive(current => event.key === "ArrowDown" ? (current + 1) % matches.length : current <= 0 ? matches.length - 1 : current - 1);
          } else if (event.key === "Enter" && open && active >= 0 && matches[active]) { event.preventDefault(); select(matches[active]); }
          else if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
          else if (event.key === "Tab") setOpen(false);
        }}
        className={className + " !pr-10"} />
      <button type="button" tabIndex={-1} aria-label="Toggle product suggestions" aria-expanded={open} aria-controls={listId}
        onPointerDown={event => event.preventDefault()} onClick={() => { if (!open) input.current?.focus(); setOpen(!open); }}
        className="absolute end-3 bottom-3 rounded text-gray-700 dark:text-gray-300"><FiChevronDown aria-hidden="true" /></button>
    </div>
    {open && <div className="absolute start-0 top-full z-30 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-white/20 dark:bg-navy-800">
      <ul ref={list} id={listId} role="listbox" aria-label="Products in alphabetical order" className="max-h-56 overflow-y-auto overscroll-contain py-1">
        {matches.map((product, index) => <li key={product.id} id={listId + "-" + index} role="option" aria-selected={index === active}
          onPointerDown={event => event.preventDefault()} onClick={() => select(product)}
          className={"cursor-pointer px-3 py-2 text-sm hover:bg-brand-50 dark:hover:bg-navy-700 " + (index === active ? "bg-brand-50 dark:bg-navy-700" : "")}>
          <span className="block font-medium">{product.name}</span><span className="block text-xs text-gray-700 dark:text-gray-300">{product.category}</span>
        </li>)}
      </ul>
      {!matches.length && <p role="status" className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">{catalog.loading ? "Loading products…" : "No matching products. You can enter a product name."}</p>}
      {catalog.error && <p role="alert" className="px-3 pb-3 text-sm text-red-600">{catalog.error}</p>}
    </div>}
  </div>;
}
