import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';

const fixtureAudio = resolve('test-fixtures/audio/file_example_MP3_5MG.mp3');

test('renders the visualizer controls and WebGL canvas', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'SpectraFlux' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /radial/i })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('canvas.visualizer-canvas')).toBeVisible();
  await expect(page.getByText('Beat')).toBeVisible();

  const canvasSample = await page.locator('canvas.visualizer-canvas').evaluate((canvas) => {
    const element = canvas as HTMLCanvasElement;
    const context = element.getContext('webgl');
    return {
      width: element.width,
      height: element.height,
      hasWebgl: Boolean(context),
    };
  });

  expect(canvasSample.width).toBeGreaterThan(0);
  expect(canvasSample.height).toBeGreaterThan(0);
  expect(canvasSample.hasWebgl).toBe(true);
  expect(consoleErrors).toEqual([]);
});

test('loads fixture audio through file input without serving test assets publicly', async ({ page }) => {
  await page.goto('/');

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByTitle('Load audio file').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(fixtureAudio);

  await expect(page.getByText(/file_example_MP3_5MG\.mp3/)).toBeVisible();
  await expect(page.getByText(/Playing|Paused/)).toBeVisible();

  const publicAudioResponse = await page.request.get('/test-audio/file_example_MP3_5MG.mp3');
  expect(publicAudioResponse.headers()['content-type']).not.toContain('audio');
});

test('loads audio when dropped onto the visualizer', async ({ page }) => {
  await page.goto('/');

  const dataTransfer = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    const file = new File([new Uint8Array([73, 68, 51, 4, 0, 0, 0, 0, 0, 0])], 'dropped-test.mp3', {
      type: 'audio/mpeg',
    });
    transfer.items.add(file);
    return transfer;
  });

  await page.dispatchEvent('main', 'dragenter', { dataTransfer });
  await expect(page.getByText('Drop audio to load')).toBeVisible();

  await page.dispatchEvent('main', 'drop', { dataTransfer });

  await expect(page.getByText(/dropped-test\.mp3/)).toBeVisible();
  await expect(page.getByText(/Playing|Paused/)).toBeVisible();
  await expect(page.getByText('Drop audio to load')).toBeHidden();
});
