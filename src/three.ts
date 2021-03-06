import {
  AmbientLight,
  BoxBufferGeometry,
  DirectionalLight,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneBufferGeometry,
  Scene,
  SphereBufferGeometry,
  TextureLoader,
  TorusKnotBufferGeometry,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { DepthPeeling } from "./DepthPeeling";
import { BehaviorSubject, Observable } from "rxjs";

export async function three(
  id: string,
  width: number,
  height: number,
  depthRx: Observable<number>,
  screenSizeRx: Observable<[number, number]>,
  enableRx: BehaviorSubject<boolean>
) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(75, width / height, 0.1, 1000);
  const renderer = new WebGLRenderer();
  renderer.setSize(width, height);
  renderer.setPixelRatio(devicePixelRatio);
  document.getElementById(id)!.appendChild(renderer.domElement);
  camera.position.z = 5;

  renderer.shadowMap.enabled = true;

  const dirLight = new DirectionalLight();
  dirLight.position.set(0, 3, 0);
  dirLight.castShadow = true;
  scene.add(dirLight);
  scene.add(new AmbientLight(undefined, 0.5));

  const sphere = new Mesh(
    new SphereBufferGeometry(),
    new MeshStandardMaterial()
  );
  sphere.translateY(3).translateX(1.5);
  sphere.castShadow = true;
  scene.add(sphere);

  const knot = new Mesh(
    new TorusKnotBufferGeometry(undefined, undefined, 128, 32),
    new MeshStandardMaterial({
      transparent: true,
      opacity: 0.7,
      side: DoubleSide,
    })
  );
  knot.receiveShadow = true;
  scene.add(knot);

  scene.add(
    new Mesh(
      new BoxBufferGeometry(),
      new MeshBasicMaterial({ color: 0xf0a000 })
    )
  );

  const texture = await new TextureLoader().loadAsync(
    "/threejs-depth-peeling-demo/sprite0.png"
  );
  const plane = new Mesh(
    new PlaneBufferGeometry(3, 3),
    new MeshStandardMaterial({ map: texture, side: DoubleSide })
  );
  plane.translateX(-1.6);
  plane.translateY(1.5);
  scene.add(plane);

  const plane2 = new Mesh(
    new PlaneBufferGeometry(3, 3),
    new MeshStandardMaterial({
      map: texture,
      transparent: true,
      side: DoubleSide,
    })
  );
  plane2
    .translateX(-1.2)
    .translateY(-1.5)
    .translateZ(0)
    .rotateY(-2 * Math.PI * (1 / 10));
  scene.add(plane2);
  const dp = new DepthPeeling({
    depth: 3,
    height,
    width,
    pixelRatio: renderer.getPixelRatio(),
  });
  dp.add(scene);
  const animate = () =>
    requestAnimationFrame(() => {
      enableRx.getValue()
        ? dp.render(renderer, camera)
        : renderer.render(scene, camera);
    });

  depthRx.subscribe((n) => {
    dp.setDepth(n);
    animate();
  });
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.update();
  orbit.addEventListener("change", animate);

  screenSizeRx.subscribe(([width, height]) => {
    renderer.setSize(width, height);
  });
  animate();
  enableRx.subscribe(animate);

  (window as any).debugLayers = () => {
    dp.layers.forEach((layer, idx) => {
      const buf = new Uint8Array(width * height * 4);
      const url = new URL("http://0.0.0.0:7890/png");
      url.searchParams.set("width", width.toString());
      url.searchParams.set("height", height.toString());
      renderer.readRenderTargetPixels(layer, 0, 0, width, height, buf);
      const body = new FormData();
      body.append("pixels", new Blob([buf]), `layer${idx}.png`);
      fetch(url.toString(), { method: "POST", body });
    });
  };
}
