import { useAuth, PageAccess } from "../../contexts/AuthContext";
import React from "react";
import { Navigate, useLocation } from "lib/navigation";
import Navbar from "components/navbar";
import Sidebar from "components/sidebar";
import Footer from "components/footer/Footer";
import routes from "routes.jsx";

export default function Admin(props) {
  const { firstPage, isPreview, signOut, user } = useAuth();
  const { ...rest } = props;
  const location = useLocation();
  const [open, setOpen] = React.useState(true);
  const [currentRoute, setCurrentRoute] = React.useState("Main Dashboard");

  const [collapsed, setCollapsed] = React.useState(() => {
    try {
      return localStorage.getItem("horizon.sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });
  function toggleSidebar() {
    if (window.innerWidth < 1200) setOpen((value) => !value);
    else
      setCollapsed((value) => {
        const next = !value;
        try {
          localStorage.setItem("horizon.sidebar-collapsed", String(next));
        } catch {}
        return next;
      });
  }
  React.useEffect(() => {
    const resize = () => {
      if (window.innerWidth >= 1200) setOpen(true);
      else setOpen(false);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  React.useEffect(() => {
    getActiveRoute(routes);
  }, [location.pathname]);

  const getActiveRoute = (routes) => {
    let activeRoute = "Main Dashboard";
    for (let i = 0; i < routes.length; i++) {
      if (
        window.location.href.indexOf(
          routes[i].layout + "/" + routes[i].path
        ) !== -1
      ) {
        setCurrentRoute(routes[i].name);
      }
    }
    return activeRoute;
  };
  const getActiveNavbar = (routes) => {
    let activeNavbar = false;
    for (let i = 0; i < routes.length; i++) {
      if (
        window.location.href.indexOf(routes[i].layout + routes[i].path) !== -1
      ) {
        return routes[i].secondary;
      }
    }
    return activeNavbar;
  };
  const activePage = routes.find(
    (route) => location.pathname === route.layout + "/" + route.path
  );
  document.documentElement.dir = "ltr";
  return (
    <div className="flex h-full w-full">
      <Sidebar
        open={open}
        collapsed={collapsed}
        onToggle={toggleSidebar}
        onClose={() => setOpen(false)}
      />
      {/* Navbar & Main Content */}
      <div className="h-full w-full bg-lightPrimary dark:!bg-navy-900">
        {/* Main Content */}
        <main
          className={`mx-[12px] h-full flex-none transition-all md:pr-2 ${
            collapsed ? "xl:ml-[96px]" : "xl:ml-[313px]"
          }`}
        >
          {/* Routes */}
          <div className="h-full">
            <Navbar
              onOpenSidenav={toggleSidebar}
              logoText={"Horizon UI Tailwind React"}
              brandText={activePage?.name || "Company Portal"}
              secondary={activePage?.secondary}
              {...rest}
            />
            <div className="pt-5s mx-auto mb-auto h-full min-h-[84vh] p-2 md:pr-2">
              {isPreview && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 p-4 text-sm text-brand-700 dark:bg-navy-700 dark:text-white">
                  <p>
                    {user?.employeePreview
                      ? "Employee preview · Stock checks only · No account has"
                      : "Temporary preview · Employee entries can be saved locally to the database · No account has"}
                    been created
                  </p>
                  <button
                    type="button"
                    onClick={signOut}
                    className="font-bold hover:underline"
                  >
                    Exit preview
                  </button>
                </div>
              )}
              {location.pathname === "/admin" ? (
                <Navigate to={"/admin/" + firstPage} />
              ) : (
                <PageAccess page={activePage?.path || "no-access"}>
                  {activePage?.component}
                </PageAccess>
              )}
            </div>
            <div className="p-3">
              <Footer />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
