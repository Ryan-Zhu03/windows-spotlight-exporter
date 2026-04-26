const state = {
  config: null,
  assets: [],
};

const outputDirInput = document.querySelector("#outputDir");
const minWidthInput = document.querySelector("#minWidth");
const minHeightInput = document.querySelector("#minHeight");
const landscapeOnlyInput = document.querySelector("#landscapeOnly");
const dedupeInput = document.querySelector("#dedupe");
const assetCount = document.querySelector("#assetCount");
const defaultDir = document.querySelector("#defaultDir");
const statusText = document.querySelector("#statusText");
const gallery = document.querySelector("#gallery");
const resultBox = document.querySelector("#resultBox");

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data;
}

function setStatus(message) {
  statusText.textContent = message;
}

function renderGallery() {
  gallery.innerHTML = "";

  if (!state.assets.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "还没有找到可预览的聚焦图片。";
    gallery.appendChild(empty);
    return;
  }

  for (const asset of state.assets.slice(0, 24)) {
    const card = document.createElement("article");
    card.className = "image-card";

    const image = document.createElement("img");
    image.src = asset.previewUrl;
    image.alt = `${asset.width}x${asset.height}`;
    image.loading = "lazy";

    const meta = document.createElement("div");
    meta.className = "image-meta";
    meta.innerHTML = `
      <strong>${asset.width} × ${asset.height}</strong>
      <span>${asset.orientation}</span>
    `;

    card.append(image, meta);
    gallery.appendChild(card);
  }
}

async function loadConfig() {
  const config = await apiFetch("/api/config");
  state.config = config;
  outputDirInput.value = config.defaultOutputDir;
  defaultDir.textContent = config.defaultOutputDir;
}

async function loadAssets() {
  setStatus("正在刷新预览…");
  const result = await apiFetch("/api/assets");
  state.assets = result.assets;
  assetCount.textContent = String(result.count);
  setStatus(result.count ? `已读取 ${result.count} 张图片` : "没有找到可用图片");
  renderGallery();
}

async function exportImages() {
  resultBox.textContent = "正在导出，请稍候…";

  const payload = {
    outputDir: outputDirInput.value,
    minWidth: Number(minWidthInput.value),
    minHeight: Number(minHeightInput.value),
    landscapeOnly: landscapeOnlyInput.checked,
    dedupe: dedupeInput.checked,
  };

  const result = await apiFetch("/api/export", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  resultBox.textContent = [
    `导出目录: ${result.outputDir}`,
    `扫描到: ${result.scanned} 张`,
    `符合条件: ${result.matched} 张`,
    `已处理: ${result.exportedCount} 张`,
  ].join("\n");
}

async function openOutputDir() {
  await apiFetch("/api/open-output", {
    method: "POST",
    body: JSON.stringify({ outputDir: outputDirInput.value }),
  });
}

document.querySelector("#refreshBtn").addEventListener("click", async () => {
  try {
    await loadAssets();
  } catch (error) {
    setStatus(error.message);
  }
});

document.querySelector("#exportBtn").addEventListener("click", async () => {
  try {
    await exportImages();
  } catch (error) {
    resultBox.textContent = error.message;
  }
});

document.querySelector("#openBtn").addEventListener("click", async () => {
  try {
    await openOutputDir();
  } catch (error) {
    resultBox.textContent = error.message;
  }
});

async function boot() {
  try {
    await loadConfig();
    await loadAssets();
  } catch (error) {
    setStatus(error.message);
    resultBox.textContent = error.message;
  }
}

boot();
