import { extractVariableNames } from "../../utils/interpolation";

interface Props {
  text: string;
  variables: Map<string, string>;
}

/**
 * Shows a small pill badge when the input text contains `{{variable}}` placeholders.
 * On hover, a tooltip reveals the resolved value for each detected variable.
 * Variables not found in the active environment are shown as "(undefined)".
 *
 * Renders nothing when no variables are detected.
 */
export default function VariableIndicator({ text, variables }: Props) {
  const names = extractVariableNames(text);
  if (names.length === 0) return null;

  const label = names.length === 1 ? "1 var" : `${names.length} vars`;

  return (
    <div class="relative group/indicator shrink-0 inline-flex">
      {/* Badge */}
      <span
        class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-pm-accent/15 text-pm-accent cursor-default select-none"
        aria-label={`${names.length} variable${names.length === 1 ? "" : "s"} detected`}
      >
        {label}
      </span>

      {/* Tooltip — shown on hover via CSS */}
      <div
        class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 hidden group-hover/indicator:block pointer-events-none"
        role="tooltip"
        aria-hidden="true"
      >
        <div class="bg-pm-bg-elevated border border-pm-border rounded shadow-lg px-3 py-2 min-w-[200px] max-w-[300px]">
          <div class="text-xs font-semibold text-pm-text-secondary mb-1.5 uppercase tracking-wide">
            Variables
          </div>
          <ul class="flex flex-col gap-1">
            {names.map((name) => {
              const resolved = variables.get(name);
              const isDefined = resolved !== undefined;
              return (
                <li key={name} class="flex items-start gap-1.5 text-xs">
                  <span class="font-mono text-pm-accent shrink-0">{name}</span>
                  <span class="text-pm-text-tertiary shrink-0">→</span>
                  {isDefined ? (
                    <span class="font-mono text-pm-text-primary break-all">{resolved}</span>
                  ) : (
                    <span class="text-pm-status-error italic">(undefined)</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        {/* Arrow */}
        <div class="w-2 h-2 bg-pm-bg-elevated border-b border-r border-pm-border rotate-45 mx-auto -mt-1" aria-hidden="true" />
      </div>
    </div>
  );
}
