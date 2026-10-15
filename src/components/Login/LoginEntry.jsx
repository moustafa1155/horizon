import { useState } from "react";
import { Navigate } from "lib/navigation";
import Login from "./index";
import SetupAdmin from "./SetupAdmin";
import { useAuth } from "../../contexts/AuthContext";

export default function LoginEntry() {
  const [previewPage, setPreviewPage] = useState("default");
  const {
    user,
    firstPage,
    needsSetup,
    signIn,
    error,
    previewAvailable,
    startPreview,
  } = useAuth();
  function previewEmployees() {
    setPreviewPage("weekly-stock-checks");
    startPreview("Employee");
  }
  function previewManager() { setPreviewPage("default"); startPreview("Branch Manager"); }
  if (error)
    return (
      <main className="min-h-screen bg-lightPrimary p-10 text-navy-700">
        <p role="alert" className="rounded-xl bg-white p-6">
          {error}
        </p>
      </main>
    );
  if (user)
    return (
      <Navigate
        to={`/admin/${
          user.managerPreview ? "employees" : user.employeePreview
            ? "weekly-stock-checks"
            : user.preview
            ? previewPage
            : firstPage
        }`}
        replace
      />
    );
  return needsSetup ? (
    <SetupAdmin onEmployeePreview={previewEmployees} onManagerPreview={previewManager} />
  ) : (
    <Login
      onEmployeePreview={previewAvailable ? previewEmployees : undefined}
      onManagerPreview={previewAvailable ? previewManager : undefined}
      onSignIn={signIn}
      onPreview={previewAvailable ? startPreview : undefined}
    />
  );
}
