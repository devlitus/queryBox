import { useSignal } from "@preact/signals";
import Tabs from "../shared/Tabs";
import ParamsTable from "./ParamsTable";
import HeadersTable from "./HeadersTable";
import BodyEditor from "./BodyEditor";
import AuthEditor from "./AuthEditor";
import { requestState } from "../../stores/http-store";

const TAB_IDS = ["params", "headers", "body", "auth"] as const;
type TabId = typeof TAB_IDS[number];

export default function RequestConfigTabs() {
  const activeTab = useSignal<TabId>("params");

  const params = requestState.value.params;
  const headers = requestState.value.headers;

  const enabledParamsCount = params.filter((p) => p.enabled && p.key !== "").length;
  const enabledHeadersCount = headers.filter((h) => h.enabled && h.key !== "").length;

  const tabs = [
    { id: "params",  label: "Params",  count: enabledParamsCount },
    { id: "headers", label: "Headers", count: enabledHeadersCount },
    { id: "body",    label: "Body" },
    { id: "auth",    label: "Auth" },
  ];

  return (
    <Tabs
      tabs={tabs}
      activeTab={activeTab.value}
      onTabChange={(id) => { activeTab.value = id as TabId; }}
      idPrefix="req-"
    >
      <div id="req-tabpanel-params" role="tabpanel" class={`p-4 ${activeTab.value !== "params" ? "hidden" : ""}`}>
        <ParamsTable />
      </div>
      <div id="req-tabpanel-headers" role="tabpanel" class={`p-4 ${activeTab.value !== "headers" ? "hidden" : ""}`}>
        <HeadersTable />
      </div>
      <div id="req-tabpanel-body" role="tabpanel" class={`p-4 ${activeTab.value !== "body" ? "hidden" : ""}`}>
        <BodyEditor />
      </div>
      <div id="req-tabpanel-auth" role="tabpanel" class={`p-4 ${activeTab.value !== "auth" ? "hidden" : ""}`}>
        <AuthEditor />
      </div>
    </Tabs>
  );
}
