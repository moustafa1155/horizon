import { Navigate } from "lib/navigation";
import Login from "./index";
import { useAuth } from "../../contexts/AuthContext";
export default function LoginEntry() {
  const { user, loading, error, signIn, firstPage } = useAuth();
  if (loading) return <p className="p-8">Checking access…</p>;
  if (user) return <Navigate to={"/admin/" + firstPage} replace />;
  return (
    <>
      {error && (
        <p role="alert" className="bg-red-50 p-4 text-red-700">
          {error}
        </p>
      )}
      <Login onSignIn={signIn} />
    </>
  );
}
