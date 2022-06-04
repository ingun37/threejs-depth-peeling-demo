import {
  AmbientLight,
  DepthTexture,
  DirectionalLight,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshDepthMaterial,
  MeshPhongMaterial,
  NoBlending,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  TorusBufferGeometry,
  TorusKnotBufferGeometry,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader";

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
  gl_FragColor = vec4(N, 0.5);
}`,
        transparent: true,
      })
    )
  );
  camera.position.z = 5;

  const depthT = new DepthTexture(width, height);
  const layer0 = new WebGLRenderTarget(width, height, {
    depthTexture: depthT,
  });
  const cache = new Map<Mesh, number>();

  const copy = new ShaderMaterial(CopyShader);
  const quad = new FullScreenQuad(copy);
  requestAnimationFrame(() => {
    scene.traverse((obj) => {
      if (obj instanceof Mesh && obj.material instanceof Material) {
        cache.set(obj, obj.material.blending);
        obj.material.blending = NoBlending;
      }
    });
    renderer.setRenderTarget(layer0);
    renderer.render(scene, camera);

    renderer.setRenderTarget(null);
    copy.uniforms.tDiffuse.value = layer0.texture;
    quad.render(renderer);
    scene.traverse((obj) => {
      if (obj instanceof Mesh && obj.material instanceof Material)
        obj.material.blending = cache.get(obj)!;
    });
    // renderer.render(scene, camera);
  });
}
