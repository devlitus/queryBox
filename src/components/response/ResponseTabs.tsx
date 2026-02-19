import { useSignal } from "@preact/signals";
import Tabs from "../shared/Tabs";
import ResponseBody from "./ResponseBody";
import ResponseHeaders from "./ResponseHeaders";

const TAB_IDS = ["body", "headers"] as const;
type TabId = typeof TAB_IDS[number];

const TABS = [
  { id: "body",    label: "Body" },
  { id: "headers", label: "Headers" },
];

export default function ResponseTabs() {
  const activeTab = useSignal<TabId>("body");

  return (
    <Tabs
      tabs={TABS}
      activeTab={activeTab.value}
      onTabChange={(id) => { activeTab.value = id as TabId; }}
      idPrefix="res-"
    >
      <div id="res-tabpanel-body" role="tabpanel" class={`p-4 ${activeTab.value !== "body" ? "hidden" : ""}`}>
        <ResponseBody />
      </div>
      <div id="res-tabpanel-headers" role="tabpanel" class={`p-4 ${activeTab.value !== "headers" ? "hidden" : ""}`}>
        <ResponseHeaders />
      </div>
    </Tabs>
  );
}
