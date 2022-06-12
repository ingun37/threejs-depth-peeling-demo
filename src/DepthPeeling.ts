import {
  Camera,
  Color,
  DataTexture,
  DepthTexture,
  IUniform,
  Material,
  Mesh,
  NoBlending,
  Object3D,
  Scene,
  ShaderMaterial,
  Texture,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader";

export class DepthPeeling {
  private globalUniforms: {
    uPrevDepthTexture: IUniform;
    uReciprocalScreenSize: IUniform;
  } = {
    uPrevDepthTexture: { value: null },
    uReciprocalScreenSize: { value: new Vector2(1, 1) },
  };

  layers: Array<WebGLRenderTarget> = [];
  private depth: number = 3;
  private one = new DataTexture(new Uint8Array([1, 1, 1, 1]), 1, 1);
  private quad = new FullScreenQuad(
    new ShaderMaterial({
      ...CopyShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
  );
  private screenSize = new Vector2();
  private pixelRatio = 1;
  private originalClearColor = new Color();
  private ownScene = new Scene();
  constructor(p: {
    width: number;
    height: number;
    depth: number;
    pixelRatio: number;
  }) {
    this.setScreenSize(p.width, p.height, p.pixelRatio);
    this.setDepth(p.depth);
  }

  add(sceneGraph: Object3D) {
    const clonedScene = sceneGraph.clone(true);
    clonedScene.traverse((obj) => {
      if (obj instanceof Mesh && obj.material instanceof Material) {
        const clonedMaterial = obj.material.clone();
        clonedMaterial.blending = NoBlending;
        clonedMaterial.onBeforeCompile = (shader) => {
          shader.uniforms.uReciprocalScreenSize =
            this.globalUniforms.uReciprocalScreenSize;
          shader.uniforms.uPrevDepthTexture =
            this.globalUniforms.uPrevDepthTexture;
          shader.fragmentShader = `
// --- DEPTH PEELING SHADER CHUNK (START) (uniform definition)
uniform vec2 uReciprocalScreenSize;
uniform sampler2D uPrevDepthTexture;
// --- DEPTH PEELING SHADER CHUNK (END)
					${shader.fragmentShader}
				`;
          //peel depth
          shader.fragmentShader = shader.fragmentShader.replace(
            /}$/gm,
            `
// --- DEPTH PEELING SHADER CHUNK (START) (peeling)
  vec2 screenPos = gl_FragCoord.xy * uReciprocalScreenSize;
  float prevDepth = texture2D(uPrevDepthTexture,screenPos).x;
  if( prevDepth >= gl_FragCoord.z )
      discard;
// --- DEPTH PEELING SHADER CHUNK (END)
}
					`
          );
        };
        obj.material = clonedMaterial;
        obj.material.needsUpdate = true;
      }
    });
    this.ownScene.add(clonedScene);
  }

  render(renderer: WebGLRenderer, camera: Camera) {
    const originalRenderTarget = renderer.getRenderTarget();
    const originalAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    renderer.getClearColor(this.originalClearColor);
    renderer.setClearColor(0x000000);

    this.layers.reduceRight((prevDepth: Texture, layer): Texture => {
      this.globalUniforms.uPrevDepthTexture.value = prevDepth;
      renderer.setRenderTarget(layer);
      renderer.clear();
      renderer.render(this.ownScene, camera);
      return layer.depthTexture;
    }, this.one);

    renderer.setRenderTarget(originalRenderTarget);
    renderer.setClearColor(this.originalClearColor);
    renderer.clear();

    for (const layer of this.layers) {
      (this.quad.material as ShaderMaterial).uniforms.tDiffuse.value =
        layer.texture;
      this.quad.material.needsUpdate = true;
      this.quad.render(renderer);
    }
    renderer.autoClear = originalAutoClear;
  }
  getDepth() {
    return this.depth;
  }
  setDepth(depth: number) {
    while (depth < this.layers.length) this.layers.pop()?.dispose();

    const w = this.screenSize.width * this.pixelRatio;
    const h = this.screenSize.height * this.pixelRatio;
    while (this.layers.length < depth)
      this.layers.push(
        new WebGLRenderTarget(w, h, {
          depthTexture: new DepthTexture(w, h),
          // samples: 2,
        })
      );

    this.depth = depth;
  }
  setScreenSize(width: number, height: number, pixelRatio: number) {
    this.screenSize.set(width, height);
    this.pixelRatio = pixelRatio;
    const w = width * pixelRatio;
    const h = height * pixelRatio;
    (this.globalUniforms.uReciprocalScreenSize.value as Vector2).set(
      1 / w,
      1 / h
    );

    this.layers.forEach((rt) => {
      rt.setSize(w, h);
      rt.depthTexture.dispose();
      rt.depthTexture = new DepthTexture(w, h);
    });
  }
}
