import {
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  TorusBufferGeometry,
  WebGLRenderer,
} from "three";

export function three(id: string, width: number, height: number) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(75, width / height, 0.1, 1000);

  const renderer = new WebGLRenderer();
  renderer.setSize(width, height);
  document.getElementById(id)!.appendChild(renderer.domElement);
  scene.add(new Mesh(new TorusBufferGeometry(), new MeshBasicMaterial()));
  camera.position.z = 5;
  requestAnimationFrame(() => {
    renderer.render(scene, camera);
  });
}
