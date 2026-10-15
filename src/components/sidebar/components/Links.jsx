import { useAuth } from "../../../contexts/AuthContext";
/* eslint-disable */
import React from "react";
import { Link, useLocation } from "lib/navigation";
import DashIcon from "components/icons/DashIcon";
// chakra imports

export function SidebarLinks(props) {
  // Chakra color mode
  let location = useLocation();

  const { routes, collapsed = false } = props;
  const { can } = useAuth();

  // verifies if routeName is the one active (in browser input)
  const activeRoute = (routeName) => {
    return location.pathname.includes(routeName);
  };

  const createLinks = (routes) => {
    return routes
      .filter((route) => can(route.path))
      .map((route, index) => {
        if (
          route.layout === "/admin" ||
          route.layout === "/auth" ||
          route.layout === "/rtl"
        ) {
          return (
            <Link
              key={index}
              to={route.layout + "/" + route.path}
              title={collapsed ? route.name : undefined}
              aria-label={route.name}
            >
              <div className="relative mb-3 flex hover:cursor-pointer">
                <li
                  className={`my-[3px] flex cursor-pointer items-center py-2 ${
                    collapsed ? "px-7" : "px-8"
                  }`}
                  key={index}
                >
                  <span
                    className={`${
                      activeRoute(route.path) === true
                        ? "font-bold text-brand-500 dark:text-white"
                        : "font-medium text-gray-600"
                    }`}
                  >
                    {route.icon ? route.icon : <DashIcon />}{" "}
                  </span>
                  <p
                    className={`${
                      collapsed ? "xl:hidden" : ""
                    } leading-1 ml-4 flex ${
                      activeRoute(route.path) === true
                        ? "font-bold text-navy-700 dark:text-white"
                        : "font-medium text-gray-600"
                    }`}
                  >
                    {route.name}
                  </p>
                </li>
                {activeRoute(route.path) ? (
                  <div className="absolute right-0 top-px h-9 w-1 rounded-lg bg-orange-500 dark:bg-orange-400" />
                ) : null}
              </div>
            </Link>
          );
        }
      });
  };
  // BRAND
  return createLinks(routes);
}

export default SidebarLinks;
