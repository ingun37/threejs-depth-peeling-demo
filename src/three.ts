import {
  AmbientLight,
  DirectionalLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  PerspectiveCamera,
  Scene,
  TorusBufferGeometry,
  TorusKnotBufferGeometry,
  WebGLRenderer,
} from "three";

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
      new MeshPhongMaterial({
        color: 0xfff000,
        transparent: true,
        opacity: 0.5,
      })
    )
  );
  camera.position.z = 5;
  requestAnimationFrame(() => {
    renderer.render(scene, camera);
  });
}
