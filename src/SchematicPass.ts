import {
  Color,
  DepthTexture,
  FloatType,
  NoBlending,
  NormalBlending,
  Object3D,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  UniformsUtils,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { FullScreenQuad, Pass } from "three/examples/jsm/postprocessing/Pass";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader";
import { BlurRenderTarget } from "./BlurRenderTarget";

class SchematicPass extends Pass {
  renderScene: Scene;
  renderCamera: PerspectiveCamera;
  visibleEdgeColor = new Color(0, 0, 0);
  silhouetteWidth = 1.5;
  downSampleRatio = 2;
  resolution: Vector2;
  renderTargetMaskBuffer: WebGLRenderTarget;
  lineBuffer: BlurRenderTarget;
  renderTargetMaskDownSampleBuffer: WebGLRenderTarget;
  edgeDetectionMaterial: ShaderMaterial;
  overlayMaterial: ShaderMaterial;
  _oldClearColor = new Color();
  copyUniforms: typeof CopyShader.uniforms;
  materialCopy: ShaderMaterial;
  oldClearAlpha = 1;
  fsQuad = new FullScreenQuad();
  renderTargetEdgeBuffer1: BlurRenderTarget;

  constructor(
    resolution: Vector2,
    private pixelRatio: number,
    scene: Scene,
    camera: PerspectiveCamera,
    private lineObject: Object3D
  ) {
    super();

    this.renderScene = scene;
    this.renderCamera = camera;

    this.resolution = resolution;

    this.renderTargetMaskBuffer = new WebGLRenderTarget(
      this.resolution.x,
      this.resolution.y,
      {
        depthTexture: makeDepthTexture(this.resolution.x, this.resolution.y),
      }
    );
    this.lineBuffer = new BlurRenderTarget(
      this.resolution.x,
      this.resolution.y,
      pixelRatio,
      1,
      1
    );
    // this.lineBuffer.samples = 4;

    const resx = Math.round(
      this.resolution.x / this.downSampleRatio / pixelRatio
    );
    const resy = Math.round(
      this.resolution.y / this.downSampleRatio / pixelRatio
    );

    this.renderTargetMaskDownSampleBuffer = new WebGLRenderTarget(resx, resy);
    this.edgeDetectionMaterial = this.getEdgeDetectionMaterial();
    this.edgeDetectionMaterial.uniforms["texSize"].value.set(resx, resy);
    this.renderTargetEdgeBuffer1 = new BlurRenderTarget(
      resx,
      resy,
      1,
      this.silhouetteWidth,
      this.silhouetteWidth
    );

    // Overlay material
    this.overlayMaterial = this.getOverlayMaterial();
    this.overlayMaterial.uniforms.innerLineStrength.value =
      (3 * (pixelRatio * 2 + 1)) / 3;
    // copy material
    if (CopyShader === undefined)
      console.error("THREE.OutlinePass relies on CopyShader");

    const copyShader = CopyShader;

    this.copyUniforms = UniformsUtils.clone(copyShader.uniforms);
    this.copyUniforms["opacity"].value = 1.0;

    this.materialCopy = new ShaderMaterial({
      uniforms: this.copyUniforms,
      vertexShader: copyShader.vertexShader,
      fragmentShader: copyShader.fragmentShader,
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });

    this.enabled = true;
    this.needsSwap = false;
  }

  dispose() {
    this.renderTargetMaskBuffer.depthTexture.dispose();
    this.renderTargetMaskBuffer.dispose();
    this.lineBuffer.dispose();
    this.renderTargetMaskDownSampleBuffer.dispose();
    this.renderTargetEdgeBuffer1.dispose();
    console.log("Schematic Pass Disposed!!");
  }

  setSize(width: number, height: number) {
    this.renderTargetMaskBuffer.depthTexture.dispose();
    this.renderTargetMaskBuffer.setSize(width, height);
    this.renderTargetMaskBuffer.depthTexture = makeDepthTexture(width, height);
    this.lineBuffer.resize(width, height);
    let resx = Math.round(width / this.downSampleRatio / this.pixelRatio);
    let resy = Math.round(height / this.downSampleRatio / this.pixelRatio);
    this.edgeDetectionMaterial.uniforms["texSize"].value.set(resx, resy);
    this.renderTargetMaskDownSampleBuffer.setSize(resx, resy);
    this.renderTargetEdgeBuffer1.resize(resx, resy);
  }

  render(
    renderer: WebGLRenderer,
    writeBuffer: WebGLRenderTarget,
    readBuffer: WebGLRenderTarget,
    deltaTime: number
  ) {
    renderer.getClearColor(this._oldClearColor);
    this.oldClearAlpha = renderer.getClearAlpha();
    const oldAutoClear = renderer.autoClear;

    renderer.autoClear = false;

    renderer.setClearColor(0x000000, 0);

    // Make selected objects invisible

    const currentBackground = this.renderScene.background;
    this.renderScene.background = null;

    // Make non selected objects invisible, and draw only the selected objects, by comparing the depth buffer of non selected objects

    renderer.setRenderTarget(this.renderTargetMaskBuffer);
    renderer.clear();
    renderer.render(this.renderScene, this.renderCamera);
    this.renderScene.overrideMaterial = null;

    this.renderScene.background = currentBackground;

    // 2. Downsample to Half resolution
    this.fsQuad.material = this.materialCopy;
    this.copyUniforms["tDiffuse"].value = this.renderTargetMaskBuffer.texture;
    renderer.setRenderTarget(this.renderTargetMaskDownSampleBuffer);
    renderer.clear();
    this.fsQuad.render(renderer);

    // 3. Apply Edge Detection Pass
    this.fsQuad.material = this.edgeDetectionMaterial;
    this.edgeDetectionMaterial.uniforms["maskTexture"].value =
      this.renderTargetMaskDownSampleBuffer.texture;

    this.edgeDetectionMaterial.uniforms["visibleEdgeColor"].value =
      this.visibleEdgeColor;

    renderer.setRenderTarget(this.renderTargetEdgeBuffer1.buffer);
    renderer.clear();
    this.fsQuad.render(renderer);

    // 4. Apply Blur on Half res
    this.renderTargetEdgeBuffer1.blur(renderer);

    // draw line
    renderer.setClearColor(0x000000, 0);
    this.lineBuffer.buffer.depthTexture =
      this.renderTargetMaskBuffer.depthTexture;
    renderer.setRenderTarget(this.lineBuffer.buffer);
    renderer.clear(true, false, true);
    renderer.render(this.lineObject, this.renderCamera);
    this.lineBuffer.blur(renderer);

    // Blend it additively over the input texture
    this.fsQuad.material = this.overlayMaterial;
    this.overlayMaterial.uniforms["maskTexture"].value =
      this.renderTargetMaskBuffer.texture;
    this.overlayMaterial.uniforms["edgeTexture1"].value =
      this.renderTargetEdgeBuffer1.buffer.texture;

    this.overlayMaterial.uniforms["edgeStrength"].value =
      this.silhouetteWidth * 2;
    this.overlayMaterial.uniforms["innerLineTexture"].value =
      this.lineBuffer.buffer.texture;

    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    renderer.setClearColor(this._oldClearColor, this.oldClearAlpha);
    renderer.clear();
    this.fsQuad.render(renderer);
    renderer.autoClear = oldAutoClear;
  }

  getEdgeDetectionMaterial() {
    return new ShaderMaterial({
      uniforms: {
        maskTexture: { value: null },
        texSize: { value: new Vector2(0.5, 0.5) },
        visibleEdgeColor: { value: new Vector3(1.0, 1.0, 1.0) },
      },

      vertexShader: `varying vec2 vUv;

				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,

      fragmentShader: `varying vec2 vUv;

				uniform sampler2D maskTexture;
				uniform vec2 texSize;
				uniform vec3 visibleEdgeColor;

				void main() {
					vec2 invSize = 1.0 / texSize;
					vec4 uvOffset = vec4(1.0, 0.0, 0.0, 1.0) * vec4(invSize, invSize);
					vec4 c1 = texture2D( maskTexture, vUv + uvOffset.xy);
					vec4 c2 = texture2D( maskTexture, vUv - uvOffset.xy);
					vec4 c3 = texture2D( maskTexture, vUv + uvOffset.yw);
					vec4 c4 = texture2D( maskTexture, vUv - uvOffset.yw);
					float d1 = (c1.a - c2.a);
					float d2 = (c3.a - c4.a);
					float d = length( vec2(d1, d2) );
					gl_FragColor = vec4(visibleEdgeColor, 1.0) * vec4(d);
				}`,
    });
  }

  getOverlayMaterial() {
    return new ShaderMaterial({
      uniforms: {
        maskTexture: { value: null },
        edgeTexture1: { value: null },
        edgeStrength: { value: 1.0 },
        innerLineTexture: { value: null },
        innerLineStrength: { value: 1.0 },
      },

      vertexShader: `varying vec2 vUv;

				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,

      fragmentShader: `varying vec2 vUv;

				uniform sampler2D maskTexture;
				uniform sampler2D edgeTexture1;
				uniform float edgeStrength;
				uniform float innerLineStrength;
        uniform sampler2D innerLineTexture;
 
        vec4 sampleInnerLine(in vec2 vUv) {
        	vec4 center = texture2D( innerLineTexture, vUv) * innerLineStrength;
          return center;
          // vec2 invSize = 1.0 / innerLineTexSize;
					// vec4 uvOffset = vec4(1.0, 0.0, 0.0, 1.0) * vec4(invSize, invSize);
					// vec4 c1 = 2.0 * texture2D( innerLineTexture, vUv + uvOffset.xy);
					// vec4 c2 = 2.0 * texture2D( innerLineTexture, vUv - uvOffset.xy);
					// vec4 c3 = 2.0 * texture2D( innerLineTexture, vUv + uvOffset.yw);
					// vec4 c4 = 2.0 * texture2D( innerLineTexture, vUv - uvOffset.yw);
					// return (c1 + c2 + c3 + c4 + center) / 4.0;
        }
				void main() {
					vec4 innerLineColor = sampleInnerLine(vUv);
					vec4 edgeValue = texture2D(edgeTexture1, vUv);
					vec4 maskColor = texture2D(maskTexture, vUv);
					vec4 finalColor = edgeStrength * (1.0-maskColor.a) * edgeValue;
					vec4 black = vec4(0.0,0.0,0.0,1.0);
					vec4 line = mix(finalColor, black, innerLineColor.a);
					gl_FragColor = mix(maskColor, line, line.a);
					// gl_FragColor = innerLineColor;
				}`,
      blending: NormalBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
  }
}

function makeDepthTexture(w: number, h: number) {
  return new DepthTexture(w, h, FloatType);
}

export { SchematicPass };
