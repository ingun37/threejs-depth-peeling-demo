import {
  AmbientLight,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { Observable, Subject } from "rxjs";
import { TeapotGeometry } from "three/examples/jsm/geometries/TeapotGeometry";
import { Indicators, IndicatorSubscription } from "./Indicators";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { SchematicPass } from "./SchematicPass";

export async function three3(
  id: string,
  width: number,
  height: number,
  mouseRx: Observable<[number, number]>
) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(75, width / height, 0.1, 1000);
  const renderer = new WebGLRenderer({ preserveDrawingBuffer: true });
  renderer.setSize(width, height);
  renderer.setClearAlpha(0);

  renderer.setPixelRatio(window.devicePixelRatio);
  document.getElementById(id)!.appendChild(renderer.domElement);
  camera.position.z = 200;

  const dirLight = new DirectionalLight();
  dirLight.position.set(0, 3, 0);
  dirLight.castShadow = true;
  scene.add(dirLight);
  scene.add(new AmbientLight(undefined, 0.5));

  const teapot = new Mesh(new TeapotGeometry(), new MeshStandardMaterial());
  scene.add(teapot);
  const moveRx = new Subject();

  const composer = new EffectComposer(renderer);
  const res = renderer.getSize(new Vector2());
  composer.addPass(
    new SchematicPass(
      res,
      renderer.getPixelRatio(),
      scene,
      camera,
      new Object3D()
    )
  );

  const animate = () =>
    requestAnimationFrame(() => {
      renderer.clear();
      composer.render();
      // renderer.render(scene, camera);
    });

  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.update();
  orbit.addEventListener("change", () => {
    animate();
    moveRx.next(0);
  });

  const indicators = new Indicators(
    renderer,
    scene,
    camera,
    height,
    16,
    10,
    0xff00ff,
    moveRx,
    animate
  );

  animate();
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  mouseRx.subscribe(([x, y]) => {
    // console.log(x, y);
    pointer.set(x, y);
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster
      .intersectObject(teapot)
      .sort((x, y) => (x.distance < y.distance ? -1 : 1));
    if (0 < intersects.length) {
      const head = intersects[0];
      const s = indicators.subscribe(
        {
          x: head.point.x,
          y: head.point.y,
          z: head.point.z,
        },
        10,
        (indicatorVisibility, isVisible) => {
          console.log(indicatorVisibility, isVisible);
        }
      );

      console.log("created at", head.point.x, head.point.y, head.point.z);
      if (!(window as any).subs) (window as any).subs = [];
      (window as any).subs = (
        (window as any).subs as IndicatorSubscription[]
      ).filter((x) => x.isAlive());
      (window as any).subs.push(s);
    }
    // calculate objects intersecting the picking ray
  });
}

function rand255() {
  return Math.floor(Math.random() * 255);
}
