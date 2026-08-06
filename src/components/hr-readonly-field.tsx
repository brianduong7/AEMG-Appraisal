/**
 * Read-only HR / directory fields — grayed out to show they are not editable
 * (F3 / HR setup), including on the create-appraisal flow.
 */
export function HrReadonlyField({
  label,
  value,
  required: isRequired,
  className,
  hint,
}: {
  label: string;
  value: string;
  required?: boolean;
  className?: string;
  /** Optional warning line under the value, e.g. a stale-snapshot flag. */
  hint?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-zinc-500">
        {label}
        {isRequired && <span className="text-red-500"> *</span>}
      </label>
      <div
        className="cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2.5 text-sm text-zinc-700 select-none"
        aria-readonly="true"
      >
        {value?.trim() ? value : "—"}
      </div>
      {hint && (
        <p className="mt-1 text-xs font-medium text-amber-700">{hint}</p>
      )}
    </div>
  );
}
