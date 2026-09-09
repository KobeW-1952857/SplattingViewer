import * as pc from "playcanvas";
import { state } from "./state";
import { virtualFiles } from "./fs";
import { handleFiles } from "./loaders";
import { translateGizmo, rotateGizmo, scaleGizmo } from "./engine";
import { exportScene } from "./exporter";

// UI Elements
const dropzone = document.getElementById("dropzone") as HTMLDivElement;
const fileInput = document.getElementById("file-input") as HTMLInputElement;
const folderInput = document.getElementById("folder-input") as HTMLInputElement;
const uploadFolderBtn = document.getElementById(
  "upload-folder-btn",
) as HTMLButtonElement;
const assetList = document.getElementById("asset-list") as HTMLUListElement;
const addLogoBtn = document.getElementById("add-logo-btn") as HTMLButtonElement;
const logoInput = document.getElementById("logo-input") as HTMLInputElement;
const logoList = document.getElementById("logo-list") as HTMLUListElement;
const transformPanel = document.getElementById(
  "transform-panel",
) as HTMLDivElement;
const assetNameInput = document.getElementById(
  "asset-name-input",
) as HTMLInputElement;

const posInputs = ["x", "y", "z"].map(
  (axis) => document.getElementById(`pos-${axis}`) as HTMLInputElement,
);
const rotInputs = ["x", "y", "z"].map(
  (axis) => document.getElementById(`rot-${axis}`) as HTMLInputElement,
);
const sclInputs = ["x", "y", "z"].map(
  (axis) => document.getElementById(`scale-${axis}`) as HTMLInputElement,
);

const splatSettingsPanel = document.getElementById(
  "splat-settings-panel",
) as HTMLDivElement;
const splatCountDisplay = document.getElementById(
  "splat-count-display",
) as HTMLElement;
const debugModeSelect = document.getElementById(
  "splat-debug-mode",
) as HTMLSelectElement;
const splatBudgetInput = document.getElementById(
  "splat-budget",
) as HTMLInputElement;
const lodFalloffInput = document.getElementById(
  "splat-lod-falloff",
) as HTMLInputElement;
const lodFalloffValueDisplay = document.getElementById(
  "splat-lod-falloff-value",
) as HTMLElement;
const lodMinInput = document.getElementById(
  "splat-lod-min",
) as HTMLInputElement;
const lodMaxInput = document.getElementById(
  "splat-lod-max",
) as HTMLInputElement;

const resizer = document.getElementById("resizer") as HTMLDivElement;
const sidebar = document.getElementById("sidebar") as HTMLDivElement;
let isResizing = false;

export function setupUI() {
  assetNameInput.addEventListener("input", (e) => {
    if (state.selectedAssetIndex >= 0) {
      state.assets[state.selectedAssetIndex].name = (
        e.target as HTMLInputElement
      ).value;
      renderAssetList();
    }
  });

  resizer.addEventListener("mousedown", () => {
    isResizing = true;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;
    sidebar.style.width = `${e.clientX}px`;
  });

  document.addEventListener("mouseup", () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  });

  [lodFalloffInput, lodMinInput, lodMaxInput].forEach((input) => {
    input.onchange = applySplatSettings;
    input.oninput = applySplatSettings;
  });

  if (state.app && (state.app.scene as any).gsplat) {
    splatBudgetInput.value = (
      (state.app.scene as any).gsplat.splatBudget ?? 3000000
    ).toString();
  }

  const debugLegend = document.getElementById("splat-debug-legend");

  debugModeSelect.onchange = () => {
    if (!state.app || !(state.app.scene as any).gsplat) return;
    const val = debugModeSelect.value;
    let mode: any = (pc as any).GSPLAT_DEBUG_NONE;
    if (val === "lod") mode = (pc as any).GSPLAT_DEBUG_LOD;
    else if (val === "aabbs") mode = (pc as any).GSPLAT_DEBUG_AABBS;
    else if (val === "node_aabbs") mode = (pc as any).GSPLAT_DEBUG_NODE_AABBS;

    (state.app.scene as any).gsplat.debug = mode;

    if (debugLegend) {
      if (val !== "none") {
        debugLegend.classList.remove("hidden");
      } else {
        debugLegend.classList.add("hidden");
      }
    }
  };

  splatBudgetInput.onchange = () => {
    if (!state.app || !(state.app.scene as any).gsplat) return;
    const val = parseInt(splatBudgetInput.value, 10);
    if (!isNaN(val)) {
      (state.app.scene as any).gsplat.splatBudget = val;
    }
  };

  setupEvents();
  setupGizmoTools();
}

