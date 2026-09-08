import * as pc from "playcanvas";
// @ts-ignore
import { CameraControls } from "playcanvas/scripts/esm/camera-controls.mjs";
import JSZip from "jszip";
import { saveAs } from "file-saver";

// Virtual File System for loaded files
const virtualFiles = new Map<string, File>();

const originalGet = pc.http.get.bind(pc.http);
// @ts-ignore
pc.http.get = function (url: string, options: any, callback: any) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }

  if (url.startsWith("mem://")) {
    const cleanUrl = url.split("?")[0];
    const file = virtualFiles.get(cleanUrl);
    if (!file) {
      alert(`Virtual FS Error: Could not find ${cleanUrl} in virtualFiles.`);
      callback(new Error("File not found in virtual FS"));
      return;
    }

    if (options.responseType === "blob") {
      callback(null, file);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (options.responseType === "arraybuffer") {
        callback(null, reader.result);
      } else if (options.responseType === "json") {
        callback(null, JSON.parse(reader.result as string));
      } else if (options.responseType === "document") {
        const parser = new DOMParser();
        callback(
          null,
          parser.parseFromString(reader.result as string, "text/xml"),
        );
      } else {
        callback(null, reader.result);
      }
    };
    reader.onerror = () => callback(reader.error);
    if (options.responseType === "arraybuffer") reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
    return;
  }
  return originalGet(url, options, callback);
};

// State
let app: pc.Application;
let cameraEntity: pc.Entity;
const assets: {
  name: string;
  path: string;
  file?: File;
  virtualFolder?: string;
  entity: pc.Entity;
  type: "model" | "splat";
  lodFalloff?: number;
  lodRangeMin?: number;
  lodRangeMax?: number;
  lodLevels?: number;
  lodDistances?: number[];
}[] = [];
let selectedAssetIndex = -1;
let activeGizmo: any = null;

// UI Elements
const canvas = document.getElementById("render-canvas") as HTMLCanvasElement;
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

assetNameInput.addEventListener("input", (e) => {
  if (selectedAssetIndex >= 0) {
    assets[selectedAssetIndex].name = (e.target as HTMLInputElement).value;
    renderAssetList();
  }
});

const resizer = document.getElementById("resizer") as HTMLDivElement;
const sidebar = document.getElementById("sidebar") as HTMLDivElement;
let isResizing = false;

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

const logos: { file: File; link: string; alt: string }[] = [];

