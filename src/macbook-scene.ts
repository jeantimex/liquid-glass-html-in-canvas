import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { InteractionManager } from 'three/addons/interaction/InteractionManager.js';

const MACBOOK_MODEL_URL = '/models/macbook/scene.gltf';
const SCREEN_MATERIAL_NAME = 'sfCQkHOWyrsLmor';
const BACKGROUND_COLOR = 0xa0a0a0;
const VIEW_TARGET_Y = 1.15;

type ScreenMaterial = THREE.MeshBasicMaterial & { map: THREE.HTMLTexture | null };
type ScreenPoint = { x: number; y: number };
type DragState = {
  pointerId: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

export function mountMacBookScene(container: HTMLElement, sourceElement: HTMLElement): () => void {
  const status = document.getElementById('scene-status');
  const glassWindow = sourceElement.querySelector<HTMLElement>('.glass-window');
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
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const screenMeshes: THREE.Mesh[] = [];
  let dragState: DragState | null = null;

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
        screenMeshes.push(object);
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

  const getCanvasCssSize = () => {
    const style = getComputedStyle(sourceElement);
    return {
      width: parseFloat(style.width) || sourceElement.clientWidth || 1536,
      height: parseFloat(style.height) || sourceElement.clientHeight || 1024,
    };
  };

  const getElementBox = (element: HTMLElement) => {
    const sourceSize = getCanvasCssSize();
    const style = getComputedStyle(element);
    const width = element.getBoundingClientRect().width || parseFloat(style.width) || 0;
    const height = element.getBoundingClientRect().height || parseFloat(style.height) || parseFloat(style.minHeight) || 0;
    const left = parseFloat(style.left) || 0;
    const top = parseFloat(style.top) || 0;
    const maxLeft = Math.max(0, sourceSize.width - width);
    const maxTop = Math.max(0, sourceSize.height - height);

    return {
      left: THREE.MathUtils.clamp(left, 0, maxLeft),
      top: THREE.MathUtils.clamp(top, 0, maxTop),
      width,
      height,
      maxLeft,
      maxTop,
    };
  };

  const getScreenPointFromPointer = (event: PointerEvent): ScreenPoint | null => {
    if (screenMeshes.length === 0) return null;

    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const intersections = raycaster.intersectObjects(screenMeshes, false);
    const hit = intersections.find((intersection) => intersection.uv);
    if (!hit?.uv) return null;

    const sourceSize = getCanvasCssSize();
    return {
      x: THREE.MathUtils.clamp(hit.uv.x * sourceSize.width, 0, sourceSize.width),
      y: THREE.MathUtils.clamp((1 - hit.uv.y) * sourceSize.height, 0, sourceSize.height),
    };
  };

  const isInsideGlassWindow = (point: ScreenPoint) => {
    if (!glassWindow) return false;

    const box = getElementBox(glassWindow);
    return point.x >= box.left
      && point.x <= box.left + box.width
      && point.y >= box.top
      && point.y <= box.top + box.height;
  };

  const requestSourcePaint = () => {
    const paintableSource = sourceElement as HTMLElement & { requestPaint?: () => void };
    paintableSource.requestPaint?.();
  };

  const moveGlassWindow = (point: ScreenPoint) => {
    if (!glassWindow || !dragState) return;

    const nextLeft = THREE.MathUtils.clamp(point.x - dragState.offsetX, 0, Math.max(0, getCanvasCssSize().width - dragState.width));
    const nextTop = THREE.MathUtils.clamp(point.y - dragState.offsetY, 0, Math.max(0, getCanvasCssSize().height - dragState.height));

    glassWindow.style.left = `${nextLeft}px`;
    glassWindow.style.top = `${nextTop}px`;
    requestSourcePaint();
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!glassWindow || event.button !== 0) return;

    const point = getScreenPointFromPointer(event);
    if (!point || !isInsideGlassWindow(point)) return;

    const box = getElementBox(glassWindow);
    dragState = {
      pointerId: event.pointerId,
      offsetX: point.x - box.left,
      offsetY: point.y - box.top,
      width: box.width,
      height: box.height,
    };

    controls.enabled = false;
    renderer.domElement.setPointerCapture(event.pointerId);
    renderer.domElement.style.cursor = 'grabbing';
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    const point = getScreenPointFromPointer(event);
    if (point) moveGlassWindow(point);
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const stopDrag = (event: PointerEvent) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    dragState = null;
    controls.enabled = true;
    renderer.domElement.style.cursor = '';
    if (renderer.domElement.hasPointerCapture(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId);
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  renderer.domElement.addEventListener('pointerdown', onPointerDown, true);
  renderer.domElement.addEventListener('pointermove', onPointerMove, true);
  renderer.domElement.addEventListener('pointerup', stopDrag, true);
  renderer.domElement.addEventListener('pointercancel', stopDrag, true);

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
    renderer.domElement.removeEventListener('pointerdown', onPointerDown, true);
    renderer.domElement.removeEventListener('pointermove', onPointerMove, true);
    renderer.domElement.removeEventListener('pointerup', stopDrag, true);
    renderer.domElement.removeEventListener('pointercancel', stopDrag, true);
    controls.dispose();
    htmlTexture.dispose();
    screenMaterial.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