function setupEvents() {
  dropzone.ondragover = (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  };
  dropzone.ondragleave = () => dropzone.classList.remove("dragover");
  dropzone.ondrop = (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files);
  };
  dropzone.onclick = () => fileInput.click();
  fileInput.onchange = () => {
    if (fileInput.files) handleFiles(fileInput.files);
  };
  uploadFolderBtn.onclick = () => folderInput.click();
  folderInput.onchange = () => {
    if (folderInput.files) handleFiles(folderInput.files);
  };
  addLogoBtn.onclick = () => logoInput.click();
  logoInput.onchange = (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        state.logos.push({
          file: files[i],
          link: "",
          alt: files[i].name.split(".")[0],
        });
      }
      renderLogoList();
    }
  };

  const applyTransform = () => {
    if (state.selectedAssetIndex < 0) return;
    const entity = state.assets[state.selectedAssetIndex].entity;
    entity.setLocalPosition(
      parseFloat(posInputs[0].value),
      parseFloat(posInputs[1].value),
      parseFloat(posInputs[2].value),
    );
    entity.setLocalEulerAngles(
      parseFloat(rotInputs[0].value),
      parseFloat(rotInputs[1].value),
      parseFloat(rotInputs[2].value),
    );
    entity.setLocalScale(
      parseFloat(sclInputs[0].value),
      parseFloat(sclInputs[1].value),
      parseFloat(sclInputs[2].value),
    );
  };

  [...posInputs, ...rotInputs, ...sclInputs].forEach((input) => {
    input.onchange = applyTransform;
    input.oninput = applyTransform;
  });

  document.getElementById("export-btn")!.onclick = exportScene;
}

function setupGizmoTools() {
  document.getElementById("tool-translate")!.onclick = (e) => {
    document
      .querySelectorAll(".tool-btn")
      .forEach((el) => el.classList.remove("active"));
    (e.target as HTMLElement).classList.add("active");
    if (state.activeGizmo) state.activeGizmo.detach();
    state.activeGizmo = translateGizmo;
    if (state.selectedAssetIndex >= 0)
      state.activeGizmo.attach([state.assets[state.selectedAssetIndex].entity]);
  };
  document.getElementById("tool-rotate")!.onclick = (e) => {
    document
      .querySelectorAll(".tool-btn")
      .forEach((el) => el.classList.remove("active"));
    (e.target as HTMLElement).classList.add("active");
    if (state.activeGizmo) state.activeGizmo.detach();
    state.activeGizmo = rotateGizmo;
    if (state.selectedAssetIndex >= 0)
      state.activeGizmo.attach([state.assets[state.selectedAssetIndex].entity]);
  };
  document.getElementById("tool-scale")!.onclick = (e) => {
    document
      .querySelectorAll(".tool-btn")
      .forEach((el) => el.classList.remove("active"));
    (e.target as HTMLElement).classList.add("active");
    if (state.activeGizmo) state.activeGizmo.detach();
    state.activeGizmo = scaleGizmo;
    if (state.selectedAssetIndex >= 0)
      state.activeGizmo.attach([state.assets[state.selectedAssetIndex].entity]);
  };
}

