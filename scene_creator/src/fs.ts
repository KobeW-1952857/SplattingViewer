import * as pc from "playcanvas";

export const virtualFiles = new Map<string, File>();

export function setupVirtualFS() {
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
      if (options.responseType === "arraybuffer")
        reader.readAsArrayBuffer(file);
      else reader.readAsText(file);
      return;
    }
    return originalGet(url, options, callback);
  };
}
