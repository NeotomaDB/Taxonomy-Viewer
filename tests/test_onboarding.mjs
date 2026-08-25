import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Data Steward explanation is the final tour stop', async () => {
  const moduleUrl = new URL('../src/onboarding/steps.js', import.meta.url);
  moduleUrl.searchParams.set('test', Date.now());
  const { FIRST_TIME_TOUR_STEPS } = await import(moduleUrl.href);
  const finalStep = FIRST_TIME_TOUR_STEPS.at(-1);

  assert.equal(FIRST_TIME_TOUR_STEPS.length, 8);
  assert.equal(finalStep.popover.title, 'Data Steward View');
  assert.match(finalStep.popover.description, /recent taxonomy changes/i);
  assert.match(finalStep.popover.description, /resolved synonym relationships/i);
  assert.match(finalStep.popover.description, /potential taxonomic issues/i);
  assert.doesNotMatch(
    FIRST_TIME_TOUR_STEPS.map(step => step.popover.description).join(' '),
    /\bvisualizer\b/i,
  );
});

test('starting the tour runs its view transition callback', async () => {
  const handlers = new Map();
  const storage = new Map();
  const restartButton = {
    addEventListener(type, handler) {
      handlers.set(type, handler);
    },
  };

  globalThis.window = {
    addEventListener() {},
    clearTimeout() {},
    localStorage: {
      getItem(key) {
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        storage.set(key, value);
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
    setTimeout() {
      return 1;
    },
  };

  globalThis.document = {
    addEventListener() {},
    removeEventListener() {},
    body: {
      classList: {
        contains() {
          return false;
        },
        toggle() {},
      },
    },
    getElementById(id) {
      return id === 'takeTourBtn' ? restartButton : null;
    },
    querySelector() {
      return null;
    },
  };

  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    const moduleUrl = new URL('../src/onboarding/onboarding.js', import.meta.url);
    moduleUrl.searchParams.set('test', Date.now());
    const { initOnboarding } = await import(moduleUrl.href);
    let transitionCount = 0;

    initOnboarding({
      onStart: () => {
        transitionCount += 1;
      },
    });

    handlers.get('click')?.({ stopPropagation() {} });

    assert.equal(transitionCount, 1);
  } finally {
    console.warn = originalWarn;
    delete globalThis.document;
    delete globalThis.window;
  }
});

test('Take Tour loads its runtime from local project assets', async () => {
  const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(indexHtml, /assets\/vendor\/driver\.css\?v=1\.3\.5/);
  assert.match(indexHtml, /assets\/vendor\/driver\.js\.iife\.js\?v=1\.3\.5/);
  assert.doesNotMatch(indexHtml, /cdn\.jsdelivr\.net\/npm\/driver\.js/);
});
