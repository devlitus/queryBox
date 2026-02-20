import type { HttpMethod } from "../../types/http";

interface Props {
  method: HttpMethod;
}

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "text-pm-method-get bg-pm-method-get/10",
  POST: "text-pm-method-post bg-pm-method-post/10",
  PUT: "text-pm-method-put bg-pm-method-put/10",
  PATCH: "text-pm-method-patch bg-pm-method-patch/10",
  DELETE: "text-pm-method-delete bg-pm-method-delete/10",
};

export default function MethodBadge({ method }: Props) {
  const colorClass = METHOD_COLORS[method] ?? "text-pm-text-secondary bg-pm-bg-elevated";
  return (
    <span class={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${colorClass}`}>
      {method}
    </span>
  );
}
