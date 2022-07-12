import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  InstancedMesh,
  IUniform,
  Material,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  SphereBufferGeometry,
} from "three";
import { debounceTime, Observable, Subscription } from "rxjs";

export class Indicators {
  instances: InstancedMesh;
  subscriptions: Subscription[] = [];
  standardZ: IUniform;
  constructor(
    scene: Scene,
    camera: PerspectiveCamera,
    initialScreenHeight: number,
    circleSegment: number,
    radius: number,
    private cameraMoveRx: Observable<any>,
    render: () => void
  ) {
    this.standardZ = {
      value: initialScreenHeight / (2 * Math.tan(camera.fov / 2)),
    };
    // const g = circleGeometry(circleSegment, radius);
    const g = new SphereBufferGeometry(radius);
    const m2 = new MeshBasicMaterial({ color: 0xffff00, side: DoubleSide });

    m2.onBeforeCompile = (shader) => {
      const idx = shader.vertexShader.search("void main()");
      if (idx === -1) throw new Error("Failed to find void main()");
      // const chunk = billboardShaderChunk();
      const chunk = fixedSizeShaderChunk();
      shader.vertexShader = shader.vertexShader.slice(0, idx) + chunk;
      console.log(shader.vertexShader);
      shader.uniforms.standardZ = this.standardZ;
    };
    this.instances = new InstancedMesh(g, m2, 100);
    this.instances.count = 0;
    scene.add(this.instances);
    cameraMoveRx.subscribe(() => {
      this.instances.visible = true;
    });
    cameraMoveRx.pipe(debounceTime(300)).subscribe(() => {
      this.instances.visible = false;
      render();
    });
  }

  subscribe(p: { x: number; y: number; z: number }) {
    const t = new Matrix4().makeTranslation(p.x, p.y, p.z);
    const s = new Matrix4().makeScale(10, 10, 10);
    const transform = new Matrix4().identity().multiply(t).multiply(s);
    const idx = this.subscriptions.length;
    this.instances.count = idx + 1;
    this.instances.setMatrixAt(idx, transform);
    this.instances.instanceMatrix.needsUpdate = true;
    const subscription = this.cameraMoveRx.subscribe(() => {
      // const idx = this.subscriptions.indexOf(subscription);
      // transform.identity().multiply(t).multiply(s);
      // this.instances.setMatrixAt(idx, transform);
      // this.instances.instanceMatrix.needsUpdate = true;
    });
    this.subscriptions.push(subscription);
  }
}

function billboardShaderChunk() {
  return `
      uniform float standardZ;
      void main() {
        mat4 cameraR = viewMatrix;
        cameraR[0][3] = 0.0;
        cameraR[1][3] = 0.0;
        cameraR[2][3] = 0.0;
        cameraR[3] = vec4( 0.0, 0.0, 0.0, 1.0 );
        cameraR = transpose(cameraR);
        vec4 viewSpace = viewMatrix * modelMatrix * instanceMatrix * cameraR * vec4(position, 1.0);
        float scale = -viewSpace.z / standardZ;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * cameraR * vec4(position * scale, 1.0);
      }`;
}

function circleGeometry(circleSegment: number, radius: number) {
  return new BufferGeometry()
    .setAttribute(
      "position",
      new BufferAttribute(
        new Float32Array(Array.from(circlePositions(circleSegment, radius))),
        3
      )
    )
    .setIndex(Array.from(circleIndices(circleSegment)));
}

function* circlePositions(segments: number, radius: number) {
  const tau = Math.PI * 2;
  let angle = 0;
  for (let i = 0; i < segments; i++) {
    angle = (tau * i) / segments;
    yield Math.cos(angle) * radius;
    yield Math.sin(angle) * radius;
    yield 0;
  }
}

function* circleIndices(segments: number) {
  for (let i = 0; i < segments - 2; i++) {
    yield 0;
    yield i + 1;
    yield i + 2;
  }
}

function fixedSizeShaderChunk() {
  return `
      uniform float standardZ;
      void main() {
        vec4 viewSpace = viewMatrix * modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
        float scale = -viewSpace.z / standardZ;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position * scale, 1.0);
      }`;
}
