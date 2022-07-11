import {
  BufferAttribute,
  BufferGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Scene,
} from "three";
import { Observable, Subscription } from "rxjs";

export class Indicators {
  instances: InstancedMesh;
  subscriptions: Subscription[] = [];

  constructor(
    scene: Scene,
    circleSegment: number,
    private cameraMoveRx: Observable<any>
  ) {
    const g = new BufferGeometry()
      .setAttribute(
        "position",
        new BufferAttribute(
          new Float32Array(Array.from(circlePositions(circleSegment))),
          3
        )
      )
      .setIndex(Array.from(circleIndices(circleSegment)));

    const m2 = new MeshBasicMaterial({ color: 0xffff00 });
    m2.onBeforeCompile = (shader) => {
      const sub = `void main() {
        mat4 cameraR = viewMatrix;
        cameraR[0][3] = 0.0;
        cameraR[1][3] = 0.0;
        cameraR[2][3] = 0.0;
        cameraR[3] = vec4( 0.0, 0.0, 0.0, 1.0 );
        cameraR = transpose(cameraR);
        
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * cameraR * vec4(position, 1.0);
      }`;
      const idx = shader.vertexShader.search("void main()");
      if (idx === -1) throw new Error("Failed to find void main()");
      shader.vertexShader = shader.vertexShader.slice(0, idx) + sub;
      console.log(shader.vertexShader);
    };
    this.instances = new InstancedMesh(g, m2, 100);
    this.instances.count = 0;
    scene.add(this.instances);
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

function* circlePositions(segments: number) {
  const tau = Math.PI * 2;
  let angle = 0;
  for (let i = 0; i < segments; i++) {
    angle = (tau * i) / segments;
    yield Math.cos(angle);
    yield Math.sin(angle);
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
