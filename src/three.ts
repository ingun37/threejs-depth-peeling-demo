import {
  AmbientLight,
  BoxBufferGeometry,
  DirectionalLight,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneBufferGeometry,
  Scene,
  ShaderMaterial,
  SphereBufferGeometry,
  TextureLoader,
  TorusKnotBufferGeometry,
  WebGLRenderer,
} from "three";
import * as DP from "./depth-peeling";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

export async function three(id: string, width: number, height: number) {
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
    new MeshStandardMaterial({ map: texture })
  );
  plane.translateX(-1.6);
  plane.translateY(1.5);
  scene.add(plane);

  const plane2 = new Mesh(
    new PlaneBufferGeometry(3, 3),
    new MeshStandardMaterial({ map: texture, transparent: true })
  );
  plane2.translateX(-1.6).translateY(-1.5);
  scene.add(plane2);
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
      // renderer.render(scene, camera);
      DP.render(dp, null);
    });

  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.update();
  orbit.addEventListener("change", animate);

  animate();
}
