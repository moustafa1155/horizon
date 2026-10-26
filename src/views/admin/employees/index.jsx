import useShifts from "../../../hooks/useShifts";
import { scheduleForWeek } from "../staffTimetables/timetableHelpers.mjs";
import { hostedPreview } from "lib/previewMode";
import { useMemo, useState } from "react";
import Card from "components/card";
import { FiSearch, FiUsers, FiMapPin } from "react-icons/fi";
import useEmployees from "../../../hooks/useEmployees";
import { useAuth } from "../../../contexts/AuthContext";
import EmployeeForm from "./EmployeeForm";
import RemoveEmployeeDialog from "./RemoveEmployeeDialog";
import useBranches from "../../../hooks/useBranches";
import { filterEmployees, getWeekStart, addDays } from "./helpers.mjs";
import EmployeeDirectory from "./EmployeeDirectory";
import EmployeeFilesDialog from "./EmployeeFilesDialog";
import WeeklyTimetable from "./WeeklyTimetable";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-lightPrimary px-3 py-3 text-sm text-navy-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-navy-900 dark:text-white";

export default function Employees() {
  const {
    records: employeeRecords,
    error: employeeError,
    save,
    remove,
  } = useEmployees();
  const { can, isPreview, user } = useAuth();
  const [adding, setAdding] = useState(false);
  const [filesEmployee, setFilesEmployee] = useState(null);
  const [removingEmployee, setRemovingEmployee] = useState(null);
  const [notice, setNotice] = useState("");
  const [editingEmployee, setEditingEmployee] = useState(null);
  const { records: branchRecords, branchError } = useBranches();
  const shifts = useShifts();
  const employees = employeeRecords
    .filter(
      (e) =>
        user?.role !== "Branch Manager" ||
        user?.managerPreview ||
        (!!user?.branchId && e.branchId === user.branchId)
    )
    .map((e) => ({
      ...e,
      branch:
        branchRecords.find((b) => b.id === e.branchId)?.name || e.branch || "",
    }));
  const branches = Array.from(
    new Set([
      ...branchRecords
        .filter((record) => !record.removed)
        .map((record) => record.name),
      ...employees.map((employee) => employee.branch),
    ])
  );
  const [branch, setBranch] = useState("all");
  const [role, setRole] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [week, setWeek] = useState(() => getWeekStart());
  const visibleEmployees = useMemo(
    () => filterEmployees(employees, { branch, role, query }),
    [employees, branch, role, query]
  );
  // If a filter hides the selection, show the first matching employee instead.
  const selected =
    visibleEmployees.find((employee) => employee.id === selectedId) ||
    visibleEmployees[0];
  const managers = visibleEmployees.filter(
    (employee) => employee.role === "Branch manager"
  ).length;

  function resetFilters() {
    setBranch("all");
    setRole("all");
    setQuery("");
  }
  return (
    <div className="mt-4 space-y-7">
      {filesEmployee && (
        <EmployeeFilesDialog
          key={filesEmployee.id}
          employee={filesEmployee}
          canUpload={can("employees", "manage")}
          onClose={() => setFilesEmployee(null)}
        />
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-green-50 p-4 text-sm text-green-800"
        >
          {notice}
        </p>
      )}
      {removingEmployee && (
        <RemoveEmployeeDialog
          employee={removingEmployee}
          onCancel={() => setRemovingEmployee(null)}
          onRemove={async (id) => {
            const error = await remove(id);
            if (!error) {
              setNotice(
                `${removingEmployee.name} removed from the employee directory.`
              );
              setRemovingEmployee(null);
              setSelectedId(null);
              if (editingEmployee?.id === id) {
                setAdding(false);
                setEditingEmployee(null);
              }
            }
            return error;
          }}
        />
      )}
      {user?.role === "Branch Manager" &&
        !user?.managerPreview &&
        !user?.branchId && (
          <p className="rounded-xl bg-orange-50 p-4 text-sm text-orange-800">
            Ask an admin to assign your branch in Users & Permissions.
          </p>
        )}
      {shifts.error && (
        <p role="alert" className="text-red-600">
          {shifts.error}
        </p>
      )}
      {employeeError && (
        <p role="alert" className="text-red-600">
          {employeeError}
        </p>
      )}
      {branchError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-300">
          {branchError}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          View employee contact details and add new employees.
        </p>
      </div>
      {user?.role === "Admin" && (can("employees", "manage") || isPreview) && (
        <button
          type="button"
          onClick={() => {
            setEditingEmployee(null);
            setAdding(true);
          }}
          className="rounded-xl bg-brand-500 px-6 py-3 font-medium text-white"
        >
          Add employee
        </button>
      )}
      <p className="text-sm text-gray-700 dark:text-gray-300">
        {hostedPreview
          ? "Preview employees are saved in this browser only."
          : "Employee records are loaded from the database."}
      </p>
      {adding && (
        <EmployeeForm
          allowAssignment={user?.role === "Admin"}
          employee={editingEmployee}
          readOnly={
            !can("employees", "manage") &&
            !(isPreview && user?.role === "Admin")
          }
          onCancel={() => {
            setAdding(false);
            setEditingEmployee(null);
          }}
          onSave={async (draft) => {
            if (
              !can("employees", "manage") &&
              !(isPreview && user?.role === "Admin")
            )
              return "You do not have permission to add employees.";
            const error = await save(draft, editingEmployee?.id);
            if (!error) {
              resetFilters();
              setAdding(false);
            }
            return error;
          }}
        />
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          ["Employees", visibleEmployees.length, FiUsers],
          ["Branch managers", managers, FiUsers],
          [
            "Branches",
            branch === "all"
              ? branchRecords.filter((record) => !record.removed).length
              : 1,
            FiMapPin,
          ],
        ].map(([label, count, Icon]) => (
          <Card key={label} extra="!flex-row items-center gap-4 p-5">
            <div className="rounded-full bg-lightPrimary p-3 text-xl text-brand-500 dark:bg-navy-700 dark:text-white">
              <Icon />
            </div>
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {label}
              </p>
              <p className="text-2xl font-bold text-navy-700 dark:text-white">
                {count}
              </p>
            </div>
          </Card>
        ))}
      </div>
      <Card extra="p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="text-sm font-medium text-navy-700 dark:text-white">
            Branch
            <select
              value={branch}
              disabled={!branches.length}
              onChange={(event) => setBranch(event.target.value)}
              className={`${inputClass} mt-2`}
            >
              <option value="all">
                {branches.length ? "All branches" : "No branches added"}
              </option>
              {branches.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-navy-700 dark:text-white">
            Role
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className={`${inputClass} mt-2`}
            >
              <option value="all">All roles</option>
              <option>Branch manager</option>
              <option>Employee</option>
            </select>
          </label>
          <label className="text-sm font-medium text-navy-700 dark:text-white">
            Search employees
            <div className="relative mt-2">
              <FiSearch
                aria-hidden="true"
                className="pointer-events-none absolute start-3 top-4 text-gray-700"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, ID or email"
                className={`${inputClass} ps-9`}
              />
            </div>
          </label>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p role="status" className="text-xs text-gray-700 dark:text-gray-300">
            Showing {visibleEmployees.length} of {employees.length} employees
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="text-sm font-medium text-brand-500 hover:underline dark:text-brand-200"
          >
            Clear filters
          </button>
        </div>
      </Card>
      <div className="grid grid-cols-1 items-start gap-7">
        <Card extra="p-5">
          <h2 className="mb-1 text-lg font-bold text-navy-700 dark:text-white">
            Employee directory
          </h2>
          <p className="mb-4 text-xs text-gray-700 dark:text-gray-300">
            Select an employee name to view their weekly timetable.
          </p>
          {visibleEmployees.length ? (
            <EmployeeDirectory
              employees={visibleEmployees}
              selectedId={selected?.id}
              onSelect={setSelectedId}
              canEdit={can("employees", "manage")}
              canRemove={user?.role === "Admin" && can("employees", "manage")}
              onEdit={(employee) => {
                setEditingEmployee(employee);
                setAdding(true);
                setNotice("");
              }}
              onAttachments={setFilesEmployee}
              onRemove={(employee) => {
                setNotice("");
                setRemovingEmployee(employee);
              }}
            />
          ) : (
            <div className="py-8 text-center">
              <FiUsers className="mx-auto mb-3 text-3xl text-gray-600" />
              <p className="font-medium text-navy-700 dark:text-white">
                {employees.length ? "No employees found" : "No employees yet"}
              </p>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                {employees.length
                  ? "Try another branch, role or search."
                  : "Employee records will appear here once added."}
              </p>
              {employees.length > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-4 text-sm font-medium text-brand-500 hover:underline dark:text-brand-200"
                >
                  Reset filters
                </button>
              )}
            </div>
          )}
        </Card>
        <div className="space-y-7" aria-live="polite">
          {selected ? (
            <>
              <WeeklyTimetable
                employee={{
                  ...selected,
                  schedule: scheduleForWeek(
                    shifts.records,
                    selected.id,
                    week.getFullYear() +
                      "-" +
                      String(week.getMonth() + 1).padStart(2, "0") +
                      "-" +
                      String(week.getDate()).padStart(2, "0")
                  ),
                }}
                week={week}
                onWeekSelect={setWeek}
                onWeekChange={(days) =>
                  setWeek((current) => addDays(current, days))
                }
                onCurrentWeek={() => setWeek(getWeekStart())}
              />
            </>
          ) : (
            <Card extra="p-10 text-center">
              <h2 className="text-lg font-bold text-navy-700 dark:text-white">
                No employee selected
              </h2>
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                Select an employee from the directory to see their details and
                weekly timetable.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
