import {
  Color,
  ColorRepresentation,
  DoubleSide,
  InstancedMesh,
  IUniform,
  Matrix4,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SphereBufferGeometry,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import {
  animationFrameScheduler,
  auditTime,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  merge,
  Observable,
  Subject,
  Subscription,
  tap,
} from "rxjs";

export enum IndicatorEnabled {
  SHOWN,
  HIDDEN,
}

export enum SubscriberEvent {
  Unsubscribed,
  Moved,
}

export class Indicators {
  instances: InstancedMesh;
  subscriptions: Subscription[] = [];
  indicatorVisibilityRx = new Subject<IndicatorEnabled>();
  standardZ: number;
  uniqueColor: Color;
  subscribersEvent = new Subject<SubscriberEvent>();
  pruneRx = new Subject();
  moveRx = new Subject();
  constructor(
    private renderer: WebGLRenderer,
    scene: Scene,
    private camera: PerspectiveCamera,
    initialScreenHeight: number,
    circleSegment: number,
    radius: number,
    color: ColorRepresentation,
    private cameraMoveRx: Observable<any>,
    private render: () => void
  ) {
    this.uniqueColor = new Color(color);
    this.standardZ = initialScreenHeight / (2 * Math.tan(camera.fov / 2));
    // const g = circleGeometry(circleSegment, radius);
    const g = new SphereBufferGeometry(radius);
    const m2 = new MeshBasicMaterial({
      side: DoubleSide,
      color,
      depthWrite: false,
    });
    this.instances = new InstancedMesh(g, m2, 100);
    this.instances.count = 0;
    scene.add(this.instances);
    merge(
      cameraMoveRx.pipe(map(() => IndicatorEnabled.SHOWN)),
      cameraMoveRx.pipe(
        debounceTime(300),
        map(() => IndicatorEnabled.HIDDEN)
      )
    ).subscribe(this.indicatorVisibilityRx);

    this.subscribersEvent
      .pipe(
        filter((e) => e === SubscriberEvent.Unsubscribed),
        tap(() => {
          this.subscriptions = this.subscriptions.filter((x) => !x.closed);
          this.instances.count = this.subscriptions.length;
          render();
        })
      )
      .subscribe(this.pruneRx);
    this.subscribersEvent
      .pipe(filter((e) => e === SubscriberEvent.Moved))
      .subscribe(this.moveRx);
  }

  subscribe(
    pos: { x: number; y: number; z: number },
    size: number,
    callback: (
      indicatorVisibility: IndicatorEnabled,
      isVisible: boolean
    ) => void
  ) {
    const screenSize = new Vector2();
    const pV3 = new Vector3();
    const t = new Matrix4().makeTranslation(pos.x, pos.y, pos.z);
    const s = new Matrix4();
    const transform = new Matrix4().identity().multiply(t).multiply(s);
    const initialIdx = this.subscriptions.length;
    this.instances.count = initialIdx + 1;
    this.instances.setMatrixAt(initialIdx, transform);
    this.instances.instanceMatrix.needsUpdate = true;
    const ctx = this.renderer.getContext();
    const pixelBuffer = new Uint8Array(4);
    const subscription = this.indicatorVisibilityRx
      .pipe(
        distinctUntilChanged()
        // auditTime(0, animationFrameScheduler)
      )
      .subscribe((indicatorEnabled) => {
        const ndc = pV3
          .set(t.elements[12], t.elements[13], t.elements[14])
          .project(this.camera);
        this.renderer.getSize(screenSize);
        const dx = Math.floor(((ndc.x + 1) * screenSize.width) / 2);
        const dy = Math.floor(((ndc.y + 1) * screenSize.height) / 2);
        let isVisible = false;
        const pixelRatio = this.renderer.pixelRatio ?? 1;
        const color = this.uniqueColor;
        if (
          0 <= dx &&
          0 <= dy &&
          dx < screenSize.width * pixelRatio &&
          dy < screenSize.height * pixelRatio
        ) {
          ctx.readPixels(
            dx,
            dy,
            1,
            1,
            ctx.RGBA,
            ctx.UNSIGNED_BYTE,
            pixelBuffer
          );

          isVisible =
            pixelBuffer[0] === scale255(color.r) &&
            pixelBuffer[1] === scale255(color.g) &&
            pixelBuffer[2] === scale255(color.b);
        }

        callback(indicatorEnabled, isVisible);
      });
    subscription.add(
      merge(this.cameraMoveRx, this.pruneRx, this.moveRx).subscribe(() => {
        const idx = this.subscriptions.indexOf(subscription);
        if (idx === -1) throw new Error("Failed to find subscription");
        const viewP = pV3
          .set(t.elements[12], t.elements[13], t.elements[14])
          .applyMatrix4(this.camera.matrixWorldInverse);
        const fixedSizeScale = (size * -viewP.z) / this.standardZ;

        s.makeScale(fixedSizeScale, fixedSizeScale, fixedSizeScale);
        transform.identity().multiply(t).multiply(s);
        this.instances.setMatrixAt(idx, transform);
        this.instances.instanceMatrix.needsUpdate = true;
        this.render();
      })
    );
    this.subscriptions.push(subscription);

    const isub = new IndicatorSubscription(subscription, t);
    isub.events.subscribe((e) => this.subscribersEvent.next(e));
    return isub;
  }
}

class IndicatorSubscription {
  events = new Subject<SubscriberEvent>();
  constructor(
    private subscription: Subscription,
    private translationMatrix: Matrix4
  ) {}
  unsubscribe() {
    this.subscription.unsubscribe();
    this.events.next(SubscriberEvent.Unsubscribed);
    this.events.complete();
  }
  move(x: number, y: number, z: number) {
    this.translationMatrix.makeTranslation(x, y, z);
    this.events.next(SubscriberEvent.Moved);
  }
}
function scale255(f0to1: number) {
  return Math.floor(255 * f0to1);
}
