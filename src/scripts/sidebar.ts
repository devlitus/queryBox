// Custom Element for sidebar toggle

class PmSidebarToggle extends HTMLElement {
	private sidebar: HTMLElement | null = null;
	private isCollapsed = false;

	connectedCallback() {
		// Find sidebar in the document
		this.sidebar = document.querySelector("aside");

		// Handle toggle button clicks
		this.addEventListener("click", () => {
			this.toggle();
		});

		// Load saved state from localStorage
		const saved = localStorage.getItem("sidebar-collapsed");
		if (saved === "true") {
			this.collapse();
		}
	}

	private toggle() {
		if (this.isCollapsed) {
			this.expand();
		} else {
			this.collapse();
		}
	}

	private collapse() {
		if (!this.sidebar) return;
		this.isCollapsed = true;
		this.sidebar.classList.add("collapsed");
		this.setAttribute("aria-expanded", "false");
		localStorage.setItem("sidebar-collapsed", "true");
	}

	private expand() {
		if (!this.sidebar) return;
		this.isCollapsed = false;
		this.sidebar.classList.remove("collapsed");
		this.setAttribute("aria-expanded", "true");
		localStorage.setItem("sidebar-collapsed", "false");
	}
}

if (!customElements.get("pm-sidebar-toggle")) {
	customElements.define("pm-sidebar-toggle", PmSidebarToggle);
}
