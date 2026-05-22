import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { InteractionManager } from 'three/addons/interaction/InteractionManager.js';

const MACBOOK_MODEL_URL = '/models/macbook/scene.gltf';
const SCREEN_MATERIAL_NAME = 'sfCQkHOWyrsLmor';
const BACKGROUND_COLOR = 0xa0a0a0;
const VIEW_TARGET_Y = 1.15;

type ScreenMaterial = THREE.MeshBasicMaterial & { map: THREE.HTMLTexture | null };

export function mountMacBookScene(container: HTMLElement, sourceElement: HTMLElement): () => void {
  const status = document.getElementById('scene-status');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(BACKGROUND_COLOR, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.className = 'macbook-scene';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND_COLOR);
  scene.fog = new THREE.Fog(BACKGROUND_COLOR, 14, 32);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 1.1, 8.2);
  camera.lookAt(0, VIEW_TARGET_Y, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 2.5;
  controls.maxDistance = 12;
  controls.minPolarAngle = Math.PI / 4;
  controls.maxPolarAngle = Math.PI / 2;
  controls.target.set(0, VIEW_TARGET_Y, 0);
  controls.update();

  const modelRoot = new THREE.Group();
  modelRoot.rotation.set(-0.08, 0, 0);
  modelRoot.position.set(0, 0.55, 0);
  scene.add(modelRoot);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.2));

  const keyLight = new THREE.DirectionalLight(0xffffff, 3);
  keyLight.position.set(1.737, 1.721, -1.737);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x8fb7ff, 1.2);
  fillLight.position.set(-3, 1.5, 2);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffffff, 2);
  rimLight.position.set(0, 3, -4);
  scene.add(rimLight);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshPhongMaterial({ color: 0xbbbbbb, depthWrite: false }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.95;
  scene.add(ground);

  const grid = new THREE.GridHelper(40, 20, 0x000000, 0x000000);
  grid.position.y = -0.949;
  if (Array.isArray(grid.material)) {
    grid.material.forEach((material) => {
      material.opacity = 0.18;
      material.transparent = true;
    });
  } else {
    grid.material.opacity = 0.18;
    grid.material.transparent = true;
  }
  scene.add(grid);

  const htmlTexture = new THREE.CanvasTexture(sourceElement as HTMLCanvasElement);
  htmlTexture.colorSpace = THREE.SRGBColorSpace;

  const screenMaterial: ScreenMaterial = new THREE.MeshBasicMaterial({
    map: htmlTexture,
    toneMapped: false,
  }) as ScreenMaterial;
  screenMaterial.name = 'html-screen';

  const interactions = new InteractionManager();
  interactions.connect(renderer, camera);

  const loader = new GLTFLoader();
  loader.load(MACBOOK_MODEL_URL, (gltf) => {
    const model = gltf.scene;
    let foundScreen = false;

    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;

      object.castShadow = true;
      object.receiveShadow = true;

      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const isScreen = materials.some((material) => material?.name === SCREEN_MATERIAL_NAME);
      if (isScreen) {
        foundScreen = true;
        object.material = screenMaterial;
        interactions.add(object);
      }
    });

    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z);
    const scale = 3.7 / maxDimension;

    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    modelRoot.add(model);

    if (status) {
      status.textContent = foundScreen ? '' : 'MacBook loaded, but screen material was not found.';
    }
  }, undefined, (error) => {
    console.error('Failed to load MacBook model', error);
    if (status) status.textContent = 'Failed to load MacBook model.';
  });

  let width = 0;
  let height = 0;
  let raf = 0;
  let disposed = false;

  const resize = () => {
    const nextWidth = Math.max(1, Math.round(container.clientWidth));
    const nextHeight = Math.max(1, Math.round(container.clientHeight));

    if (nextWidth === width && nextHeight === height) return;

    width = nextWidth;
    height = nextHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    controls.target.set(0, VIEW_TARGET_Y, 0);
    controls.update();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  const render = () => {
    if (disposed) return;

    if (typeof (sourceElement as any).requestPaint === 'function') {
      (sourceElement as any).requestPaint();
    }
    htmlTexture.needsUpdate = true;
    interactions.update();
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(render);
  };
  render();

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    interactions.disconnect();
    controls.dispose();
    htmlTexture.dispose();
    screenMaterial.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
