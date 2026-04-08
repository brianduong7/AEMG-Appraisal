/**
 * Read-only HR / directory fields — grayed out to show they are not editable
 * (F3 / HR setup), including on the create-appraisal flow.
 */
export function HrReadonlyField({
  label,
  value,
  required: isRequired,
  className,
}: {
  label: string;
  value: string;
  required?: boolean;
  className?: string;
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
    </div>
  );
}
