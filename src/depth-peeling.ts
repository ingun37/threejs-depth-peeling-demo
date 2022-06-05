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
  uReciprocalScreenSize: IUniform;
};
export type DepthPeelingContext = {
  scene: Scene;
  layer0: WebGLRenderTarget;
  layer1: WebGLRenderTarget;
  layer2: WebGLRenderTarget;
  layer3: WebGLRenderTarget;
  layer4: WebGLRenderTarget;
  renderer: WebGLRenderer;
  camera: Camera;
  globalUniforms: GlobalUniform;
  width: number;
  height: number;
};

export function createDepthPeelingContext(p: Parameters): DepthPeelingContext {
  let globalUniforms: GlobalUniform = {
    uLayer: { value: 0 },
    uPrevDepthTexture: { value: null },
    uPrevColorTexture: { value: null },
    uReciprocalScreenSize: { value: new Vector2(1, 1) },
  };
  p.scene.traverse((obj) => {
    if (obj instanceof Mesh && obj.material instanceof Material) {
      obj.material.onBeforeCompile = (shader) => {
        shader.uniforms.uReciprocalScreenSize =
          globalUniforms.uReciprocalScreenSize;
        shader.uniforms.uPrevDepthTexture = globalUniforms.uPrevDepthTexture;
        shader.uniforms.uLayer = globalUniforms.uLayer;

        shader.fragmentShader = `
					uniform vec2 uReciprocalScreenSize;
					uniform sampler2D uPrevDepthTexture;
					uniform int uLayer;

					${shader.fragmentShader}
				`;
        //peel depth
        shader.fragmentShader = shader.fragmentShader.replace(
          /}$/gm,
          `
    if( uLayer != 0 ) {
        vec2 screenPos = gl_FragCoord.xy * uReciprocalScreenSize;
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
  const depth0 = new DepthTexture(p.width, p.height);
  const layer0 = new WebGLRenderTarget(p.width, p.height, {
    depthTexture: depth0,
  });
  const depth1 = new DepthTexture(p.width, p.height);
  const layer1 = new WebGLRenderTarget(p.width, p.height, {
    depthTexture: depth1,
  });
  const depth2 = new DepthTexture(p.width, p.height);
  const layer2 = new WebGLRenderTarget(p.width, p.height, {
    depthTexture: depth2,
  });

  const depth3 = new DepthTexture(p.width, p.height);
  const layer3 = new WebGLRenderTarget(p.width, p.height, {
    depthTexture: depth3,
  });

  const depth4 = new DepthTexture(p.width, p.height);
  const layer4 = new WebGLRenderTarget(p.width, p.height, {
    depthTexture: depth4,
  });

  return {
    camera: p.camera,
    globalUniforms,
    layer0,
    layer1,
    layer2,
    layer3,
    layer4,
    renderer: p.renderer,
    scene: p.scene,
    width: p.width,
    height: p.height,
  };
}
const blendingCache = new Map<Mesh, number>();
export function render(dp: DepthPeelingContext) {
  blendingCache.clear();

  dp.scene.traverse((obj) => {
    if (obj instanceof Mesh && obj.material instanceof Material) {
      blendingCache.set(obj, obj.material.blending);
      obj.material.blending = NoBlending;
    }
  });
  dp.renderer.setRenderTarget(dp.layer0);
  dp.renderer.render(dp.scene, dp.camera);

  dp.globalUniforms.uPrevDepthTexture.value = dp.layer0.depthTexture;
  dp.globalUniforms.uLayer.value = 1;
  dp.globalUniforms.uReciprocalScreenSize.value = new Vector2(
    1 / dp.width,
    1 / dp.height
  );

  dp.renderer.setRenderTarget(dp.layer1);
  dp.renderer.clear();
  dp.renderer.render(dp.scene, dp.camera);

  dp.globalUniforms.uPrevDepthTexture.value = dp.layer1.depthTexture;
  dp.globalUniforms.uLayer.value = 2;

  dp.renderer.setRenderTarget(dp.layer2);
  dp.renderer.clear();
  dp.renderer.render(dp.scene, dp.camera);

  dp.globalUniforms.uPrevDepthTexture.value = dp.layer2.depthTexture;
  dp.globalUniforms.uLayer.value = 3;

  dp.renderer.setRenderTarget(dp.layer3);
  dp.renderer.clear();
  dp.renderer.render(dp.scene, dp.camera);

  dp.globalUniforms.uPrevDepthTexture.value = dp.layer3.depthTexture;
  dp.globalUniforms.uLayer.value = 4;

  dp.renderer.setRenderTarget(dp.layer4);
  dp.renderer.clear();
  dp.renderer.render(dp.scene, dp.camera);

  dp.renderer.setRenderTarget(null);
  // TODO restore blending
}

export function destroy(context: DepthPeelingContext) {
  throw "unimpl";
}