export function renderLogoList() {
  logoList.innerHTML = "";
  const viewportLogos = document.getElementById(
    "top-right-logo-container",
  ) as HTMLDivElement;
  if (viewportLogos) viewportLogos.innerHTML = "";

  state.logos.forEach((logo, i) => {
    const li = document.createElement("li");
    li.className = "asset-item logo-item";

    const header = document.createElement("div");
    header.className = "logo-item-header";

    header.innerHTML = `
      <div class="logo-controls">
        <div class="logo-reorder">
          <button class="reorder-up ${i === 0 ? "disabled" : ""}">▲</button>
          <button class="reorder-down ${i === state.logos.length - 1 ? "disabled" : ""}">▼</button>
        </div>
        <strong style="word-break:break-all;">${logo.file.name}</strong>
      </div>
      <span class="logo-delete">&times;</span>
    `;

    if (i > 0) {
      header.querySelector(".reorder-up")!.addEventListener("click", () => {
        [state.logos[i - 1], state.logos[i]] = [
          state.logos[i],
          state.logos[i - 1],
        ];
        renderLogoList();
      });
    }
    if (i < state.logos.length - 1) {
      header.querySelector(".reorder-down")!.addEventListener("click", () => {
        [state.logos[i], state.logos[i + 1]] = [
          state.logos[i + 1],
          state.logos[i],
        ];
        renderLogoList();
      });
    }

    header.querySelector("span")!.onclick = () => {
      state.logos.splice(i, 1);
      renderLogoList();
    };

    const updateViewportLogo = () => renderLogoList();

    const linkInput = document.createElement("input");
    linkInput.type = "text";
    linkInput.placeholder = "Link URL (https://...)";
    linkInput.value = logo.link;
    linkInput.className = "logo-input-field";
    linkInput.onchange = (e) => {
      logo.link = (e.target as HTMLInputElement).value;
      updateViewportLogo();
    };

    const altInput = document.createElement("input");
    altInput.type = "text";
    altInput.placeholder = "Alt text";
    altInput.value = logo.alt;
    altInput.className = "logo-input-field";
    altInput.onchange = (e) => {
      logo.alt = (e.target as HTMLInputElement).value;
      updateViewportLogo();
    };

    li.appendChild(header);
    li.appendChild(linkInput);
    li.appendChild(altInput);
    logoList.appendChild(li);

    if (viewportLogos) {
      const logoAnchor = document.createElement("a");
      logoAnchor.href = logo.link || "#";
      logoAnchor.target = "_blank";
      const objectUrl = URL.createObjectURL(logo.file);
      logoAnchor.innerHTML = `<img src="${objectUrl}" alt="${logo.alt}" title="${logo.alt}" class="logo-img" />`;
      viewportLogos.appendChild(logoAnchor);
    }
  });
}

export function addAssetToList(
  name: string,
  path: string,
  entity: pc.Entity,
  type: "model" | "splat",
  file?: File,
  virtualFolder?: string,
  lodLevels?: number,
) {
  state.assets.push({
    name,
    path,
    file,
    virtualFolder,
    entity,
    type,
    lodLevels,
  });
  renderAssetList();
  selectAsset(state.assets.length - 1);
}

export function renderAssetList() {
  assetList.innerHTML = "";
  state.assets.forEach((a, i) => {
    const li = document.createElement("li");
    li.className =
      "asset-item asset-item-container" +
      (i === state.selectedAssetIndex ? " selected" : "");

    const nameSpan = document.createElement("span");
    nameSpan.textContent = a.name;
    nameSpan.className = "asset-name-span";

    const deleteBtn = document.createElement("span");
    deleteBtn.innerHTML = "&times;";
    deleteBtn.className = "asset-delete-btn";

    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      a.entity.destroy();
      if (a.virtualFolder) {
        const prefix = `mem://${a.virtualFolder}/`;
        for (const key of virtualFiles.keys()) {
          if (key.startsWith(prefix)) virtualFiles.delete(key);
        }
      }
      state.assets.splice(i, 1);
      if (state.selectedAssetIndex === i) {
        selectAsset(-1);
      } else {
        if (state.selectedAssetIndex > i) state.selectedAssetIndex--;
        renderAssetList();
      }
    };

    li.appendChild(nameSpan);
    li.appendChild(deleteBtn);
    li.onclick = () => selectAsset(i);
    assetList.appendChild(li);
  });
}

