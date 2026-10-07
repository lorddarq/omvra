// Actual Goals view in an isolated Electron window; no user store or runtime.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
app.on('window-all-closed', () => {});

(async () => {
  const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'omvra-goals-viewport-')));
  app.setPath('userData', path.join(directory, 'user-data'));
  let win;
  try {
    await fs.writeFile(path.join(directory, 'index.html'), '<html><body><div id="root"></div><script type="module" src="/entry.tsx"></script></body></html>');
    await fs.writeFile(path.join(directory, 'entry.tsx'), `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {GoalsView} from '${root}/src/app/components/views/GoalsView.tsx';
import {GOAL_TEMPLATES,instantiateGoalTemplate} from '${root}/src/app/data/goalTemplates.ts';
import '${root}/src/styles/index.css';
let sequence=0;
localStorage.setItem('omvra.goals.v1',JSON.stringify([instantiateGoalTemplate(GOAL_TEMPLATES[0],prefix=>prefix+'-'+(++sequence))]));
createRoot(document.getElementById('root')).render(<div className="flex h-dvh flex-col"><header className="h-16 shrink-0">Header</header><main className="min-h-0 flex-1 overflow-hidden"><GoalsView/></main><footer className="h-12 shrink-0">Status</footer></div>);
`);
    const { build } = await import('vite');
    await build({ configFile: path.join(root, 'vite.config.ts'), root: directory,
      resolve: { alias: { react: path.join(root, 'node_modules/react'), 'react-dom': path.join(root, 'node_modules/react-dom') } },
      build: { outDir: path.join(directory, 'dist'), emptyOutDir: true }, logLevel: 'error' });
    await app.whenReady();
    win = new BrowserWindow({ show: false, width: 1200, height: 800, webPreferences: { contextIsolation: true, nodeIntegration: false } });
    await win.loadFile(path.join(directory, 'dist/index.html'));
    const js = code => win.webContents.executeJavaScript(code, true);
    for (let attempt = 0; attempt < 100 && !await js("!!document.querySelector('.goals-view [role=group]')"); attempt++) {
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    assert.ok(await js("!!document.querySelector('.goals-view [role=group]')"), 'Template nodes must render');
    for (const [width, height] of [[1200, 800], [900, 600]]) {
      win.setContentSize(width, height);
      await js('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      const geometry = await js(`(() => {
        const view=document.querySelector('.goals-view');
        const node=view.querySelector('[role=group]');
        // Focus/scrollIntoView must never move the viewport, grid, or floating panels.
        node.focus(); node.scrollIntoView(); view.scrollTop=200; view.scrollLeft=200;
        const rect=element=>{const r=element.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};};
        return {view:rect(view),surface:rect(view.querySelector('[role=application]')),grid:rect(view.querySelector('.goals-canvas-grid')),main:rect(document.querySelector('main')),footerTop:document.querySelector('footer').getBoundingClientRect().top,scroll:[view.scrollTop,view.scrollLeft]};
      })()`);
      assert.deepEqual(geometry.scroll, [0, 0], 'Offscreen node focus must not scroll the viewport');
      assert.deepEqual(geometry.view, geometry.main);
      assert.deepEqual(geometry.surface, geometry.view);
      assert.deepEqual(geometry.grid, geometry.view);
      assert.equal(geometry.view.bottom, geometry.footerTop, 'Canvas must reach the status bar');
    }
    await js("document.querySelector('.goals-view [role=group]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))");
    await js('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    assert.ok(await js(`(() => {
      const view=document.querySelector('.goals-view');
      const node=view.querySelector('[role=group][tabindex="0"]');
      const viewport=view.getBoundingClientRect(),rect=node.getBoundingClientRect();
      return document.activeElement===node && rect.left>=viewport.left && rect.right<=viewport.right && rect.top>=viewport.top && rect.bottom<=viewport.bottom && view.scrollTop===0;
    })()`), 'Keyboard navigation must reveal and focus the next node without scrolling the viewport');
    console.log('Goals viewport passed: focus, scrollIntoView, resize, keyboard navigation, and full canvas coverage.');
  } finally {
    win?.destroy();
    await fs.rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
  app.exit(0);
})().catch(error => { console.error(error); app.exit(1); });
