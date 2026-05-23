type ScreenPointerEvent = CustomEvent<{ x: number; y: number }>;

const DEFAULT_URL = '/browser-demo.html';

function escapeHTML(value: string): string {
  const template = document.createElement('template');
  template.textContent = value;
  return template.innerHTML;
}

function isSameOriginPath(value: string) {
  return value.startsWith('/') && !value.startsWith('//');
}

function getDemoError(message: string) {
  return `<main class="browser-demo-page browser-error">
    <h1>Page unavailable</h1>
    <p>${escapeHTML(message)}</p>
  </main>`;
}

function getElementBox(element: HTMLElement, root: HTMLElement) {
  const rootStyle = getComputedStyle(root);
  const rootWidth = parseFloat(rootStyle.width) || root.clientWidth || 1536;
  const rootHeight = parseFloat(rootStyle.height) || root.clientHeight || 1024;
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  const width = rect.width || parseFloat(style.width) || 0;
  const height = rect.height || parseFloat(style.height) || parseFloat(style.minHeight) || 0;
  const left = parseFloat(style.left) || 0;
  const top = parseFloat(style.top) || 0;

  return {
    left,
    top,
    width,
    height,
    right: Math.min(rootWidth, left + width),
    bottom: Math.min(rootHeight, top + height),
  };
}

function pointInBox(point: { x: number; y: number }, box: ReturnType<typeof getElementBox>) {
  return point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
}

function getAddressBox(browser: HTMLElement, root: HTMLElement) {
  const browserBox = getElementBox(browser, root);
  const toolbarPaddingX = 18;
  const toolbarHeight = 72;
  const trafficLightWidth = 58;
  const toolbarGap = 16;
  const addressHeight = 38;
  const left = browserBox.left + toolbarPaddingX + trafficLightWidth + toolbarGap;
  const top = browserBox.top + (toolbarHeight - addressHeight) / 2;
  const width = browserBox.width - left + browserBox.left - toolbarPaddingX;

  return {
    left,
    top,
    width,
    height: addressHeight,
    right: left + width,
    bottom: top + addressHeight,
  };
}

function isPrintableKey(event: KeyboardEvent) {
  return event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;
}

export function mountDesktopBrowser(root: HTMLElement): () => void {
  const browser = root.querySelector<HTMLElement>('.browser-window');
  const address = root.querySelector<HTMLElement>('.browser-address');
  const frame = root.querySelector<HTMLElement>('.browser-frame');
  if (!browser || !address || !frame) return () => {};

  let active = false;
  let addressValue = DEFAULT_URL;

  const requestPaint = () => {
    const canvas = root as HTMLCanvasElement & { requestPaint?: () => void };
    canvas.requestPaint?.();
  };

  const renderAddress = () => {
    address.textContent = addressValue || 'Type HTML and press Enter';
    address.classList.toggle('is-empty', addressValue.length === 0);
    address.classList.toggle('is-active', active);
    requestPaint();
  };

  const renderFetchedHTML = (html: string) => {
    const document = new DOMParser().parseFromString(html, 'text/html');
    const styles = Array.from(document.head.querySelectorAll('style')).map((style) => style.outerHTML).join('');
    frame.innerHTML = `${styles}${document.body.innerHTML}`;
  };

  const renderContent = async () => {
    const value = addressValue.trim();
    if (isSameOriginPath(value)) {
      try {
        const response = await fetch(value);
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        renderFetchedHTML(await response.text());
      } catch (error) {
        frame.innerHTML = getDemoError(`Could not load ${value}. ${error instanceof Error ? error.message : ''}`);
      }
    } else if (/^https?:\/\//i.test(value)) {
      frame.innerHTML = getDemoError('External sites usually cannot be embedded or captured here. Use a same-origin path or type HTML.');
    } else {
      frame.innerHTML = value || getDemoError('No HTML entered.');
    }
    requestPaint();
  };

  const onScreenPointerDown = (event: Event) => {
    const pointerEvent = event as ScreenPointerEvent;
    const point = pointerEvent.detail;
    const browserBox = getElementBox(browser, root);

    if (!pointInBox(point, browserBox)) {
      active = false;
      renderAddress();
      return;
    }

    const addressBox = getAddressBox(browser, root);
    active = pointInBox(point, addressBox);
    renderAddress();
    pointerEvent.preventDefault();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!active) return;

    if (event.key === 'Enter') {
      renderContent();
      event.preventDefault();
      return;
    }

    if (event.key === 'Escape') {
      active = false;
      renderAddress();
      event.preventDefault();
      return;
    }

    if (event.key === 'Backspace') {
      addressValue = addressValue.slice(0, -1);
      renderAddress();
      event.preventDefault();
      return;
    }

    if (isPrintableKey(event)) {
      addressValue += event.key;
      renderAddress();
      event.preventDefault();
    }
  };

  const onPaste = (event: ClipboardEvent) => {
    if (!active) return;

    const text = event.clipboardData?.getData('text/plain');
    if (!text) return;
    addressValue += text;
    renderAddress();
    event.preventDefault();
  };

  renderAddress();
  renderContent();

  root.addEventListener('screenpointerdown', onScreenPointerDown);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('paste', onPaste);

  return () => {
    root.removeEventListener('screenpointerdown', onScreenPointerDown);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('paste', onPaste);
  };
}
