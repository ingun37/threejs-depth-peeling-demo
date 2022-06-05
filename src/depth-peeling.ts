import {
  Camera,
  DepthTexture,
  IUniform,
  Material,
  Mesh,
  NoBlending,
  Scene,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";

export type Parameters = {
  renderer: WebGLRenderer;
  camera: Camera;
  scene: Scene;
  width: number;
  height: number;
};
export type GlobalUniform = {
  uLayer: IUniform;
  uPrevDepthTexture: IUniform;
  uPrevColorTexture: IUniform;
  uScreenSize: IUniform;
};
export type DepthPeelingContext = {
  scene: Scene;
  layer0: WebGLRenderTarget;
  renderer: WebGLRenderer;
  camera: Camera;
  globalUniforms: GlobalUniform;
};

export function createDepthPeelingContext({
  scene,
  height,
  width,
  renderer,
  camera,
}: Parameters): DepthPeelingContext {
  let globalUniforms: GlobalUniform = {
    uLayer: { value: 0 },
    uPrevDepthTexture: { value: null },
    uPrevColorTexture: { value: null },
    uScreenSize: { value: new Vector2(1, 1) },
  };
  scene.traverse((obj) => {
    if (obj instanceof Mesh && obj.material instanceof Material) {
      obj.material.onBeforeCompile = (shader) => {
        shader.uniforms.uScreenSize = globalUniforms.uScreenSize;
        shader.uniforms.uPrevDepthTexture = globalUniforms.uPrevDepthTexture;
        shader.uniforms.uLayer = globalUniforms.uLayer;

        shader.fragmentShader = `
					uniform vec2 uScreenSize;
					uniform sampler2D uPrevDepthTexture;
					uniform int uLayer;

					${shader.fragmentShader}
				`;
        //peel depth
        shader.fragmentShader = shader.fragmentShader.replace(
          /}$/gm,
          `
    if( uLayer != 0 ) {
        vec2 screenPos = gl_FragCoord.xy * uScreenSize;
        float prevDepth = texture2D(uPrevDepthTexture,screenPos).x;
        if( prevDepth >= gl_FragCoord.z ) {
            discard;
        }
    }
}
					`
        );
      };
      obj.material.needsUpdate = true;
    }
  });
  const depthT = new DepthTexture(width, height);
  const layer0 = new WebGLRenderTarget(width, height, {
    depthTexture: depthT,
  });
  return {
    camera,
    globalUniforms,
    layer0,
    renderer,
    scene,
  };
}
const blendingCache = new Map<Mesh, number>();
export function render({
  scene,
  renderer,
  layer0,
  camera,
}: DepthPeelingContext) {
  blendingCache.clear();

  scene.traverse((obj) => {
    if (obj instanceof Mesh && obj.material instanceof Material) {
      blendingCache.set(obj, obj.material.blending);
      obj.material.blending = NoBlending;
    }
  });
  renderer.setRenderTarget(layer0);
  renderer.render(scene, camera);

  renderer.setRenderTarget(null);
  // TODO restore blending
}

export function destroy(context: DepthPeelingContext) {
  throw "unimpl";
}