function renderLogoList() {
  logoList.innerHTML = "";
  const viewportLogos = document.getElementById(
    "top-right-logo-container",
  ) as HTMLDivElement;
  if (viewportLogos) viewportLogos.innerHTML = "";

  logos.forEach((logo, i) => {
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
          <button class="reorder-down" style="background:none; border:none; color:white; cursor:pointer; padding:0; ${i === logos.length - 1 ? "opacity:0.3; pointer-events:none;" : ""}">▼</button>
        </div>
        <strong style="word-break:break-all;">${logo.file.name}</strong>
      </div>
      <span style="color:#f44336;cursor:pointer;font-weight:bold;font-size:16px;">&times;</span>
    `;

    if (i > 0) {
      header.querySelector(".reorder-up")!.addEventListener("click", () => {
        [logos[i - 1], logos[i]] = [logos[i], logos[i - 1]];
        renderLogoList();
      });
    }
    if (i < logos.length - 1) {
      header.querySelector(".reorder-down")!.addEventListener("click", () => {
        [logos[i], logos[i + 1]] = [logos[i + 1], logos[i]];
        renderLogoList();
      });
    }

    header.querySelector("span")!.onclick = () => {
      logos.splice(i, 1);
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

function addAssetToList(
  name: string,
  path: string,
  entity: pc.Entity,
  type: "model" | "splat",
  file?: File,
  virtualFolder?: string,
  lodLevels?: number,
) {
  assets.push({ name, path, file, virtualFolder, entity, type, lodLevels });
  renderAssetList();
  selectAsset(assets.length - 1);
}

function renderAssetList() {
  assetList.innerHTML = "";
  assets.forEach((a, i) => {
    const li = document.createElement("li");
    li.className = "asset-item" + (i === selectedAssetIndex ? " selected" : "");
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
      assets.splice(i, 1);
      if (selectedAssetIndex === i) {
        selectAsset(-1);
      } else {
        if (selectedAssetIndex > i) selectedAssetIndex--;
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
  selectedAssetIndex = index;
  renderAssetList();
  if (index >= 0) {
    transformPanel.style.display = "block";
    assetNameInput.value = assets[index].name;
    updateTransformUI();
    if (activeGizmo) activeGizmo.attach([assets[index].entity]);
  } else {
    transformPanel.style.display = "none";
    if (activeGizmo) activeGizmo.detach();
  }
}

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

const applySplatSettings = () => {
  if (selectedAssetIndex < 0) return;
  const a = assets[selectedAssetIndex];
  if (a.type === "splat" && a.entity.gsplat) {
    const falloff = parseFloat(lodFalloffInput.value);
    const min = parseInt(lodMinInput.value, 10);
    const max = parseInt(lodMaxInput.value, 10);

    if (!isNaN(falloff)) {
      a.lodFalloff = falloff;
      a.entity.gsplat.lodFalloff = falloff;
    }
    if (!isNaN(min)) {
      a.lodRangeMin = min;
      a.entity.gsplat.lodRangeMin = min;
    }
    if (!isNaN(max)) {
      a.lodRangeMax = max;
      a.entity.gsplat.lodRangeMax = max;
    }
  }
};

[lodFalloffInput, lodMinInput, lodMaxInput].forEach((input) => {
  input.onchange = applySplatSettings;
  input.oninput = applySplatSettings;
});

function updateTransformUI() {
  if (selectedAssetIndex < 0) return;
  const a = assets[selectedAssetIndex];
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

  if (a.type === "splat" && a.entity.gsplat) {
    splatSettingsPanel.style.display = "block";
    lodFalloffInput.value = (
      a.lodFalloff ??
      a.entity.gsplat.lodFalloff ??
      1
    ).toString();
    lodMinInput.value = (
      a.lodRangeMin ??
      a.entity.gsplat.lodRangeMin ??
      0
    ).toString();
    lodMaxInput.value = (
      a.lodRangeMax ??
      a.entity.gsplat.lodRangeMax ??
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

// @ts-ignore
import { TranslateGizmo, RotateGizmo, ScaleGizmo } from "playcanvas";
function initEngine() {
  app = new pc.Application(canvas, {
    mouse: new pc.Mouse(canvas),
    keyboard: new pc.Keyboard(window),
    graphicsDeviceOptions: {
      alpha: false,
      depth: true,
      antialias: true,
      powerPreference: "high-performance",
    },
  });
  app.start();
  app.setCanvasFillMode(pc.FILLMODE_NONE);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  app.resizeCanvas();

  window.addEventListener("resize", () => app.resizeCanvas());
  const resizeObserver = new ResizeObserver(() => app.resizeCanvas());
  resizeObserver.observe(canvas);

  const light = new pc.Entity("DirectionalLight");
  light.addComponent("light", {
    type: "directional",
    color: new pc.Color(1, 1, 1),
    castShadows: false,
    intensity: 1,
  });
  light.setEulerAngles(45, 30, 0);
  app.root.addChild(light);

  cameraEntity = new pc.Entity("Camera");
  cameraEntity.addComponent("camera", {
    clearColor: new pc.Color(0.2, 0.2, 0.2),
  });
  cameraEntity.addComponent("script");
  app.root.addChild(cameraEntity);
  cameraEntity.setPosition(0, 2, 5);

  app.scripts.add(CameraControls);
  const controls = cameraEntity.script!.create("cameraControls") as any;

  setupGizmos(controls);
  setupEvents();
}

let translateGizmo: any, rotateGizmo: any, scaleGizmo: any;
function setupGizmos(controls: any) {
  const gizmoLayer = new pc.Layer({
    name: "Gizmo",
    clearDepthBuffer: true,
    opaqueSortMode: pc.SORTMODE_NONE,
    transparentSortMode: pc.SORTMODE_NONE,
  });
  app.scene.layers.push(gizmoLayer);
  cameraEntity.camera!.layers = cameraEntity.camera!.layers.concat([
    gizmoLayer.id,
  ]);

  translateGizmo = new TranslateGizmo(cameraEntity.camera!, gizmoLayer);
  rotateGizmo = new RotateGizmo(cameraEntity.camera!, gizmoLayer);
  scaleGizmo = new ScaleGizmo(cameraEntity.camera!, gizmoLayer);

  const onTransformMove = () => updateTransformUI();
  const onTransformStart = () => {
    controls.enabled = false;
  };
  const onTransformEnd = () => {
    controls.enabled = true;
  };

  [translateGizmo, rotateGizmo, scaleGizmo].forEach((gizmo) => {
    gizmo.on("transform:move", onTransformMove);
    gizmo.on("transform:start", onTransformStart);
    gizmo.on("transform:end", onTransformEnd);
  });

  activeGizmo = translateGizmo;

  document.getElementById("tool-translate")!.onclick = (e) => {
    document
      .querySelectorAll(".tool-btn")
      .forEach((el) => el.classList.remove("active"));
    (e.target as HTMLElement).classList.add("active");
    activeGizmo.detach();
    activeGizmo = translateGizmo;
    if (selectedAssetIndex >= 0)
      activeGizmo.attach([assets[selectedAssetIndex].entity]);
  };
  document.getElementById("tool-rotate")!.onclick = (e) => {
    document
      .querySelectorAll(".tool-btn")
      .forEach((el) => el.classList.remove("active"));
    (e.target as HTMLElement).classList.add("active");
    activeGizmo.detach();
    activeGizmo = rotateGizmo;
    if (selectedAssetIndex >= 0)
      activeGizmo.attach([assets[selectedAssetIndex].entity]);
  };
  document.getElementById("tool-scale")!.onclick = (e) => {
    document
      .querySelectorAll(".tool-btn")
      .forEach((el) => el.classList.remove("active"));
    (e.target as HTMLElement).classList.add("active");
    activeGizmo.detach();
    activeGizmo = scaleGizmo;
    if (selectedAssetIndex >= 0)
      activeGizmo.attach([assets[selectedAssetIndex].entity]);
  };
}

function handleFiles(files: FileList) {
  const fileArray = Array.from(files);
  const lodMeta = fileArray.find((f) => f.name === "lod-meta.json");

  if (lodMeta) {
    loadSplatFolder(fileArray);
    return;
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "glb" || ext === "gltf") {
      loadModel(file);
    } else if (ext === "ply" || ext === "splat") {
      loadSplatFile(file);
    } else {
      console.warn("Unsupported file format:", file.name);
    }
  }
}

function loadModel(file: File) {
  const url = URL.createObjectURL(file);
  app.assets.loadFromUrl(url, "container", (err, asset) => {
    if (err) {
      console.error(err);
      alert(`Error loading model: ${(err as any).message || err}`);
      return;
    }
    const entity = new pc.Entity();
    entity.addComponent("model", {
      type: "asset",
      asset: (asset!.resource as any).model || asset,
    });
    app.root.addChild(entity);
    addAssetToList(file.name, `models/${file.name}`, entity, "model", file);
  });
}

function loadSplatFile(file: File) {
  const url = URL.createObjectURL(file);
  app.assets.loadFromUrl(url, "gsplat", (err, asset) => {
    if (err) {
      console.error(err);
      alert(`Error loading splat: ${(err as any).message || err}`);
      return;
    }
    const entity = new pc.Entity();
    entity.addComponent("gsplat", { asset: asset, unified: true });
    app.root.addChild(entity);
    addAssetToList(file.name, `splats/${file.name}`, entity, "splat", file);
  });
}

function loadSplatFolder(files: File[]) {
  const lodMetaFile = files.find((f) => f.name === "lod-meta.json");
  if (!lodMetaFile) return;

  const virtualFolderId = `splat-${Date.now()}`;
  const virtualBasePath = `mem://${virtualFolderId}`;
  let lodMetaVirtualPath = "";

  for (const f of files) {
    const relPath = f.webkitRelativePath || f.name;
    const virtualPath = `${virtualBasePath}/${relPath}`;
    virtualFiles.set(virtualPath, f);
    if (f.name === "lod-meta.json") {
      lodMetaVirtualPath = virtualPath;
    }
  }

  const reader = new FileReader();
  reader.onload = () => {
    const json = JSON.parse(reader.result as string);
    const lodLevels = json.lodLevels || 0;

    app.assets.loadFromUrl(lodMetaVirtualPath, "gsplat", (err, asset) => {
      if (err) {
        console.error(err);
        alert(`Error loading splat folder: ${(err as any).message || err}`);
        return;
      }
      const entity = new pc.Entity();
      entity.addComponent("gsplat", { asset: asset, unified: true });
      app.root.addChild(entity);

      const firstPath = files[0]?.webkitRelativePath;
      const folderName = firstPath ? firstPath.split("/")[0] : "Splat Folder";

      addAssetToList(
        folderName,
        `splats/${lodMetaVirtualPath.substring(virtualBasePath.length + 1)}`,
        entity,
        "splat",
        undefined,
        virtualFolderId,
        lodLevels,
      );
    });
  };
  reader.readAsText(lodMetaFile);
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
        logos.push({
          file: files[i],
          link: "",
          alt: files[i].name.split(".")[0],
        });
      }
      renderLogoList();
    }
  };

  const applyTransform = () => {
    if (selectedAssetIndex < 0) return;
    const entity = assets[selectedAssetIndex].entity;
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

async function exportScene() {
  const sceneName =
    (document.getElementById("scene-name") as HTMLInputElement).value ||
    "MyNewScene";
  const zip = new JSZip();
  console.log("Exporting scene:", sceneName);

  const sceneJson: any = {
    name: sceneName,
    models: [],
    splats: [],
  };

  const elementsJson: any = {
    logos: logos.map((logo) => ({
      image: `Assets/Scenes/${sceneName}/logos/${logo.file.name}`,
      link: logo.link,
      alt: logo.alt,
    })),
    camera: {
      position: [
        cameraEntity.getPosition().x,
        cameraEntity.getPosition().y,
        cameraEntity.getPosition().z,
      ],
      lookAt: [0, 0, 0],
    },
  };

  const modelsFolder = zip.folder("models")!;
  const splatsFolder = zip.folder("splats")!;
  const logosFolder = zip.folder("logos")!;

  logos.forEach((logo) => {
    logosFolder.file(logo.file.name, logo.file);
  });

  for (const a of assets) {
    const p = a.entity.getLocalPosition();
    const r = a.entity.getLocalRotation();
    const s = a.entity.getLocalScale();

    const entry: any = {
      name: a.name.split(".")[0],
      path: a.path,
      position: [p.x, p.y, p.z],
      rotation: [r.x, r.y, r.z, r.w],
      scale: [s.x, s.y, s.z],
    };

    if (a.type === "splat") {
      if (a.lodFalloff !== undefined) entry.lodFalloff = a.lodFalloff;
      if (a.lodRangeMin !== undefined) entry.lodRangeMin = a.lodRangeMin;
      if (a.lodRangeMax !== undefined) entry.lodRangeMax = a.lodRangeMax;
      if (a.lodDistances !== undefined) entry.lodDistances = a.lodDistances;
    }

    if (a.type === "model") {
      sceneJson.models.push(entry);
      modelsFolder.file(a.file!.name, a.file!);
    } else {
      sceneJson.splats.push(entry);
      if (a.virtualFolder) {
        const prefix = `mem://${a.virtualFolder}/`;
        for (const [vPath, f] of virtualFiles.entries()) {
          if (vPath.startsWith(prefix)) {
            const relToSplatRoot = vPath.substring(prefix.length);
            splatsFolder.file(relToSplatRoot, f);
          }
        }
      } else if (a.file) {
        splatsFolder.file(a.file.name, a.file);
      }
    }
  }

  zip.file("scene.json", JSON.stringify(sceneJson, null, 2));
  zip.file("elements.json", JSON.stringify(elementsJson, null, 2));

  const progressOverlay = document.getElementById("export-overlay")!;
  const progressBar = document.getElementById("export-progress-bar")!;
  const progressText = document.getElementById("export-progress-text")!;
  progressOverlay.style.display = "flex";

  const content = await zip.generateAsync({ type: "blob" }, (metadata) => {
    progressBar.style.width = `${metadata.percent}%`;
    progressText.innerText = `Zipping... ${Math.round(metadata.percent)}%`;
  });

  progressOverlay.style.display = "none";
  progressBar.style.width = "0%";

  saveAs(content, `${sceneName}.zip`);
}

window.onload = initEngine;
