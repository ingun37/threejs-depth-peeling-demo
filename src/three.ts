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
import { Observable } from "rxjs";

export async function three(
  id: string,
  width: number,
  height: number,
  depthRx: Observable<number>,
  screenSizeRx: Observable<[number, number]>
) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(75, width / height, 0.1, 1000);
  const renderer = new WebGLRenderer();
  renderer.setSize(width, height);
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

  const texture = await new TextureLoader().loadAsync("/sprite0.png");
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
  });
  dp.prepare(scene);
  const animate = () =>
    requestAnimationFrame(() => {
      dp.render(renderer, scene, camera, null);
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
}
