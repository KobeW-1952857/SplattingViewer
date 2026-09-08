import puppeteer from "puppeteer";

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
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

  console.log("Uploading folder...");
  await page.evaluate(() => {
    const f1 = new File(['{"lods":{"0":{"file":"1_0"}}}'], "lod-meta.json", {
      type: "application/json",
    });
    const f2 = new File(["123"], "meta.json", { type: "application/json" });

    Object.defineProperty(f1, "webkitRelativePath", {
      value: "test/lod-meta.json",
    });
    Object.defineProperty(f2, "webkitRelativePath", {
      value: "test/1_0/meta.json",
    });

    const dt = new DataTransfer();
    dt.items.add(f1);
    dt.items.add(f2);

    const input = document.getElementById("folder-input");
    input.files = dt.files;
    input.dispatchEvent(new Event("change"));
  });

  await new Promise((r) => setTimeout(r, 2000));
  await browser.close();
})();
