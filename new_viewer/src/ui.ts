import { SceneData, SceneParams } from "./types";
import * as pc from "playcanvas";
import { smoothCameraMove } from "./camera";

function bindDropdown(
  selectId: string,
  options: { text: string; value: any }[],
  onSelectionChange: (value: string) => void,
  placeholder = "Select option..."
): HTMLSelectElement | null {
  const select = document.getElementById(selectId) as HTMLSelectElement | null;
  if (!select) return null;

  select.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.text = placeholder;
  defaultOption.value = "__default__";
  defaultOption.selected = true;
  defaultOption.disabled = true;
  select.appendChild(defaultOption);

  options.forEach((opt) => {
    const optionEl = document.createElement("option");
    optionEl.text = opt.text;
    optionEl.value = String(opt.value);
    select.appendChild(optionEl);
  });

  select.addEventListener("change", (e) => {
    const val = (e.target as HTMLSelectElement).value;
    if (val !== "__default__") {
      onSelectionChange(val);
      select.blur();
    }
  });

  ["mousedown", "touchstart", "mousemove"].forEach((evt) => {
    select.addEventListener(evt, (e) => e.stopPropagation());
  });

  return select;
}

export function bindMobileMenu(): void {
  const btn = document.getElementById("mobile-menu-btn");
  if (!btn) return;

  let isOpen = false;
  const toggleMenu = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();

    isOpen = !isOpen;
    if (isOpen) {
      document.body.classList.add("menu-open");
      btn.innerHTML = "✕";
      btn.style.background = "#ffcccc";
    } else {
      document.body.classList.remove("menu-open");
      btn.innerHTML = "☰";
      btn.style.background = "rgba(255, 255, 255, 0.9)";
    }
  };

  btn.addEventListener("click", toggleMenu);
  btn.addEventListener("touchstart", toggleMenu, { passive: false });
}

export function createOverlayUI(
  app: pc.Application,
  camera: pc.Entity,
  sceneData: SceneData,
  sceneParams: SceneParams
): void {
  bindMobileMenu();

  if (sceneData.viewpoints && sceneData.viewpoints.length > 0) {
    const vpSelect = document.getElementById("viewpoint-select");
    if (vpSelect) vpSelect.style.display = "block";

    const vpOptions = sceneData.viewpoints.map((vp, index) => ({
      text: vp.name || `Viewpoint ${index + 1}`,
      value: index,
    }));

    bindDropdown("viewpoint-select", vpOptions, (selectedValue) => {
      const index = parseInt(selectedValue, 10);
      const viewpointData = sceneData.viewpoints?.[index];
      if (viewpointData) {
        const targetPos = new pc.Vec3(...viewpointData.targetPosition);
        const targetLook = new pc.Vec3(...viewpointData.targetLookAt);
        smoothCameraMove(camera, sceneData, targetPos, targetLook);
      }
    }, "Jump to Location...");
  }

  const lodSelect = bindDropdown(
    "lod-select",
    [
      { text: "Desktop Max (0-5)", value: 0 },
      { text: "Desktop (1-5)", value: 1 },
      { text: "Mobile Max (2-5)", value: 2 },
      { text: "Mobile (3-5)", value: 3 },
    ],
    (val) => {
      const numVal = parseInt(val, 10);
      sceneParams.lod = numVal;
      const gsplatSettings = (app.scene as any).gsplat;
      if (gsplatSettings) {
        gsplatSettings.lodRangeMin = numVal;
        gsplatSettings.lodRangeMax = 5;
      }
    },
    "LoD Settings"
  );

  if (lodSelect) {
    lodSelect.value = String(sceneParams.lod);
    lodSelect.dispatchEvent(new Event("change"));
  }

  bindDropdown(
    "render-select",
    [
      { text: "Render Color", value: 0 },
      { text: "Render LoD", value: 1 },
    ],
    (val) => {
      const gsplatSettings = (app.scene as any).gsplat;
      if (gsplatSettings) {
        gsplatSettings.colorizeLod = parseInt(val, 10) === 1;
      }
    },
    "Render Mode"
  );
}