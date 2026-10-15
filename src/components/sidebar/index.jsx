import { useAuth } from "../../contexts/AuthContext";
/* eslint-disable */

import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { HiX } from "react-icons/hi";
import Links from "./components/Links";

import routes from "routes.jsx";

const Sidebar = ({ open, onClose, collapsed = false, onToggle }) => {
  const { user, signOut } = useAuth();
  return (
    <div
      className={`${
        collapsed ? "w-[290px] xl:w-[80px]" : "w-[290px]"
      } linear fixed top-0 !z-50 flex h-screen h-[100dvh] flex-col overflow-y-auto overflow-x-hidden overscroll-contain [&>*]:shrink-0 bg-white pb-10 shadow-2xl shadow-white/5 transition-all duration-300 dark:!bg-navy-800 dark:text-white md:!z-50 lg:!z-50 xl:!z-0 ${
        open ? "translate-x-0" : "-translate-x-96"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Minimize sidebar"}
        aria-expanded={!collapsed}
        className="absolute right-4 top-4 hidden rounded-lg bg-lightPrimary p-2 text-brand-500 dark:bg-navy-900 xl:block"
      >
        {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
      </button>
      <span
        className="absolute right-4 top-4 block cursor-pointer xl:hidden"
        onClick={onClose}
      >
        <HiX />
      </span>

      <div className={`mt-14 flex items-center justify-center ${collapsed ? "mx-2 xl:mx-1" : "mx-5"}`}>
        <div className={`w-full rounded-xl bg-white ${collapsed ? "p-2 xl:p-1" : "p-2"}`}>
          <img
            src="/images/taste-the-best-logo.png"
            alt="Taste The Best — Eat good, feel good"
            width={973}
            height={315}
            className={`h-auto w-full object-contain ${collapsed ? "xl:max-h-12" : ""}`}
          />
        </div>
      </div>
      <div className="mb-7 mt-7 h-px bg-gray-300 dark:bg-white/30" />
      {/* Nav item */}

      <ul className="mb-auto pt-1">
        <Links routes={routes} collapsed={collapsed} />
      </ul>
      <div
        className={`${
          collapsed ? "mx-2" : "mx-6"
        } mt-8 rounded-xl bg-lightPrimary p-4 text-sm dark:bg-navy-900`}
      >
        <p title={user?.name} className="truncate font-bold">
          {collapsed ? user?.name?.[0] : user?.name}
        </p>
        <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
          {collapsed ? "" : user?.role}
        </p>
        <button
          type="button"
          onClick={signOut}
          className="mt-3 text-sm text-brand-500 hover:underline dark:text-brand-200"
        >
          Sign out
        </button>
      </div>

      {/* Nav item end */}
    </div>
  );
};

export default Sidebar;
