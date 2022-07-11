import {
  AmbientLight,
  BasicDepthPacking,
  BoxBufferGeometry,
  DirectionalLight,
  DoubleSide,
  FloatType,
  Mesh,
  MeshBasicMaterial,
  MeshDepthMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneBufferGeometry,
  Raycaster,
  Scene,
  SphereBufferGeometry,
  TextureLoader,
  TorusKnotBufferGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { DepthPeeling } from "./DepthPeeling";
import { BehaviorSubject, Observable, Subject } from "rxjs";
import { TeapotGeometry } from "three/examples/jsm/geometries/TeapotGeometry";
import { Indicators } from "./Indicators";

export async function three2(
  id: string,
  width: number,
  height: number,
  mouseRx: Observable<[number, number]>
) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(75, width / height, 0.1, 1000);
  const renderer = new WebGLRenderer();
  renderer.setSize(width, height);
  renderer.setClearAlpha(0);

  // renderer.setPixelRatio(devicePixelRatio);
  document.getElementById(id)!.appendChild(renderer.domElement);
  camera.position.z = 200;

  const dirLight = new DirectionalLight();
  dirLight.position.set(0, 3, 0);
  dirLight.castShadow = true;
  scene.add(dirLight);
  scene.add(new AmbientLight(undefined, 0.5));

  scene.add(new Mesh(new TeapotGeometry(), new MeshStandardMaterial()));
  const moveRx = new Subject();
  const animate = () =>
    requestAnimationFrame(() => {
      moveRx.next(0);
      renderer.clear();
      renderer.render(scene, camera);
    });

  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.update();
  orbit.addEventListener("change", animate);

  const indicators = new Indicators(scene, 16, moveRx);

  animate();
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  mouseRx.subscribe(([x, y]) => {
    // console.log(x, y);
    pointer.set(x, y);
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster
      .intersectObjects(scene.children)
      .sort((x, y) => (x.distance < y.distance ? -1 : 1));
    if (0 < intersects.length) {
      const head = intersects[0];
      indicators.subscribe({
        x: head.point.x,
        y: head.point.y,
        z: head.point.z,
      });
    }
    // calculate objects intersecting the picking ray
  });
}
