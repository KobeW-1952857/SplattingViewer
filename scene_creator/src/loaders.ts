import * as pc from "playcanvas";
import { state } from "./state";
import { virtualFiles } from "./fs";
import { addAssetToList } from "./ui";

export function handleFiles(files: FileList | File[]) {
  const fileArray = Array.from(files);
  const lodMeta = fileArray.find((f) => f.name === "lod-meta.json");

  if (lodMeta) {
    loadSplatFolder(fileArray);
    return;
  }

  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];
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

export function loadModel(file: File) {
  const url = URL.createObjectURL(file);
  state.app!.assets.loadFromUrl(url, "container", (err, asset) => {
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
    state.app!.root.addChild(entity);
    addAssetToList(file.name, `models/${file.name}`, entity, "model", file);
  });
}

export function loadSplatFile(file: File) {
  const url = URL.createObjectURL(file);
  state.app!.assets.loadFromUrl(url, "gsplat", (err, asset) => {
    if (err) {
      console.error(err);
      alert(`Error loading splat: ${(err as any).message || err}`);
      return;
    }
    const entity = new pc.Entity();
    entity.addComponent("gsplat", { asset: asset, unified: true });
    state.app!.root.addChild(entity);
    addAssetToList(file.name, `splats/${file.name}`, entity, "splat", file);
  });
}

export function loadSplatFolder(files: File[]) {
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

    state.app!.assets.loadFromUrl(
      lodMetaVirtualPath,
      "gsplat",
      (err, asset) => {
        if (err) {
          console.error(err);
          alert(`Error loading splat folder: ${(err as any).message || err}`);
          return;
        }
        const entity = new pc.Entity();
        entity.addComponent("gsplat", { asset: asset, unified: true });
        state.app!.root.addChild(entity);

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
      },
    );
  };
  reader.readAsText(lodMetaFile);
}
