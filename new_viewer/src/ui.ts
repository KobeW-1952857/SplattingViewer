import { ElementsData, SceneData, SceneParams } from "./types";
import * as pc from "playcanvas";
import { smoothCameraMove } from "./camera";
import { isUiElementVisible } from "./utils";

function createCompass(app: pc.Application, camera: pc.Entity): void {
  const compass = document.createElement("div");
  compass.id = "coordinate-compass";
  compass.setAttribute("aria-label", "Coordinate system compass");

  const canvas = document.createElement("canvas");
  canvas.className = "coordinate-compass-canvas";
  compass.appendChild(canvas);
  document.body.appendChild(compass);

  const updateCompass = () => {
    const size = compass.clientWidth;
    const pixelRatio = window.devicePixelRatio || 1;
    if (canvas.width !== size * pixelRatio) {
      canvas.width = size * pixelRatio;
      canvas.height = size * pixelRatio;
    }

    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, size, size);

    const center = size / 2;
    const axisLength = size * 0.35;
    const right = camera.right;
    const up = camera.up;
    const forward = camera.forward;
    const axes = [
      { label: "X", color: "#e53935", vector: new pc.Vec3(1, 0, 0) },
      { label: "Y", color: "#8bc34a", vector: new pc.Vec3(0, 1, 0) },
      { label: "Z", color: "#2196f3", vector: new pc.Vec3(0, 0, 1) },
    ]
      .map((axis) => ({
        ...axis,
        x: axis.vector.dot(right) * axisLength,
        y: -axis.vector.dot(up) * axisLength,
        depth: axis.vector.dot(forward),
      }))
      .sort((a, b) => a.depth - b.depth);

    context.lineCap = "round";
    context.lineJoin = "round";
    axes.forEach((axis) => {
      const endX = center + axis.x;
      const endY = center + axis.y;
      const angle = Math.atan2(axis.y, axis.x);
      const opacity = 0.5 + Math.abs(axis.depth) * 0.5;

      context.globalAlpha = opacity;
      context.strokeStyle = axis.color;
      context.lineWidth = 2.5;
      context.beginPath();
      context.moveTo(center, center);
      context.lineTo(endX, endY);
      context.stroke();

      context.fillStyle = axis.color;
      context.beginPath();
      context.moveTo(endX, endY);
      context.lineTo(
        endX - Math.cos(angle - 0.45) * 7,
        endY - Math.sin(angle - 0.45) * 7,
      );
      context.lineTo(
        endX - Math.cos(angle + 0.45) * 7,
        endY - Math.sin(angle + 0.45) * 7,
      );
      context.closePath();
      context.fill();

      context.font = "700 12px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(
        axis.label,
        endX + Math.cos(angle) * 9,
        endY + Math.sin(angle) * 9,
      );
    });

    context.globalAlpha = 1;
    context.fillStyle = "#f5f5f5";
    context.beginPath();
    context.arc(center, center, 2.5, 0, Math.PI * 2);
    context.fill();
  };

  app.on("update", updateCompass);
  compass.addEventListener("DOMNodeRemoved", () =>
    app.off("update", updateCompass),
  );
  updateCompass();
}

function setUiElementVisible(elementId: string, visible: boolean): void {
  const element = document.getElementById(elementId);
  if (element) element.style.display = visible ? "" : "none";
}

