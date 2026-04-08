import {
  APPENDIX_LEVELS_DESCENDING,
  FRAMEWORK_BY_LEVEL,
  capabilityTitle,
  typicalRoleForMLevel,
} from "@/lib/capability-framework";
import { CAPABILITY_ORDER, type CapabilityId } from "@/lib/types";

/**
 * Full Appendix 1 — AEMG Capability Framework reference (read-only).
 * Styled to match the orange header + alternating row bands.
 */
export function CapabilityAppendixReference() {
  return (
    <div className="rounded-lg bg-white">
      <div className="border-b border-black px-4 py-3">
        <h3 className="text-base font-bold text-black">
          Appendix 1 — AEMG Capability Framework
        </h3>
        <p className="mt-1 text-xs text-zinc-600">
          Reference only. Ratings above use the row that matches the
          employee&apos;s M level.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] border-collapse text-left text-xs text-black">
          <thead>
            <tr className="bg-orange-500 text-white">
              <th className="border border-black px-2 py-2 font-bold whitespace-nowrap">
                Level
              </th>
              <th className="border border-black px-2 py-2 font-bold min-w-[10rem]">
                Typical Role
              </th>
              {CAPABILITY_ORDER.map((id: CapabilityId) => (
                <th
                  key={id}
                  className="border border-black px-2 py-2 font-bold min-w-[11rem]"
                >
                  {capabilityTitle(id)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {APPENDIX_LEVELS_DESCENDING.map((level) => {
              const row = FRAMEWORK_BY_LEVEL[level];
              const bandEven = level % 2 === 0;
              return (
                <tr
                  key={level}
                  className={bandEven ? "bg-orange-50/90" : "bg-white"}
                >
                  <td className="border border-black px-2 py-2 align-top font-semibold whitespace-nowrap">
                    {level}
                  </td>
                  <td className="border border-black px-2 py-2 align-top leading-snug">
                    {typicalRoleForMLevel(level)}
                  </td>
                  {CAPABILITY_ORDER.map((id: CapabilityId) => (
                    <td
                      key={id}
                      className="border border-black px-2 py-2 align-top leading-snug"
                    >
                      {row?.[id] ?? "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
