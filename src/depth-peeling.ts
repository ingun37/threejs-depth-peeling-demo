import {
  Camera,
  Color,
  DataTexture,
  DepthTexture,
  IUniform,
  Material,
  Mesh,
  NoBlending,
  Scene,
  ShaderMaterial,
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
  const [ping, pong] = new Array(2)
    .fill(0)
    .map((): [WebGLRenderTarget, WebGLRenderTarget] => [
      new WebGLRenderTarget(p.width, p.height, {
        depthTexture: new DepthTexture(p.width, p.height),
      }),
      new WebGLRenderTarget(p.width, p.height),
    ]);

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
    renderer: p.renderer,
    scene: p.scene,
    width: p.width,
    height: p.height,
    underCompositeMaterial,
    quad: new FullScreenQuad(underCompositeMaterial),
    ping: ping,
    pong: pong,
    depth: p.depth,
    one: new DataTexture(new Uint8Array([1, 1, 1, 1]), 1, 1),
  };
}
export type DepthPeelingContext = ReturnType<typeof createDepthPeelingContext>;

const blendingCache = new Map<Mesh, number>();
export function render(
  dp: DepthPeelingContext,
  renderTarget: WebGLRenderTarget | null | undefined
) {
  blendingCache.clear();

  forEachMesh(dp.scene, (obj) => {
    blendingCache.set(obj, obj.material.blending);
    obj.material.blending = NoBlending;
  });

  dp.globalUniforms.uReciprocalScreenSize.value = new Vector2(
    1 / dp.width,
    1 / dp.height
  );

  const [layerA, compositeA] = dp.ping;
  const [layerB, compositeB] = dp.pong;
  const previousClearColor = new Color();
  dp.renderer.getClearColor(previousClearColor);
  dp.renderer.setClearColor(0x000000, 0);
  dp.renderer.setRenderTarget(layerA);
  dp.renderer.clear();
  dp.renderer.setRenderTarget(compositeA);
  dp.renderer.clear();

  const [, finalComposite] = new Array(dp.depth).fill(0).reduce(
    (
      [prevDepth, prevComposite]: [WebGLRenderTarget, WebGLRenderTarget],
      _,
      idx
    ): [WebGLRenderTarget, WebGLRenderTarget] => {
      const otherLayer = prevDepth === layerA ? layerB : layerA;
      const otherComposite =
        prevComposite === compositeA ? compositeB : compositeA;
      dp.globalUniforms.uPrevDepthTexture.value =
        idx === 0 ? dp.one : prevDepth.depthTexture;
      dp.renderer.setRenderTarget(otherLayer);
      dp.renderer.clear();
      dp.renderer.render(dp.scene, dp.camera);

      dp.renderer.setRenderTarget(
        idx < dp.depth - 1
          ? otherComposite // If it's not the final step then proceed ping-ponging
          : renderTarget // If it's the final step, and if renderTarget is given,
          ? renderTarget // ... then render to the given render Target
          : renderTarget === undefined // if render targen is undefined,
          ? otherComposite // ... then keep ping-ponging
          : null // or render to the main frame buffer
      );
      dp.renderer.clear();
      dp.underCompositeMaterial.uniforms.tDst.value = prevComposite.texture;
      dp.underCompositeMaterial.uniforms.tSrc.value = otherLayer.texture;
      dp.underCompositeMaterial.uniformsNeedUpdate = true;
      dp.quad.render(dp.renderer);
      return [otherLayer, otherComposite];
    },
    [layerA, compositeA]
  );

  dp.renderer.setRenderTarget(null);

  forEachMesh(dp.scene, (mesh) => {
    mesh.material.blending = blendingCache.get(mesh)!;
  });
  return finalComposite;
}

export function destroy(context: DepthPeelingContext) {
  throw "unimpl";
}

function forEachMesh(scene: Scene, f: (mesh: Mesh<any, Material>) => void) {
  scene.traverse((obj) => {
    if (obj instanceof Mesh && obj.material instanceof Material) f(obj);
  });
}
