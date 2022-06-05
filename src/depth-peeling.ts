import {
  Camera,
  DataTexture,
  DepthTexture,
  IUniform,
  Material,
  Mesh,
  NoBlending,
  Scene,
  ShaderMaterial,
  Texture,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";

export type Parameters = {
  renderer: WebGLRenderer;
  camera: Camera;
  scene: Scene;
  width: number;
  height: number;
  depth: number;
};
export type GlobalUniform = {
  uPrevDepthTexture: IUniform;
  uPrevColorTexture: IUniform;
  uReciprocalScreenSize: IUniform;
};

export function createDepthPeelingContext(p: Parameters) {
  let globalUniforms: GlobalUniform = {
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
        shader.fragmentShader = `
// --- DEPTH PEELING SHADER CHUNK (START)
uniform vec2 uReciprocalScreenSize;
uniform sampler2D uPrevDepthTexture;
uniform int uLayer;
// --- DEPTH PEELING SHADER CHUNK (END)
					${shader.fragmentShader}
				`;
        //peel depth
        shader.fragmentShader = shader.fragmentShader.replace(
          /}$/gm,
          `
// --- DEPTH PEELING SHADER CHUNK (START)
  vec2 screenPos = gl_FragCoord.xy * uReciprocalScreenSize;
  float prevDepth = texture2D(uPrevDepthTexture,screenPos).x;
  if( prevDepth >= gl_FragCoord.z )
      discard;
// --- DEPTH PEELING SHADER CHUNK (END)
}
					`
        );
      };
      obj.material.needsUpdate = true;
    }
  });
  const layers = new Array(p.depth).fill(0).map(
    () =>
      new WebGLRenderTarget(p.width, p.height, {
        depthTexture: new DepthTexture(p.width, p.height),
      })
  );
  const finals = layers.map(() => new WebGLRenderTarget(p.width, p.height));

  const underCompositeMaterial = new ShaderMaterial({
    vertexShader: `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,
    fragmentShader: `
        uniform sampler2D tDst;
        uniform sampler2D tSrc;
        varying vec2 vUv;
        void main() {
          vec4 d = texture2D(tDst, vUv);
          vec4 s = texture2D(tSrc, vUv);
          vec3 c = d.a * d.xyz + (1.-d.a)*s.a*s.xyz;
          float a = s.a - s.a*d.a + d.a;
          gl_FragColor = vec4(c, a);
          // gl_FragColor = s;
        }`,
    uniforms: {
      tDst: { value: null },
      tSrc: { value: null },
    },
  });
  return {
    camera: p.camera,
    globalUniforms,
    layers,
    renderer: p.renderer,
    scene: p.scene,
    width: p.width,
    height: p.height,
    finals,
    underCompositeMaterial,
    quad: new FullScreenQuad(underCompositeMaterial),
    zero: new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1),
    one: new DataTexture(new Uint8Array([1, 1, 1, 1]), 1, 1),
  };
}
export type DepthPeelingContext = ReturnType<typeof createDepthPeelingContext>;

const blendingCache = new Map<Mesh, number>();
export function render(dp: DepthPeelingContext) {
  blendingCache.clear();

  dp.scene.traverse((obj) => {
    if (obj instanceof Mesh && obj.material instanceof Material) {
      blendingCache.set(obj, obj.material.blending);
      obj.material.blending = NoBlending;
    }
  });

  dp.globalUniforms.uReciprocalScreenSize.value = new Vector2(
    1 / dp.width,
    1 / dp.height
  );

  new Array(dp.layers.length).fill(0).reduce(
    (
      [prevDepth, prevLayer]: [Texture, Texture],
      _,
      idx
    ): [Texture, Texture] => {
      const layer = dp.layers[idx];
      const final = dp.finals[idx];
      dp.globalUniforms.uPrevDepthTexture.value = prevDepth;
      dp.renderer.setRenderTarget(layer);
      dp.renderer.clear();
      dp.renderer.render(dp.scene, dp.camera);
      dp.renderer.setRenderTarget(final);
      dp.renderer.clear();
      dp.underCompositeMaterial.uniforms.tDst.value = prevLayer;
      dp.underCompositeMaterial.uniforms.tSrc.value = layer.texture;
      dp.underCompositeMaterial.uniformsNeedUpdate = true;
      dp.quad.render(dp.renderer);
      return [layer.depthTexture, final.texture];
    },
    [dp.one, dp.zero]
  );

  dp.renderer.setRenderTarget(null);
  // TODO restore blending
}

export function destroy(context: DepthPeelingContext) {
  throw "unimpl";
}