function bindDropdown(
  selectId: string,
  options: { text: string; value: any }[],
  onSelectionChange: (value: string) => void,
  placeholder = "Select option...",
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

export function bindMobileMenu(
  mode: SceneParams["mode"],
  onModeChange?: (mode: SceneParams["mode"]) => void,
): void {
  const modeMenu = document.getElementById("mode-menu");
  const button = document.getElementById(
    "mode-menu-button",
  ) as HTMLButtonElement | null;
  if (!modeMenu || !button) return;

  const modes: Array<{
    value: SceneParams["mode"];
    icon: string;
    label: string;
  }> = [
    { value: "normal", icon: "◉", label: "Normal mode" },
    { value: "advanced", icon: "◈", label: "Advanced mode" },
    { value: "debug", icon: "⚙", label: "Debug mode" },
  ];
  const currentIndex = modes.findIndex(({ value }) => value === mode);
  const currentMode = modes[currentIndex] || modes[0];
  const nextMode = modes[(currentIndex + 1) % modes.length];

  button.textContent = currentMode.icon;
  button.dataset.mode = currentMode.value;
  button.setAttribute("aria-label", currentMode.label);
  button.title = currentMode.label;
  button.onclick = () => {
    const params = new URLSearchParams(window.location.search);
    params.set("mode", nextMode.value);
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${params.toString()}`,
    );
    onModeChange?.(nextMode.value);
  };
}

export function createOverlayUI(
  app: pc.Application,
  camera: pc.Entity,
  sceneData: SceneData,
  elementsData: ElementsData,
  sceneParams: SceneParams,
): void {
  const applyMode = (mode: SceneParams["mode"]): void => {
    sceneParams.mode = mode;

    const mobileMenuVisible = isUiElementVisible(
      elementsData,
      "mobileMenu",
      mode,
    );
    setUiElementVisible("mode-menu", mobileMenuVisible);
    if (mobileMenuVisible) bindMobileMenu(mode, applyMode);

    setUiElementVisible(
      "viewpoint-select",
      isUiElementVisible(elementsData, "viewpointSelect", mode),
    );
    setUiElementVisible(
      "lod-select",
      isUiElementVisible(elementsData, "lodSelect", mode),
    );
    setUiElementVisible(
      "render-select",
      isUiElementVisible(elementsData, "renderSelect", mode),
    );
    setUiElementVisible(
      "coordinate-compass",
      isUiElementVisible(elementsData, "compass", mode),
    );
    if (
      isUiElementVisible(elementsData, "compass", mode) &&
      !document.getElementById("coordinate-compass")
    ) {
      createCompass(app, camera);
    }
    setUiElementVisible(
      "debug-panel",
      isUiElementVisible(elementsData, "debugPanel", mode),
    );
    setUiElementVisible(
      "top-right-logo-container",
      isUiElementVisible(elementsData, "logos", mode),
    );
  };

  applyMode(sceneParams.mode);

  const viewpointSelectVisible = isUiElementVisible(
    elementsData,
    "viewpointSelect",
    sceneParams.mode,
  );
  setUiElementVisible("viewpoint-select", viewpointSelectVisible);

  if (
    viewpointSelectVisible &&
    sceneData.viewpoints &&
    sceneData.viewpoints.length > 0
  ) {
    const vpSelect = document.getElementById("viewpoint-select");

    const vpOptions = sceneData.viewpoints.map((vp, index) => ({
      text: vp.name || `Viewpoint ${index + 1}`,
      value: index,
    }));

    bindDropdown(
      "viewpoint-select",
      vpOptions,
      (selectedValue) => {
        const index = parseInt(selectedValue, 10);
        const viewpointData = sceneData.viewpoints?.[index];
        if (viewpointData) {
          const targetPos = new pc.Vec3(...viewpointData.targetPosition);
          const targetLook = new pc.Vec3(...viewpointData.targetLookAt);
          smoothCameraMove(camera, sceneData, targetPos, targetLook);
        }
      },
      "Jump to Location...",
    );
  }

  const lodSelectVisible = isUiElementVisible(
    elementsData,
    "lodSelect",
    sceneParams.mode,
  );
  setUiElementVisible("lod-select", lodSelectVisible);
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
      const gsplatEntities = app.root.findComponents("gsplat");
      gsplatEntities.forEach((gsplat: any) => {
        gsplat.lodRangeMin = numVal;
      });
    },
    "LoD Settings",
  );

  if (lodSelect) {
    lodSelect.value = String(sceneParams.lod);
    lodSelect.dispatchEvent(new Event("change"));
  }

  const renderSelectVisible = isUiElementVisible(
    elementsData,
    "renderSelect",
    sceneParams.mode,
  );
  setUiElementVisible("render-select", renderSelectVisible);
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
    "Render Mode",
  );

  const logoContainer = document.getElementById("top-right-logo-container");
  if (logoContainer && elementsData.logos) {
    elementsData.logos.forEach((logo) => {
      const logoElement = document.createElement("a");
      logoElement.href = logo.link || "#";
      logoElement.target = "_blank";
      logoElement.innerHTML = `<img src="${logo.image}" alt="${logo.alt}" class="logo-img" />`;
      logoContainer.appendChild(logoElement);
    });
  }
}
