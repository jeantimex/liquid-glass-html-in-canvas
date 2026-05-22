import { mountMacBookScene } from './macbook-scene';

const sceneRoot = document.getElementById('scene-root');
const screenElement = document.getElementById('computer-screen');

if (!sceneRoot || !screenElement) {
  throw new Error('Missing scene root or computer screen element');
}

mountMacBookScene(sceneRoot, screenElement);
