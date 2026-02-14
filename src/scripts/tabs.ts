// Custom Element for tab management

class PmTabs extends HTMLElement {
	private triggers: HTMLElement[] = [];
	private panels: HTMLElement[] = [];

	connectedCallback() {
		this.triggers = Array.from(this.querySelectorAll<HTMLElement>("[data-tab]"));
		this.panels = Array.from(this.querySelectorAll<HTMLElement>("[data-panel]"));

		this.triggers.forEach((trigger, index) => {
			// Click handler
			trigger.addEventListener("click", () => {
				this.activateTab(trigger.dataset.tab || "");
			});

			// Keyboard navigation handler
			trigger.addEventListener("keydown", (e) => {
				this.handleKeydown(e, index);
			});
		});
	}

	private activateTab(tabId: string) {
		// Update trigger states
		this.triggers.forEach((t) => {
			if (t.dataset.tab === tabId) {
				t.classList.add("active");
				t.setAttribute("aria-selected", "true");
				t.setAttribute("tabindex", "0");
			} else {
				t.classList.remove("active");
				t.setAttribute("aria-selected", "false");
				t.setAttribute("tabindex", "-1");
			}
		});

		// Update panel states
		this.panels.forEach((p) => {
			if (p.dataset.panel === tabId) {
				p.classList.remove("hidden");
			} else {
				p.classList.add("hidden");
			}
		});
	}

	private handleKeydown(e: KeyboardEvent, currentIndex: number) {
		let newIndex = currentIndex;

		switch (e.key) {
			case "ArrowLeft":
				e.preventDefault();
				newIndex = currentIndex > 0 ? currentIndex - 1 : this.triggers.length - 1;
				break;
			case "ArrowRight":
				e.preventDefault();
				newIndex = currentIndex < this.triggers.length - 1 ? currentIndex + 1 : 0;
				break;
			case "Home":
				e.preventDefault();
				newIndex = 0;
				break;
			case "End":
				e.preventDefault();
				newIndex = this.triggers.length - 1;
				break;
			case "Enter":
			case " ":
				e.preventDefault();
				this.activateTab(this.triggers[currentIndex].dataset.tab || "");
				return;
			default:
				return;
		}

		// Focus and activate new tab
		this.triggers[newIndex].focus();
		this.activateTab(this.triggers[newIndex].dataset.tab || "");
	}
}

if (!customElements.get("pm-tabs")) {
	customElements.define("pm-tabs", PmTabs);
}
