import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  page.on("console", (msg) => console.log("PAGE LOG:", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("requestfailed", (request) =>
    console.log(
      `REQUEST FAILED: ${request.url()} - ${request.failure()?.errorText}`,
    ),
  );
  page.on("dialog", async (dialog) => {
    console.log("DIALOG:", dialog.message());
    await dialog.dismiss();
  });

  console.log("Navigating to http://localhost:5173");
  await page.goto("http://localhost:5173", { waitUntil: "networkidle2" });

  console.log("Uploading real DFLInkomhal folder...");

  const folderPath = path.resolve(
    "../new_viewer/public/Assets/Splats/DFLInkomhal",
  );
  // Read files
  const filePaths = [];
  const getFiles = (dir) => {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) getFiles(p);
      else filePaths.push(p);
    }
  };
  getFiles(folderPath);

  // Only upload the first few files to save memory, maybe lod-meta.json and 0_0
  const essentialFiles = filePaths.filter(
    (p) => p.includes("lod-meta.json") || p.includes("0_0"),
  );

  const filesData = essentialFiles.map((p) => ({
    name: path.basename(p),
    webkitRelativePath: path
      .relative(path.dirname(folderPath), p)
      .replace(/\\/g, "/"),
    contentBase64: fs.readFileSync(p).toString("base64"),
    type: p.endsWith(".json") ? "application/json" : "application/octet-stream",
  }));

  await page.evaluate(async (filesData) => {
    const dt = new DataTransfer();

    for (const fd of filesData) {
      const res = await fetch(
        "data:" + fd.type + ";base64," + fd.contentBase64,
      );
      const blob = await res.blob();
      const file = new File([blob], fd.name, { type: fd.type });
      Object.defineProperty(file, "webkitRelativePath", {
        value: fd.webkitRelativePath,
      });
      dt.items.add(file);
    }

    const input = document.getElementById("folder-input");
    input.files = dt.files;
    input.dispatchEvent(new Event("change"));
  }, filesData);

  await new Promise((r) => setTimeout(r, 5000));
  await browser.close();
})();
