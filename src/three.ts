import {
  AmbientLight,
  BoxBufferGeometry,
  DirectionalLight,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  TorusKnotBufferGeometry,
  WebGLRenderer,
} from "three";
import * as DP from "./depth-peeling";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

export function three(id: string, width: number, height: number) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(75, width / height, 0.1, 1000);
  const renderer = new WebGLRenderer();
  renderer.setSize(width, height);
  document.getElementById(id)!.appendChild(renderer.domElement);
  camera.position.z = 5;

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
  scene.add(
    new Mesh(
      new BoxBufferGeometry(),
      new MeshBasicMaterial({ color: 0xf0a000 })
    )
  );

  const copy = new ShaderMaterial(CopyShader);
  const dp = DP.createDepthPeelingContext({
    scene,
    width,
    height,
    renderer,
    camera,
    depth: 3,
  });
  const animate = () =>
    requestAnimationFrame(() => {
      DP.render(dp, null);
    });

  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.update();
  orbit.addEventListener("change", animate);

  animate();
}