function selectAsset(index: number) {
  state.selectedAssetIndex = index;
  renderAssetList();
  if (index >= 0) {
    transformPanel.classList.remove("hidden");
    assetNameInput.value = state.assets[index].name;
    updateTransformUI();
    if (state.activeGizmo)
      state.activeGizmo.attach([state.assets[index].entity]);
  } else {
    transformPanel.classList.add("hidden");
    if (state.activeGizmo) state.activeGizmo.detach();
  }
}

const applySplatSettings = () => {
  if (state.selectedAssetIndex < 0) return;
  const a = state.assets[state.selectedAssetIndex];
  if (a.type === "splat" && (a.entity as any).gsplat) {
    const falloff = parseFloat(lodFalloffInput.value);
    const min = parseInt(lodMinInput.value, 10);
    const max = parseInt(lodMaxInput.value, 10);

    if (!isNaN(falloff)) {
      a.lodFalloff = falloff;
      (a.entity as any).gsplat.lodFalloff = falloff;
      if (lodFalloffValueDisplay)
        lodFalloffValueDisplay.textContent = falloff.toFixed(1);
    }
    if (!isNaN(min)) {
      a.lodRangeMin = min;
      (a.entity as any).gsplat.lodRangeMin = min;
    }
    if (!isNaN(max)) {
      a.lodRangeMax = max;
      (a.entity as any).gsplat.lodRangeMax = max;
    }
  }
};

export function updateTransformUI() {
  if (state.selectedAssetIndex < 0) return;
  const a = state.assets[state.selectedAssetIndex];
  const entity = a.entity;

  const p = entity.getLocalPosition();
  const r = entity.getLocalEulerAngles();
  const s = entity.getLocalScale();

  posInputs[0].value = p.x.toFixed(3);
  posInputs[1].value = p.y.toFixed(3);
  posInputs[2].value = p.z.toFixed(3);
  rotInputs[0].value = r.x.toFixed(3);
  rotInputs[1].value = r.y.toFixed(3);
  rotInputs[2].value = r.z.toFixed(3);
  sclInputs[0].value = s.x.toFixed(3);
  sclInputs[1].value = s.y.toFixed(3);
  sclInputs[2].value = s.z.toFixed(3);

  if (a.type === "splat" && (a.entity as any).gsplat) {
    splatSettingsPanel.classList.remove("hidden");

    let splatCount = 0;
    try {
      const gsplatComponent = (a.entity as any).gsplat;
      const resource =
        gsplatComponent?.resource ||
        gsplatComponent?.asset?.resource ||
        gsplatComponent?.instance?.splat;
      if (resource?.numSplats !== undefined) splatCount = resource.numSplats;
      else if (resource?.device?.numSplats !== undefined)
        splatCount = resource.device.numSplats;
    } catch (e) {
      console.error(e);
    }
    splatCountDisplay.textContent = splatCount.toLocaleString();

    const falloffVal = a.lodFalloff ?? (a.entity as any).gsplat.lodFalloff ?? 1;
    lodFalloffInput.value = falloffVal.toString();
    if (lodFalloffValueDisplay)
      lodFalloffValueDisplay.textContent = falloffVal.toFixed(1);
    lodMinInput.value = (
      a.lodRangeMin ??
      (a.entity as any).gsplat.lodRangeMin ??
      0
    ).toString();
    lodMaxInput.value = (
      a.lodRangeMax ??
      (a.entity as any).gsplat.lodRangeMax ??
      99
    ).toString();
  } else {
    splatSettingsPanel.classList.add("hidden");
  }
}
