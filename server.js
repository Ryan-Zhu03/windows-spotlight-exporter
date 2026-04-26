const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

const host = "127.0.0.1";
const port = 3210;

const spotlightDir = path.join(
  os.homedir(),
  "AppData",
  "Local",
  "Packages",
  "Microsoft.Windows.ContentDeliveryManager_cw5n1h2txyewy",
  "LocalState",
  "Assets",
);

const defaultOutputDir = path.join(os.homedir(), "Pictures", "WindowsSpotlightExport");
const publicDir = path.join(__dirname, "public");

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath, contentType) {
  const stream = fs.createReadStream(filePath);
  stream.on("error", (error) => {
    sendJson(res, 500, { error: error.message });
  });
  res.writeHead(200, { "Content-Type": contentType });
  stream.pipe(res);
}

function collectRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

function getMimeTypeFromSignature(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: "png", mime: "image/png" };
  }
  return null;
}

function getPngSize(buffer) {
  if (buffer.length < 24) {
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function getJpegSize(buffer) {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    if (!marker) {
      break;
    }

    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }

    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2) {
      break;
    }

    const isFrameMarker =
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf;

    if (isFrameMarker && offset + 9 < buffer.length) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + segmentLength;
  }
  return null;
}

function getImageMeta(filePath) {
  const buffer = fs.readFileSync(filePath);
  const signature = getMimeTypeFromSignature(buffer);
  if (!signature) {
    return null;
  }

  const size = signature.ext === "jpg" ? getJpegSize(buffer) : getPngSize(buffer);
  if (!size) {
    return null;
  }

  return {
    format: signature.ext,
    mime: signature.mime,
    width: size.width,
    height: size.height,
    sizeBytes: buffer.length,
  };
}

function formatDateStamp(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

function safeStat(targetPath) {
  try {
    return fs.statSync(targetPath);
  } catch {
    return null;
  }
}

function ensureDirectory(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function normalizeDir(inputDir) {
  if (!inputDir || typeof inputDir !== "string") {
    return defaultOutputDir;
  }
  return path.resolve(inputDir.trim());
}

function listAssets() {
  const spotlightStat = safeStat(spotlightDir);
  if (!spotlightStat || !spotlightStat.isDirectory()) {
    throw new Error("未找到 Windows 聚焦缓存目录，请确认系统已启用 Windows 聚焦。");
  }

  const entries = fs.readdirSync(spotlightDir);
  const assets = [];

  for (const entry of entries) {
    const fullPath = path.join(spotlightDir, entry);
    const stat = safeStat(fullPath);
    if (!stat || !stat.isFile() || stat.size < 100 * 1024) {
      continue;
    }

    const meta = getImageMeta(fullPath);
    if (!meta || meta.format !== "jpg") {
      continue;
    }

    const orientation =
      meta.width > meta.height ? "landscape" : meta.width < meta.height ? "portrait" : "square";

    assets.push({
      id: entry,
      name: entry,
      path: fullPath,
      format: meta.format,
      mime: meta.mime,
      width: meta.width,
      height: meta.height,
      sizeBytes: meta.sizeBytes,
      orientation,
    });
  }

  assets.sort((a, b) => b.sizeBytes - a.sizeBytes);
  return assets;
}

function exportAssets(options = {}) {
  const outputDir = normalizeDir(options.outputDir);
  const landscapeOnly = options.landscapeOnly !== false;
  const minWidth = Number.isFinite(options.minWidth) ? options.minWidth : 1000;
  const minHeight = Number.isFinite(options.minHeight) ? options.minHeight : 500;
  const dedupe = options.dedupe !== false;

  ensureDirectory(outputDir);
  const allAssets = listAssets();

  const selectedAssets = allAssets.filter((asset) => {
    if (landscapeOnly && asset.orientation !== "landscape") {
      return false;
    }
    if (asset.width < minWidth || asset.height < minHeight) {
      return false;
    }
    return true;
  });

  const exported = [];
  for (const asset of selectedAssets) {
    const targetName = `${asset.name}.jpg`;
    const targetPath = path.join(outputDir, targetName);
    const alreadyExists = safeStat(targetPath);

    if (!alreadyExists || !dedupe) {
      fs.copyFileSync(asset.path, targetPath);
    }

    exported.push({
      id: asset.id,
      fileName: targetName,
      outputPath: targetPath,
      width: asset.width,
      height: asset.height,
      existed: Boolean(alreadyExists),
    });
  }

  return {
    outputDir,
    scanned: allAssets.length,
    matched: selectedAssets.length,
    exportedCount: exported.length,
    exported,
  };
}

function openFolder(targetDir) {
  const stat = safeStat(targetDir);
  if (!stat || !stat.isDirectory()) {
    throw new Error("目录不存在，暂时无法打开。");
  }

  spawn("explorer.exe", [targetDir], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  }).unref();
}

function routeApi(req, res) {
  if (req.method === "GET" && req.url === "/api/config") {
    const spotlightExists = Boolean(safeStat(spotlightDir));
    const outputExists = Boolean(safeStat(defaultOutputDir));
    sendJson(res, 200, {
      spotlightDir,
      defaultOutputDir,
      spotlightExists,
      outputExists,
    });
    return true;
  }

  if (req.method === "GET" && req.url === "/api/assets") {
    try {
      const assets = listAssets().map((asset) => ({
        id: asset.id,
        width: asset.width,
        height: asset.height,
        orientation: asset.orientation,
        sizeBytes: asset.sizeBytes,
        previewUrl: `/api/image/${encodeURIComponent(asset.id)}`,
      }));
      sendJson(res, 200, { count: assets.length, assets });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return true;
  }

  if (req.method === "GET" && req.url.startsWith("/api/image/")) {
    try {
      const id = decodeURIComponent(req.url.replace("/api/image/", ""));
      const asset = listAssets().find((item) => item.id === id);
      if (!asset) {
        sendJson(res, 404, { error: "图片不存在。" });
        return true;
      }
      sendFile(res, asset.path, asset.mime);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return true;
  }

  if (req.method === "POST" && req.url === "/api/export") {
    collectRequestBody(req)
      .then((body) => {
        const result = exportAssets({
          outputDir: body.outputDir,
          landscapeOnly: body.landscapeOnly,
          minWidth: Number(body.minWidth),
          minHeight: Number(body.minHeight),
          dedupe: body.dedupe,
        });
        sendJson(res, 200, result);
      })
      .catch((error) => {
        sendJson(res, 400, { error: error.message });
      });
    return true;
  }

  if (req.method === "POST" && req.url === "/api/open-output") {
    collectRequestBody(req)
      .then((body) => {
        const outputDir = normalizeDir(body.outputDir);
        openFolder(outputDir);
        sendJson(res, 200, { ok: true, outputDir });
      })
      .catch((error) => {
        sendJson(res, 400, { error: error.message });
      });
    return true;
  }

  return false;
}

function routeStatic(req, res) {
  const requestPath = req.url === "/" ? "/index.html" : req.url;
  const targetPath = path.normalize(path.join(publicDir, requestPath));

  if (!targetPath.startsWith(publicDir)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  const stat = safeStat(targetPath);
  if (!stat || !stat.isFile()) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  const ext = path.extname(targetPath).toLowerCase();
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
  };

  sendFile(res, targetPath, contentTypes[ext] || "application/octet-stream");
}

const server = http.createServer((req, res) => {
  try {
    if (routeApi(req, res)) {
      return;
    }
    routeStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(port, host, () => {
  const url = `http://${host}:${port}`;
  console.log(`[${formatDateStamp()}] Spotlight exporter running at ${url}`);
});
