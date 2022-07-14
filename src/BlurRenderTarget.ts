/**
 * Blur-able render target
 * Ingun 2022-06-21
 */
import {
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";

export class BlurRenderTarget {
  static BlurDirectionX = new Vector2(1.0, 0.0);
  static BlurDirectionY = new Vector2(0.0, 1.0);
  buffer: WebGLRenderTarget;
  private readonly pingPong: WebGLRenderTarget;
  private material: ShaderMaterial;
  private quad = new FullScreenQuad();
  constructor(
    private width: number,
    private height: number,
    private pixelRatio: number,
    maxRadius: number,
    kernelRadius: number
  ) {
    this.buffer = new WebGLRenderTarget(width, height);
    this.pingPong = new WebGLRenderTarget(width, height);
    this.material = makeSeparableBlurMaterial(
      Math.ceil(maxRadius * pixelRatio)
    );

    this.material.uniforms["texSize"].value.set(
      width / pixelRatio,
      height / pixelRatio
    );
    this.material.uniforms["kernelRadius"].value = kernelRadius;
  }

  resize(width: number, height: number) {
    this.buffer.setSize(width, height);
    this.pingPong.setSize(width, height);
    this.material.uniforms["texSize"].value.set(
      width / this.pixelRatio,
      height / this.pixelRatio
    );
  }

  dispose() {
    this.buffer.dispose();
    this.material.dispose();
    this.pingPong.dispose();
    this.quad.dispose();
  }
  blur(renderer: WebGLRenderer) {
    this.quad.material = this.material;
    this.material.uniforms["colorTexture"].value = this.buffer.texture;
    this.material.uniforms["direction"].value = BlurRenderTarget.BlurDirectionX;
    renderer.setRenderTarget(this.pingPong);
    renderer.clear();
    this.quad.render(renderer);
    this.material.uniforms["colorTexture"].value = this.pingPong.texture;
    this.material.uniforms["direction"].value = BlurRenderTarget.BlurDirectionY;
    renderer.setRenderTarget(this.buffer);
    renderer.clear();
    this.quad.render(renderer);
  }
}

function makeSeparableBlurMaterial(maxRadius: number) {
  return new ShaderMaterial({
    defines: {
      MAX_RADIUS: maxRadius,
    },

    uniforms: {
      colorTexture: { value: null },
      texSize: { value: new Vector2(0.5, 0.5) },
      direction: { value: new Vector2(0.5, 0.5) },
      kernelRadius: { value: 1.0 },
    },

    vertexShader: `varying vec2 vUv;

				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,

    fragmentShader: `#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 texSize;
				uniform vec2 direction;
				uniform float kernelRadius;

				float gaussianPdf(in float x) {
				  float s = float(MAX_RADIUS)/2.0;
					return 0.39894 * exp( -0.5 * x * x / ( s * s ))/s;
				}

				void main() {
					vec2 invSize = 1.0 / texSize;
					float weightSum = gaussianPdf(0.0);
					vec4 diffuseSum = texture2D( colorTexture, vUv) * weightSum;
					vec2 delta = direction * invSize * kernelRadius/float(MAX_RADIUS);
					vec2 uvOffset = delta;
					for( int i = 1; i <= MAX_RADIUS; i ++ ) {
						float w = gaussianPdf(float(i));
						vec4 sample1 = texture2D( colorTexture, vUv + uvOffset);
						vec4 sample2 = texture2D( colorTexture, vUv - uvOffset);
						diffuseSum += ((sample1 + sample2) * w);
						weightSum += (2.0 * w);
						uvOffset += delta;
					}
					gl_FragColor = diffuseSum/weightSum;
				}`,
  });
}
