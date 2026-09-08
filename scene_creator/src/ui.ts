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
const lodFalloffInput = document.getElementById(
  "splat-lod-falloff",
) as HTMLInputElement;
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
    li.className = "asset-item";
    li.style.display = "flex";
    li.style.flexDirection = "column";
    li.style.gap = "4px";
    li.style.marginBottom = "8px";
    li.style.padding = "8px";
    li.style.background = "rgba(0,0,0,0.2)";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";

    header.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <div style="display:flex; flex-direction:column; gap:2px; font-size:10px;">
          <button class="reorder-up" style="background:none; border:none; color:white; cursor:pointer; padding:0; ${i === 0 ? "opacity:0.3; pointer-events:none;" : ""}">▲</button>
          <button class="reorder-down" style="background:none; border:none; color:white; cursor:pointer; padding:0; ${i === state.logos.length - 1 ? "opacity:0.3; pointer-events:none;" : ""}">▼</button>
        </div>
        <strong style="word-break:break-all;">${logo.file.name}</strong>
      </div>
      <span style="color:#f44336;cursor:pointer;font-weight:bold;font-size:16px;">&times;</span>
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
    linkInput.style.padding = "4px";
    linkInput.onchange = (e) => {
      logo.link = (e.target as HTMLInputElement).value;
      updateViewportLogo();
    };

    const altInput = document.createElement("input");
    altInput.type = "text";
    altInput.placeholder = "Alt text";
    altInput.value = logo.alt;
    altInput.style.padding = "4px";
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
      "asset-item" + (i === state.selectedAssetIndex ? " selected" : "");
    li.style.display = "flex";
    li.style.justifyContent = "space-between";
    li.style.alignItems = "center";

    const nameSpan = document.createElement("span");
    nameSpan.textContent = a.name;
    nameSpan.style.flex = "1";
    nameSpan.style.overflow = "hidden";
    nameSpan.style.textOverflow = "ellipsis";
    nameSpan.style.whiteSpace = "nowrap";

    const deleteBtn = document.createElement("span");
    deleteBtn.innerHTML = "&times;";
    deleteBtn.style.color = "#f44336";
    deleteBtn.style.cursor = "pointer";
    deleteBtn.style.fontWeight = "bold";
    deleteBtn.style.fontSize = "16px";
    deleteBtn.style.padding = "0 4px";

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
    transformPanel.style.display = "block";
    assetNameInput.value = state.assets[index].name;
    updateTransformUI();
    if (state.activeGizmo)
      state.activeGizmo.attach([state.assets[index].entity]);
  } else {
    transformPanel.style.display = "none";
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
    splatSettingsPanel.style.display = "block";
    lodFalloffInput.value = (
      a.lodFalloff ??
      (a.entity as any).gsplat.lodFalloff ??
      1
    ).toString();
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

    const distContainer = document.getElementById(
      "splat-lod-distances-container",
    );
    const distList = document.getElementById("splat-lod-distances-list");
    if (distContainer && distList) {
      if (a.lodLevels && a.lodLevels > 0) {
        distContainer.style.display = "block";
        distList.innerHTML = "";

        if (!a.lodDistances) {
          a.lodDistances = Array(a.lodLevels).fill(0);
        }

        for (let i = 0; i < a.lodLevels; i++) {
          const row = document.createElement("div");
          row.style.display = "flex";
          row.style.alignItems = "center";
          row.style.gap = "8px";

          const label = document.createElement("label");
          label.textContent = "LOD " + i;
          label.style.width = "40px";
          label.style.fontSize = "12px";
          label.style.color = "#ccc";

          const input = document.createElement("input");
          input.type = "number";
          input.step = "0.1";
          input.value = (a.lodDistances[i] ?? 0).toString();
          input.style.flex = "1";
          input.style.boxSizing = "border-box";
          input.style.padding = "4px";
          input.style.border = "1px solid #555";
          input.style.background = "#222";
          input.style.color = "#fff";
          input.style.borderRadius = "4px";

          input.onchange = (e) => {
            a.lodDistances![i] =
              parseFloat((e.target as HTMLInputElement).value) || 0;
          };

          row.appendChild(label);
          row.appendChild(input);
          distList.appendChild(row);
        }
      } else {
        distContainer.style.display = "none";
      }
    }
  } else {
    splatSettingsPanel.style.display = "none";
  }
}
