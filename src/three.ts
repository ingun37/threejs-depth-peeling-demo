import {
  AmbientLight,
  DepthTexture,
  DirectionalLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
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
  const depthA = new DepthTexture(width, height);
  const depthB = new DepthTexture(width, height);

  requestAnimationFrame(() => {
    renderer.render(scene, camera);
  });
}
