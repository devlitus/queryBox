import RequestBar from "./RequestBar";
import RequestConfigTabs from "./RequestConfigTabs";

export default function RequestPanel() {
  return (
    <div class="flex flex-col">
      <RequestBar />
      <RequestConfigTabs />
    </div>
  );
}
