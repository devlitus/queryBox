// Custom Element for tree expand/collapse

class PmTree extends HTMLElement {
	private treeItems: HTMLElement[] = [];

	connectedCallback() {
		const toggles = this.querySelectorAll<HTMLElement>("[data-tree-toggle]");

		// Get all tree items (both toggles and leaf nodes)
		this.treeItems = Array.from(
			this.querySelectorAll<HTMLElement>('[role="treeitem"]')
		);

		toggles.forEach((toggle) => {
			// Click handler
			toggle.addEventListener("click", (e) => {
				e.stopPropagation();
				this.toggleNode(toggle);
			});

			// Keyboard navigation handler
			toggle.addEventListener("keydown", (e) => {
				this.handleKeydown(e, toggle);
			});
		});

		// Add keyboard handlers to leaf nodes (RequestItems)
		this.treeItems.forEach((item) => {
			if (!item.hasAttribute("data-tree-toggle")) {
				item.addEventListener("keydown", (e) => {
					this.handleKeydown(e, item);
				});

				// Make leaf items focusable
				if (!item.hasAttribute("tabindex")) {
					item.setAttribute("tabindex", "0");
				}
			}
		});
	}

	private toggleNode(toggle: HTMLElement) {
		const targetId = toggle.dataset.treeToggle;
		if (!targetId) return;

		const target = this.querySelector<HTMLElement>(`[data-tree-content="${targetId}"]`);
		const chevron = toggle.querySelector<HTMLElement>("[data-chevron]");

		if (target && chevron) {
			const isExpanded = toggle.getAttribute("aria-expanded") === "true";

			// Toggle expanded state
			toggle.setAttribute("aria-expanded", String(!isExpanded));
			target.classList.toggle("hidden");

			// Rotate chevron
			if (isExpanded) {
				chevron.style.transform = "rotate(0deg)";
			} else {
				chevron.style.transform = "rotate(90deg)";
			}
		}
	}

	private handleKeydown(e: KeyboardEvent, currentItem: HTMLElement) {
		const isToggle = currentItem.hasAttribute("data-tree-toggle");
		const isExpanded = currentItem.getAttribute("aria-expanded") === "true";

		switch (e.key) {
			case "ArrowRight":
				e.preventDefault();
				if (isToggle && !isExpanded) {
					// Expand collapsed node
					this.toggleNode(currentItem);
				} else if (isToggle && isExpanded) {
					// Move to first child
					const targetId = currentItem.dataset.treeToggle;
					const target = this.querySelector<HTMLElement>(`[data-tree-content="${targetId}"]`);
					const firstChild = target?.querySelector<HTMLElement>('[role="treeitem"]');
					if (firstChild) {
						firstChild.focus();
					}
				}
				break;

			case "ArrowLeft":
				e.preventDefault();
				if (isToggle && isExpanded) {
					// Collapse expanded node
					this.toggleNode(currentItem);
				} else {
					// Move to parent
					const parent = currentItem.closest('[data-tree-content]')?.previousElementSibling as HTMLElement;
					if (parent && parent.hasAttribute("data-tree-toggle")) {
						parent.focus();
					}
				}
				break;

			case "ArrowDown":
				e.preventDefault();
				this.focusNextVisible();
				break;

			case "ArrowUp":
				e.preventDefault();
				this.focusPreviousVisible();
				break;

			case "Home":
				e.preventDefault();
				this.treeItems[0]?.focus();
				break;

			case "End":
				e.preventDefault();
				const visibleItems = this.getVisibleTreeItems();
				visibleItems[visibleItems.length - 1]?.focus();
				break;

			case "Enter":
			case " ":
				e.preventDefault();
				if (isToggle) {
					this.toggleNode(currentItem);
				} else {
					// Trigger click for leaf nodes
					currentItem.click();
				}
				break;
		}
	}

	private getVisibleTreeItems(): HTMLElement[] {
		return this.treeItems.filter((item) => {
			// Check if item is visible (not inside a hidden container)
			let parent: HTMLElement | null = item.parentElement;
			while (parent && parent !== this) {
				if (parent.classList.contains("hidden")) {
					return false;
				}
				parent = parent.parentElement;
			}
			return true;
		});
	}

	private focusNextVisible() {
		const visibleItems = this.getVisibleTreeItems();
		const currentIndex = visibleItems.findIndex((item) => item === document.activeElement);
		if (currentIndex < visibleItems.length - 1) {
			visibleItems[currentIndex + 1].focus();
		}
	}

	private focusPreviousVisible() {
		const visibleItems = this.getVisibleTreeItems();
		const currentIndex = visibleItems.findIndex((item) => item === document.activeElement);
		if (currentIndex > 0) {
			visibleItems[currentIndex - 1].focus();
		}
	}
}

if (!customElements.get("pm-tree")) {
	customElements.define("pm-tree", PmTree);
}
