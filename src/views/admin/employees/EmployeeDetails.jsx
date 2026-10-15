import Card from "components/card";
import { initials } from "./helpers.mjs";

export default function EmployeeDetails({ employee, manager }) {
  const details = [['Employee ID',employee.id],['National Insurance number',employee.nationalInsuranceNumber || 'Not provided']];
  return (
    <Card extra="p-6">
      <h2 className="mb-5 text-lg font-bold text-navy-700 dark:text-white">
        Employee details
      </h2>
      <div className="flex items-center gap-4">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl font-bold text-brand-500 dark:bg-navy-700 dark:text-white"
          aria-hidden="true"
        >
          {initials(employee.name)}
        </div>
        <div>
          <h3 className="text-xl font-bold text-navy-700 dark:text-white">
            {employee.name}
          </h3>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            {employee.title}
          </p>
        </div>
      </div>
      <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-6 border-t border-gray-200 pt-5 dark:border-white/10 sm:grid-cols-2 xl:grid-cols-3">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-gray-700 dark:text-gray-300">
              {label}
            </dt>
            <dd className="mt-1 text-sm font-medium text-navy-700 dark:text-white">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 space-y-2 border-t border-gray-200 pt-5 text-sm dark:border-white/10">
        <div>
          <p className="text-xs text-gray-700 dark:text-gray-300">Email</p>
          <a
            className="break-all text-brand-500 hover:underline dark:text-brand-200"
            href={`mailto:${employee.email}`}
          >
            {employee.email}
          </a>
        </div>
        <div>
          <p className="text-xs text-gray-700 dark:text-gray-300">Phone</p>
          <a
            className="text-navy-700 hover:underline dark:text-white"
            href={`tel:${employee.phone.replaceAll(" ", "")}`}
          >
            {employee.phone || "Not provided"}
          </a>
        </div>
      </div>
    </Card>
  );
}
