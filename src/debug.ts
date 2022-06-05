import { WebGLRenderer, WebGLRenderTarget } from "three";

export function debugRenderTarget(
  renderer: WebGLRenderer,
  rt: WebGLRenderTarget,
  width: number,
  height: number,
  filename: string
) {
  const buff = new Uint8Array(width * height * 4);

  renderer.readRenderTargetPixels(rt, 0, 0, width, height, buff);
  const formData = new FormData();
  formData.append("pixels", new Blob([buff]), filename);
  const url = new URL("http://localhost:7890/png");
  url.searchParams.set("width", width.toString());
  url.searchParams.set("height", height.toString());

  fetch(url.toString(), {
    method: "POST",
    body: formData,
  }).catch((err) => {
    console.error(err);
  });
}
