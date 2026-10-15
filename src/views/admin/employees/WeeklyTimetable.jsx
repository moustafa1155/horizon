import WeekSelector from "components/weekSelector";
import Card from "components/card";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { addDays, scheduledHours } from "./helpers.mjs";

const formatDate = (date) =>
  date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default function WeeklyTimetable({
  employee,
  week,
  onWeekChange,
  onWeekSelect,
  onCurrentWeek,
}) {
  const total = scheduledHours(employee.schedule);
  return (
    <Card extra="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-navy-700 dark:text-white">
            Weekly timetable
          </h2>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            {employee.name} · {employee.branch}
          </p>
        </div>
        <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-bold text-brand-500 dark:bg-navy-700 dark:text-white">
          {total} hrs scheduled
        </div>
      </div>
      <div className="my-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-navy-700 dark:text-white">
          {formatDate(week)} – {formatDate(addDays(week, 6))}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous week"
            onClick={() => onWeekChange(-7)}
            className="rounded-lg bg-lightPrimary p-2 text-navy-700 hover:bg-brand-50 focus-visible:outline-brand-500 dark:bg-navy-700 dark:text-white"
          >
            <FiChevronLeft />
          </button>
          <button
            type="button"
            onClick={onCurrentWeek}
            className="rounded-lg bg-lightPrimary px-3 py-2 text-xs font-medium text-navy-700 hover:bg-brand-50 dark:bg-navy-700 dark:text-white"
          >
            This week
          </button>
          <button
            type="button"
            aria-label="Next week"
            onClick={() => onWeekChange(7)}
            className="rounded-lg bg-lightPrimary p-2 text-navy-700 hover:bg-brand-50 focus-visible:outline-brand-500 dark:bg-navy-700 dark:text-white"
          >
            <FiChevronRight />
          </button>
        </div>
      </div>
      <div className="mb-6 flex flex-wrap gap-3">
        <WeekSelector
          value={
            week.getFullYear() +
            "-" +
            String(week.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(week.getDate()).padStart(2, "0")
          }
          onChange={(value) => onWeekSelect(new Date(value + "T12:00:00"))}
          className="rounded-xl border border-gray-200 bg-lightPrimary p-3 text-sm dark:border-white/10 dark:bg-navy-900"
          labelPrefix="Employee timetable"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[440px] text-start text-sm">
          <caption className="sr-only">
            {employee.name}'s weekly work schedule, {formatDate(week)}
          </caption>
          <thead>
            <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-700 dark:border-white/10 dark:text-gray-300">
              <th scope="col" className="pb-3 text-start font-medium">
                Day
              </th>
              <th scope="col" className="pb-3 text-start font-medium">
                Shift
              </th>
              <th scope="col" className="pb-3 text-start font-medium">
                Break
              </th>
              <th scope="col" className="pb-3 text-end font-medium">
                Hours
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 7 }, (_, index) => {
              const date = addDays(week, index);
              const shifts = employee.schedule.filter(
                (shift) => shift.day === index
              );
              return (
                <tr
                  key={index}
                  className="border-b border-gray-100 last:border-0 dark:border-white/10"
                >
                  <th
                    scope="row"
                    className="py-3 text-start font-medium text-navy-700 dark:text-white"
                  >
                    {date.toLocaleDateString("en-GB", { weekday: "short" })}
                    <span className="ms-2 text-xs font-normal text-gray-700 dark:text-gray-300">
                      {date.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </th>
                  <td className="py-3">
                    {shifts.length ? (
                      shifts.map((shift) => (
                        <span
                          key={shift.start}
                          className="inline-block rounded-lg bg-brand-50 px-2 py-1 text-xs font-medium text-brand-500 dark:bg-navy-700 dark:text-brand-200"
                        >
                          {shift.start} – {shift.end}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-700 dark:text-gray-300">
                        No shift recorded
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-gray-700 dark:text-gray-300">
                    {shifts.length
                      ? `${shifts.reduce(
                          (sum, shift) => sum + shift.breakMinutes,
                          0
                        )} min`
                      : "—"}
                  </td>
                  <td className="py-3 text-end font-medium text-navy-700 dark:text-white">
                    {shifts.length ? `${scheduledHours(shifts)} hrs` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-gray-700 dark:text-gray-300">
        Times are local to the branch; scheduled hours exclude unpaid breaks.
      </p>
    </Card>
  );
}
