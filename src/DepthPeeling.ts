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
    uPrevColorTexture: IUniform;
    uReciprocalScreenSize: IUniform;
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
  private originalClearColor = new Color();
  private ownScene = new Scene();
  constructor(p: { width: number; height: number; depth: number }) {
    this.globalUniforms = {
      uPrevDepthTexture: { value: null },
      uPrevColorTexture: { value: null },
      uReciprocalScreenSize: { value: new Vector2(1, 1) },
    };

    this.setScreenSize(p.width, p.height);
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
  if( prevDepth + 0.00001 >= gl_FragCoord.z )
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
    renderer.getSize(this.screenSize);

    if (
      this.screenSize.width !== this.layers[0].width ||
      this.screenSize.height !== this.layers[0].height
    )
      this.setScreenSize(this.screenSize.width, this.screenSize.height);
    const width = this.screenSize.width;
    const height = this.screenSize.height;
    this.globalUniforms.uReciprocalScreenSize.value = new Vector2(
      1 / width,
      1 / height
    );

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

    while (this.layers.length < depth)
      this.layers.push(
        new WebGLRenderTarget(this.screenSize.width, this.screenSize.height, {
          depthTexture: new DepthTexture(
            this.screenSize.width,
            this.screenSize.height
          ),
        })
      );

    this.depth = depth;
  }
  setScreenSize(width: number, height: number) {
    (this.globalUniforms.uReciprocalScreenSize.value as Vector2).set(
      1 / width,
      1 / height
    );

    this.layers.forEach((rt) => {
      rt.setSize(width, height);
      rt.depthTexture.dispose();
      rt.depthTexture = new DepthTexture(width, height);
    });
  }
}
