import { useRef } from "react";
import { FiGrid, FiHome, FiUser, FiX } from "react-icons/fi";
import { Link } from "lib/navigation";
import { useAuth } from "../../contexts/AuthContext";
import routes from "routes.jsx";

export default function MobileNavigation({ pathname }) {
  const { can, firstPage, user, signOut } = useAuth();
  const work = useRef(null);
  const account = useRef(null);
  const home = "/admin/" + firstPage;

  return <div className="portal-mobile-navigation">
    <nav aria-label="Phone navigation" className="portal-tabbar">
      <Link to={home} aria-current={pathname === home ? "page" : undefined}><FiHome aria-hidden="true" /> Home</Link>
      <button type="button" onClick={() => work.current.showModal()}><FiGrid aria-hidden="true" /> Work</button>
      <button type="button" onClick={() => account.current.showModal()}><FiUser aria-hidden="true" /> Account</button>
    </nav>
    <dialog ref={work} className="portal-sheet" aria-labelledby="mobile-work-title">
      <div className="flex items-center justify-between">
        <h2 id="mobile-work-title" className="text-xl font-bold">Work</h2>
        <button aria-label="Close work menu" type="button" onClick={() => work.current.close()}><FiX aria-hidden="true" /></button>
      </div>
      {routes.filter(route => can(route.path)).map(route => {
        const href = route.layout + "/" + route.path;
        return <Link key={href} to={href} aria-current={pathname === href ? "page" : undefined} onClick={() => work.current.close()}>
          {route.icon} {route.name}
        </Link>;
      })}
    </dialog>
    <dialog ref={account} className="portal-sheet" aria-labelledby="mobile-account-title">
      <div className="flex items-center justify-between">
        <h2 id="mobile-account-title" className="text-xl font-bold">Account</h2>
        <button aria-label="Close account menu" type="button" onClick={() => account.current.close()}><FiX aria-hidden="true" /></button>
      </div>
      <p className="break-words font-semibold">{user?.name}</p>
      <p className="mt-1 text-sm">{user?.role}</p>
      <button type="button" className="mt-4 rounded-xl bg-brand-500 px-5 text-white" onClick={() => { account.current.close(); signOut(); }}>Sign out</button>
    </dialog>
  </div>;
}
