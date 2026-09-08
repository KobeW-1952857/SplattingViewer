import JSZip from "jszip";
import { state } from "./state";
import { virtualFiles } from "./fs";
import { saveAs } from "file-saver";

export async function exportScene() {
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
    logos: state.logos.map((logo) => ({
      image: `Assets/Scenes/${sceneName}/logos/${logo.file.name}`,
      link: logo.link,
      alt: logo.alt,
    })),
    camera: {
      position: [
        state.cameraEntity!.getPosition().x,
        state.cameraEntity!.getPosition().y,
        state.cameraEntity!.getPosition().z,
      ],
      lookAt: [0, 0, 0],
    },
  };

  const modelsFolder = zip.folder("models")!;
  const splatsFolder = zip.folder("splats")!;
  const logosFolder = zip.folder("logos")!;

  state.logos.forEach((logo) => {
    logosFolder.file(logo.file.name, logo.file);
  });

  for (const a of state.assets) {
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

  saveAs(content, `${sceneName}.zip`);

  setTimeout(() => {
    progressOverlay.style.display = "none";
    progressBar.style.width = "0%";
    progressText.innerText = "Packaging files (0%)";
  }, 1000);
}
