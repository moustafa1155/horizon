import { FiEdit2, FiTrash2 } from "react-icons/fi";
export default function EmployeeDirectory({
  employees,
  selectedId,
  onSelect,
  onEdit,
  onRemove,
  canEdit,
  canRemove,
}) {
  return (
    <div
      role="region"
      aria-label="Employee directory table"
      tabIndex={0}
      className="overflow-x-auto rounded-xl border border-gray-200 focus-visible:outline-brand-500 dark:border-white/10"
    >
      <table className="w-full min-w-[1050px] text-left text-sm text-navy-700 dark:text-white">
        <caption className="sr-only">
          Employee contact details, branch, role and staff actions
        </caption>
        <thead className="bg-lightPrimary text-xs text-gray-700 dark:bg-navy-900 dark:text-gray-300">
          <tr>
            {[
              "Full name / employee ID",
              "Phone number",
              "National Insurance number",
              "Email",
              "Branch",
              "Role",
              "Actions",
            ].map((label) => (
              <th
                key={label}
                scope="col"
                className="whitespace-nowrap px-4 py-4 font-semibold"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.length ? (
            employees.map((employee) => (
              <tr
                key={employee.id}
                className={
                  "border-t border-gray-200 dark:border-white/10 " +
                  (selectedId === employee.id
                    ? "bg-brand-50 dark:bg-navy-700"
                    : "hover:bg-lightPrimary dark:hover:bg-navy-700/50")
                }
              >
                <th scope="row" className="min-w-[210px] px-4 py-4 font-normal">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 font-bold text-brand-700 dark:bg-navy-900 dark:text-brand-200">
                      {employee.profilePhotoUrl ? (
                        <img
                          src={employee.profilePhotoUrl}
                          alt={employee.name + " profile picture"}
                          loading="lazy"
                          width={44}
                          height={44}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        employee.name?.trim().charAt(0).toUpperCase()
                      )}
                    </span>
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onSelect(employee.id)}
                        aria-pressed={selectedId === employee.id}
                        aria-label={"View timetable for " + employee.name}
                        className="text-left font-bold text-brand-600 hover:underline focus-visible:outline-brand-500 dark:text-brand-200"
                      >
                        {employee.name}
                      </button>
                      <span className="mt-1 block break-all text-xs text-gray-700 dark:text-gray-300">
                        {employee.id}
                      </span>
                    </div>
                  </div>
                </th>
                <td className="whitespace-nowrap px-4 py-4">
                  {employee.phone ? (
                    <a
                      href={"tel:" + employee.phone.replaceAll(" ", "")}
                      className="hover:underline"
                    >
                      {employee.phone}
                    </a>
                  ) : (
                    ""
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  {employee.nationalInsuranceNumber || ""}
                </td>
                <td className="px-4 py-4">
                  {employee.email ? (
                    <a
                      href={"mailto:" + employee.email}
                      className="break-all text-brand-600 hover:underline dark:text-brand-200"
                    >
                      {employee.email}
                    </a>
                  ) : (
                    ""
                  )}
                </td>
                <td className="px-4 py-4">{employee.branch || ""}</td>
                <td className="whitespace-nowrap px-4 py-4">
                  {employee.role || ""}
                </td>
                <td className="px-4 py-4">
                  <div className="flex gap-2">
                    {canEdit && (
                      <button
                        type="button"
                        aria-label={"Edit " + employee.name}
                        title={"Edit " + employee.name}
                        onClick={() => onEdit(employee)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-lg text-brand-600 hover:bg-brand-100 focus-visible:outline-brand-500 dark:text-brand-200 dark:hover:bg-navy-900"
                      >
                        <FiEdit2 aria-hidden="true" />
                      </button>
                    )}
                    {canRemove && (
                      <button
                        type="button"
                        aria-label={"Remove " + employee.name}
                        title={"Remove " + employee.name}
                        onClick={() => onRemove(employee)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-lg text-red-600 hover:bg-red-50 focus-visible:outline-red-600 dark:text-red-300 dark:hover:bg-navy-900"
                      >
                        <FiTrash2 aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={7}
                className="px-4 py-10 text-center text-gray-700 dark:text-gray-300"
              >
                No employees to display.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
