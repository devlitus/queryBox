// Custom Element for sidebar resize handle

const MIN_WIDTH = 180; // px
const MAX_WIDTH = 600; // px
const DEFAULT_WIDTH = 320; // px — matches former w-80 (20rem at 16px base)
const STORAGE_KEY = "qb:sidebar-width";

class PmSidebarResize extends HTMLElement {
	private aside: HTMLElement | null = null;
	private startX = 0;
	private startWidth = 0;

	private readonly onPointerMove = (e: PointerEvent) => {
		if (!this.aside) return;
		const newWidth = Math.min(
			MAX_WIDTH,
			Math.max(MIN_WIDTH, this.startWidth + (e.clientX - this.startX)),
		);
		this.aside.style.width = `${newWidth}px`;
	};

	private readonly onPointerUp = (e: PointerEvent) => {
		this.releasePointerCapture(e.pointerId);
		this.removeEventListener("pointermove", this.onPointerMove);
		this.removeEventListener("pointerup", this.onPointerUp);
		document.body.classList.remove("select-none");
		if (this.aside) {
			this.aside.removeAttribute("data-resizing");
			localStorage.setItem(STORAGE_KEY, String(this.aside.offsetWidth));
		}
	};

	connectedCallback() {
		this.aside = document.querySelector("aside");

		// Restore saved width from localStorage, clamped within bounds
		const saved = localStorage.getItem(STORAGE_KEY);
		const savedWidth = saved !== null ? Number(saved) : NaN;
		const initialWidth = Number.isFinite(savedWidth)
			? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, savedWidth))
			: DEFAULT_WIDTH;

		if (this.aside) {
			this.aside.style.width = `${initialWidth}px`;
		}

		// Register drag start
		this.addEventListener("pointerdown", this.onPointerDown);

		// Double-click resets to default width
		this.addEventListener("dblclick", this.onDblClick);
	}

	disconnectedCallback() {
		this.removeEventListener("pointerdown", this.onPointerDown);
		this.removeEventListener("dblclick", this.onDblClick);
	}

	private readonly onPointerDown = (e: PointerEvent) => {
		if (!this.aside) return;
		e.preventDefault();

		this.setPointerCapture(e.pointerId);
		this.startX = e.clientX;
		this.startWidth = this.aside.offsetWidth;

		document.body.classList.add("select-none");
		this.aside.setAttribute("data-resizing", "");

		this.addEventListener("pointermove", this.onPointerMove);
		this.addEventListener("pointerup", this.onPointerUp);
	};

	private readonly onDblClick = () => {
		if (!this.aside) return;
		this.aside.style.width = `${DEFAULT_WIDTH}px`;
		localStorage.setItem(STORAGE_KEY, String(DEFAULT_WIDTH));
	};
}

if (!customElements.get("pm-sidebar-resize")) {
	customElements.define("pm-sidebar-resize", PmSidebarResize);
}
