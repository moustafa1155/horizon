import { useState } from "react";
import Card from "components/card";
import { Link } from "lib/navigation";
import { useAuth } from "../../../contexts/AuthContext";
import useEmployees from "../../../hooks/useEmployees";
import EmployeeFilesDialog from "../employees/EmployeeFilesDialog";
export default function EmployeeFiles() {
  const { can } = useAuth();
  const { records, error, loading } = useEmployees();
  const [query, setQuery] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [uploading, setUploading] = useState(false);
  const visible = records.filter((employee) =>
    (employee.name + " " + employee.email + " " + employee.phone)
      .toLowerCase()
      .includes(query.trim().toLowerCase())
  );
  const employee =
    visible.find((record) => record.id === employeeId) || visible[0];
  return (
    <div className="mt-4 space-y-5 text-navy-700 dark:text-white">
      <Card extra="p-6">
        <h1 className="text-xl font-bold">Employee Files</h1>
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
          Select an employee to upload named files and view their saved
          attachments.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium">
            Find employee
            <input
              type="search"
              value={query}
              disabled={uploading}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, email or phone"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-lightPrimary p-3 disabled:opacity-60 dark:border-white/10 dark:bg-navy-900"
            />
          </label>
          <label className="text-sm font-medium">
            Employee
            <select
              aria-label="Employee for files"
              value={employee?.id || ""}
              disabled={uploading || !visible.length}
              onChange={(event) => setEmployeeId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-lightPrimary p-3 disabled:opacity-60 dark:border-white/10 dark:bg-navy-900"
            >
              {!visible.length && <option value="">No employees found</option>}
              {visible.map((record) => (
                <option key={record.id} value={record.id}>
                  {record.name}
                  {record.email ? " — " + record.email : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-4 text-sm text-red-600 dark:text-red-300"
          >
            {error}
          </p>
        )}
      </Card>
      {loading ? (
        <p role="status">Loading employees…</p>
      ) : employee ? (
        <Card extra="p-6">
          <div className="mb-5 flex items-center gap-3 border-b border-gray-200 pb-4 dark:border-white/10">
            {employee.profilePhotoUrl && (
              <img
                src={employee.profilePhotoUrl}
                alt={employee.name + " profile picture"}
                width={48}
                height={48}
                className="h-12 w-12 rounded-full object-cover"
              />
            )}
            <div>
              <h2 className="font-bold">{employee.name}</h2>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                {employee.email}
              </p>
            </div>
          </div>
          <EmployeeFilesDialog
            key={employee.id}
            employee={employee}
            canUpload={can("employees", "manage")}
            embedded
            onPendingChange={setUploading}
          />
        </Card>
      ) : (
        <Card extra="p-8 text-center">
          <p>
            {records.length
              ? "No employees match your search."
              : "Add an employee to start uploading files."}
          </p>
          <Link
            to="/admin/employees"
            className="mt-4 inline-block text-sm text-brand-600 dark:text-brand-200"
          >
            Go to Staff Details
          </Link>
        </Card>
      )}
    </div>
  );
}
