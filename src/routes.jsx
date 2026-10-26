import StaffTimetables from "views/admin/staffTimetables";
import Users from "views/admin/users";
import MediaLibrary from "views/admin/media";
import React from "react";

// Admin Imports
import MainDashboard from "views/admin/default";
import Employees from "views/admin/employees";
import WeeklyStockChecks from "views/admin/weeklyStockChecks";
import WeeklyOrders from "views/admin/weeklyOrders";
import Branches from "views/admin/branches";

// Sales reports
import WeeklySalesReports from "views/admin/weeklySalesReports";

// Icon Imports
import {
  MdHome,
  MdPeople,
  MdShoppingBasket,
  MdFactCheck,
  MdPayments,
  MdPermMedia,
} from "react-icons/md";

const routes = [
  {
    name: "Weekly Staff Timetables",
    layout: "/admin",
    path: "weekly-staff-timetables",
    icon: <MdPeople className="h-6 w-6" />,
    component: <StaffTimetables />,
  },
  {
    name: "Main Dashboard",
    layout: "/admin",
    path: "default",
    icon: <MdHome className="h-6 w-6" />,
    component: <MainDashboard />,
  },
  {
    name: "Staff Details",
    layout: "/admin",
    path: "employees",
    icon: <MdPeople className="h-6 w-6" />,
    component: <Employees />,
    secondary: true,
  },
  {
    name: "Weekly Orders",
    layout: "/admin",
    icon: <MdShoppingBasket className="h-6 w-6" />,
    path: "weekly-orders",
    component: <WeeklyOrders />,
  },
  {
    name: "Weekly Stock Checks",
    layout: "/admin",
    path: "weekly-stock-checks",
    icon: <MdFactCheck className="h-6 w-6" />,
    component: <WeeklyStockChecks />,
  },
  {
    name: "Weekly Sales Reports",
    layout: "/admin",
    path: "weekly-sales-reports",
    icon: <MdPayments className="h-6 w-6" />,
    component: <WeeklySalesReports />,
  },
  {
    name: "Branches",
    layout: "/admin",
    path: "branches",
    icon: <MdHome className="h-6 w-6" />,
    component: <Branches />,
  },
  {
    name: "Users & Permissions",
    layout: "/admin",
    path: "users",
    icon: <MdPeople className="h-6 w-6" />,
    component: <Users />,
  },
  {
    name: "Media Library",
    layout: "/admin",
    path: "media",
    icon: <MdPermMedia className="h-6 w-6" />,
    component: <MediaLibrary />,
  },
];
export default routes;
