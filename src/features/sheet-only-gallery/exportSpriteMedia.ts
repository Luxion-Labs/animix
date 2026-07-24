import { downloadUrl } from "../../app/downloads";

export type SpriteMediaExportSettings = {
  sourceUrl: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  columns: number;
  fps: number;
  filename: string;
};

type SpriteMediaExportFormat = "gif" | "video";

function appendHiddenField(form: HTMLFormElement, name: string, value: string | number) {
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = name;
  input.value = String(value);
  form.appendChild(input);
}

function submitPostDownload(format: SpriteMediaExportFormat, settings: SpriteMediaExportSettings) {
  const frameName = `spritesheet-export-${Date.now()}`;
  const iframe = document.createElement("iframe");
  iframe.name = frameName;
  iframe.style.display = "none";

  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/spritesheet/export-media";
  form.target = frameName;
  form.style.display = "none";

  const payload = { ...settings, format };
  Object.entries(payload).forEach(([key, value]) => appendHiddenField(form, key, value));

  document.body.appendChild(iframe);
  document.body.appendChild(form);
  form.submit();

  window.setTimeout(() => {
    form.remove();
    iframe.remove();
  }, 60000);
}

function downloadServerExport(format: SpriteMediaExportFormat, settings: SpriteMediaExportSettings) {
  if (settings.sourceUrl.startsWith("data:")) {
    submitPostDownload(format, settings);
    return;
  }

  const params = new URLSearchParams({
    columns: String(settings.columns),
    filename: settings.filename,
    format,
    fps: String(settings.fps),
    frameCount: String(settings.frameCount),
    frameHeight: String(settings.frameHeight),
    frameWidth: String(settings.frameWidth),
    sourceUrl: settings.sourceUrl,
  });
  downloadUrl(`/api/spritesheet/export-media?${params.toString()}`, settings.filename);
}

export function exportSpriteGif(settings: SpriteMediaExportSettings) {
  downloadServerExport("gif", settings);
}

export function exportSpriteVideo(settings: SpriteMediaExportSettings) {
  downloadServerExport("video", settings);
}
