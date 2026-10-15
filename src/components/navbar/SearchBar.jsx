import { useAuth } from "../../contexts/AuthContext";
import React from "react";
import Dropdown from "components/dropdown";
import { FiAlignJustify } from "react-icons/fi";
import navbarimage from "assets/img/layout/Navbar.png";
import { BsArrowBarUp } from "react-icons/bs";
import { FiSearch } from "react-icons/fi";
import { RiMoonFill, RiSunFill } from "react-icons/ri";
import {
  IoMdNotificationsOutline,
  IoMdInformationCircleOutline,
} from "react-icons/io";

// Search field and dashboard controls, shared by the standard and RTL headers.
const SearchBar = ({ onOpenSidenav }) => {
  const { user, signOut } = useAuth();
  const [darkmode, setDarkmode] = React.useState(() =>
    document.body.classList.contains("dark")
  );
  return (
    <div className="relative mt-[3px] flex h-[61px] w-[355px] flex-grow items-center justify-around gap-2 rounded-full bg-white px-2 py-2 shadow-xl shadow-shadow-500 dark:!bg-navy-800 dark:shadow-none md:w-[365px] md:flex-grow-0 md:gap-1 xl:w-[365px] xl:gap-2">
      <div className="flex h-full items-center rounded-full bg-lightPrimary text-navy-700 dark:bg-navy-900 dark:text-white xl:w-[225px]">
        <p className="pe-2 ps-3 text-xl">
          <FiSearch className="h-4 w-4 text-gray-400 dark:text-white" />
        </p>
        <input
          type="search"
          aria-label="Search"
          placeholder="Search..."
          className="block h-full w-full rounded-full bg-lightPrimary text-sm font-medium text-navy-700 outline-none placeholder:!text-gray-400 dark:bg-navy-900 dark:text-white dark:placeholder:!text-white sm:w-fit"
        />
      </div>
      <button
        type="button"
        aria-label="Toggle sidebar"
        className="flex cursor-pointer text-xl text-gray-600 dark:text-white"
        onClick={onOpenSidenav}
      >
        <FiAlignJustify className="h-5 w-5" />
      </button>
      {/* start Notification */}
      <Dropdown
        button={
          <p className="cursor-pointer">
            <IoMdNotificationsOutline className="h-4 w-4 text-gray-600 dark:text-white" />
          </p>
        }
        animation="origin-[65%_0%] md:origin-top-right transition-all duration-300 ease-in-out"
        children={
          <div className="flex w-[360px] flex-col gap-3 rounded-[20px] bg-white p-4 shadow-xl shadow-shadow-500 dark:!bg-navy-700 dark:text-white dark:shadow-none sm:w-[460px]">
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-navy-700 dark:text-white">
                Notification
              </p>
              <p className="text-sm font-bold text-navy-700 dark:text-white">
                Mark all read
              </p>
            </div>

            <button className="flex w-full items-center">
              <div className="flex h-full w-[85px] items-center justify-center rounded-xl bg-gradient-to-b from-brandLinear to-brand-500 py-4 text-2xl text-white">
                <BsArrowBarUp />
              </div>
              <div className="ms-2 flex h-full w-full flex-col justify-center rounded-lg px-1 text-sm">
                <p className="mb-1 text-start text-base font-bold text-gray-900 dark:text-white">
                  New Update: Horizon UI Dashboard PRO
                </p>
                <p className="font-base text-start text-xs text-gray-900 dark:text-white">
                  A new update for your downloaded item is available!
                </p>
              </div>
            </button>

            <button className="flex w-full items-center">
              <div className="flex h-full w-[85px] items-center justify-center rounded-xl bg-gradient-to-b from-brandLinear to-brand-500 py-4 text-2xl text-white">
                <BsArrowBarUp />
              </div>
              <div className="ms-2 flex h-full w-full flex-col justify-center rounded-lg px-1 text-sm">
                <p className="mb-1 text-start text-base font-bold text-gray-900 dark:text-white">
                  New Update: Horizon UI Dashboard PRO
                </p>
                <p className="font-base text-start text-xs text-gray-900 dark:text-white">
                  A new update for your downloaded item is available!
                </p>
              </div>
            </button>
          </div>
        }
        classNames={"py-2 top-4 -start-[230px] md:-start-[440px] w-max"}
      />
      {/* start Horizon PRO */}
      <Dropdown
        button={
          <p className="cursor-pointer">
            <IoMdInformationCircleOutline className="h-4 w-4 text-gray-600 dark:text-white" />
          </p>
        }
        children={
          <div className="flex w-[350px] flex-col gap-2 rounded-[20px] bg-white p-4 shadow-xl shadow-shadow-500 dark:!bg-navy-700 dark:text-white dark:shadow-none">
            <div
              style={{
                backgroundImage: `url(${navbarimage.src})`,
                backgroundRepeat: "no-repeat",
                backgroundSize: "cover",
              }}
              className="mb-2 aspect-video w-full rounded-lg"
            />
            <a
              href="#!"
              className="px-full linear flex cursor-pointer items-center justify-center rounded-xl bg-brand-500 py-[11px] font-bold text-white transition duration-200 hover:bg-brand-600 hover:text-white active:bg-brand-700 dark:bg-brand-400 dark:hover:bg-brand-300 dark:active:bg-brand-200"
            >
              Buy Horizon UI PRO
            </a>
            <a
              href="#!"
              className="px-full linear flex cursor-pointer items-center justify-center rounded-xl border py-[11px] font-bold text-navy-700 transition duration-200 hover:bg-gray-200 hover:text-navy-700 dark:!border-white/10 dark:text-white dark:hover:bg-white/20 dark:hover:text-white dark:active:bg-white/10"
            >
              See Documentation
            </a>
            <a
              href="#!"
              className="hover:bg-black px-full linear flex cursor-pointer items-center justify-center rounded-xl py-[11px] font-bold text-navy-700 transition duration-200 hover:text-navy-700 dark:text-white dark:hover:text-white"
            >
              Try Horizon Free
            </a>
          </div>
        }
        classNames={"py-2 top-6 -start-[250px] md:-start-[330px] w-max"}
        animation="origin-[75%_0%] md:origin-top-right transition-all duration-300 ease-in-out"
      />
      <div
        className="cursor-pointer text-gray-600"
        onClick={() => {
          if (darkmode) {
            document.body.classList.remove("dark");
            setDarkmode(false);
          } else {
            document.body.classList.add("dark");
            setDarkmode(true);
          }
        }}
      >
        {darkmode ? (
          <RiSunFill className="h-4 w-4 text-gray-600 dark:text-white" />
        ) : (
          <RiMoonFill className="h-4 w-4 text-gray-600 dark:text-white" />
        )}
      </div>
      <Dropdown
        button={
          <button
            type="button"
            aria-label="Account menu"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-500"
          >
            {user?.name
              .split(" ")
              .map((part) => part[0])
              .slice(0, 2)
              .join("")}
          </button>
        }
        children={
          <div className="w-56 rounded-[20px] bg-white p-4 shadow-xl dark:bg-navy-700">
            <p className="font-bold">{user?.name}</p>
            <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
              {user?.role}
            </p>
            <button
              type="button"
              onClick={signOut}
              className="mt-4 text-sm text-brand-500 dark:text-brand-200"
            >
              Sign out
            </button>
          </div>
        }
        classNames="py-2 top-8 -start-[180px] w-max"
      />
    </div>
  );
};
export default SearchBar;
