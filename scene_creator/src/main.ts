import { setupVirtualFS } from "./fs";
import { initEngine } from "./engine";
import { setupUI } from "./ui";

const canvas = document.getElementById("render-canvas") as HTMLCanvasElement;

setupVirtualFS();
initEngine(canvas);
setupUI();
