// Custom Element for dropdown menus

class PmDropdown extends HTMLElement {
	private trigger: HTMLElement | null = null;
	private panel: HTMLElement | null = null;
	private options: HTMLElement[] = [];
	private isOpen = false;
	private currentIndex = -1;

	connectedCallback() {
		this.trigger = this.querySelector<HTMLElement>("[data-dropdown-trigger]");
		this.panel = this.querySelector<HTMLElement>("[data-dropdown-panel]");

		if (!this.trigger || !this.panel) return;

		// Get all options (buttons) inside the panel
		this.options = Array.from(this.panel.querySelectorAll<HTMLElement>("button"));

		// Toggle dropdown on trigger click
		this.trigger.addEventListener("click", (e) => {
			e.stopPropagation();
			this.toggle();
		});

		// Keyboard navigation on trigger
		this.trigger.addEventListener("keydown", (e) => {
			if (e.key === "ArrowDown" || e.key === "ArrowUp") {
				e.preventDefault();
				this.open();
				this.currentIndex = 0;
				this.focusOption(0);
			}
		});

		// Add keyboard handlers to each option
		this.options.forEach((option, index) => {
			option.addEventListener("keydown", (e) => {
				this.handleOptionKeydown(e, index);
			});

			option.addEventListener("click", () => {
				this.close();
				this.trigger?.focus();
			});
		});

		// Close dropdown when clicking outside
		document.addEventListener("click", (e) => {
			if (this.isOpen && !this.contains(e.target as Node)) {
				this.close();
			}
		});

		// Close dropdown on Escape key
		document.addEventListener("keydown", (e) => {
			if (e.key === "Escape" && this.isOpen) {
				this.close();
				this.trigger?.focus();
			}
		});
	}

	private toggle() {
		if (this.isOpen) {
			this.close();
		} else {
			this.open();
		}
	}

	private open() {
		if (!this.panel || !this.trigger) return;
		this.isOpen = true;
		this.panel.classList.remove("hidden");
		this.trigger.setAttribute("aria-expanded", "true");
	}

	private close() {
		if (!this.panel || !this.trigger) return;
		this.isOpen = false;
		this.panel.classList.add("hidden");
		this.trigger.setAttribute("aria-expanded", "false");
		this.currentIndex = -1;
	}

	private focusOption(index: number) {
		if (index >= 0 && index < this.options.length) {
			this.options[index].focus();
		}
	}

	private handleOptionKeydown(e: KeyboardEvent, currentIndex: number) {
		let newIndex = currentIndex;

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				newIndex = currentIndex < this.options.length - 1 ? currentIndex + 1 : 0;
				this.currentIndex = newIndex;
				this.focusOption(newIndex);
				break;
			case "ArrowUp":
				e.preventDefault();
				newIndex = currentIndex > 0 ? currentIndex - 1 : this.options.length - 1;
				this.currentIndex = newIndex;
				this.focusOption(newIndex);
				break;
			case "Home":
				e.preventDefault();
				this.currentIndex = 0;
				this.focusOption(0);
				break;
			case "End":
				e.preventDefault();
				this.currentIndex = this.options.length - 1;
				this.focusOption(this.options.length - 1);
				break;
			case "Enter":
			case " ":
				e.preventDefault();
				this.options[currentIndex].click();
				break;
			case "Tab":
				// Allow Tab to close the dropdown and move focus naturally
				this.close();
				break;
		}
	}
}

if (!customElements.get("pm-dropdown")) {
	customElements.define("pm-dropdown", PmDropdown);
}
