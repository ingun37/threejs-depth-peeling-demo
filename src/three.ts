import {
  AmbientLight,
  DirectionalLight,
  DoubleSide,
  Mesh,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  TorusKnotBufferGeometry,
  WebGLRenderer,
} from "three";
import * as DP from "./depth-peeling";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader";
import { debugRenderTarget } from "./debug";

export function three(id: string, width: number, height: number) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(75, width / height, 0.1, 1000);

  const renderer = new WebGLRenderer();
  renderer.setSize(width, height);
  document.getElementById(id)!.appendChild(renderer.domElement);
  scene.add(new DirectionalLight());
  scene.add(new AmbientLight(undefined, 0.5));
  scene.add(
    new Mesh(
      new TorusKnotBufferGeometry(),
      new ShaderMaterial({
        vertexShader: `
varying vec3 N;
void main() {
  N = normal; 
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4( position, 1.0 );
}`,
        fragmentShader: `
varying vec3 N;
void main() {
  gl_FragColor = vec4(N, 0.6);
}`,
        transparent: true,
        side: DoubleSide,
      })
    )
  );
  camera.position.z = 5;

  const copy = new ShaderMaterial(CopyShader);
  const quad = new FullScreenQuad(copy);
  const dp = DP.createDepthPeelingContext({
    scene,
    width,
    height,
    renderer,
    camera,
    depth: 3,
  });
  requestAnimationFrame(() => {
    DP.render(dp);
    copy.uniforms.tDiffuse.value = dp.finals[dp.finals.length - 1].texture;
    renderer.clear();
    quad.render(renderer);
    setTimeout(() => {
      debugRenderTarget(renderer, dp.finals[0], width, height, "final0.png");
      debugRenderTarget(renderer, dp.finals[1], width, height, "final1.png");
      debugRenderTarget(renderer, dp.finals[2], width, height, "final2.png");
      // debugRenderTarget(renderer, dp.final3, width, height, "final3.png");
      // debugRenderTarget(renderer, dp.final, width, height, "final.png");
    });
  });
}
