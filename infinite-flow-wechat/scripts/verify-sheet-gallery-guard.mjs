#!/usr/bin/env node
// Static gate proving the debug style gallery cannot leak into production:
//  1. the only gallery branch is compile-time guarded by HTML5 && DEBUG and the
//     runtime ?gallery=1 / wx checks;
//  2. the production sheet mount in InfiniteFlowView never passes a theme;
//  3. nothing but InfiniteFlowApp imports the gallery module;
//  4. the new theme modules never mutate the frozen shared DARK_UI tokens;
//  5. dark-ui.ts (shared by production HUD/scenes) is not modified to host themes.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const at = (path) => `${root}/${path}`;

const [app, view, sheet, theme, styles, gallery, galleryShared, darkUi] = await Promise.all([
  readFile(at('cocos/assets/scripts/InfiniteFlowApp.ts'), 'utf8'),
  readFile(at('cocos/assets/scripts/ui/InfiniteFlowView.ts'), 'utf8'),
  readFile(at('cocos/assets/scripts/ui/InfiniteFlowInfoSheet.ts'), 'utf8'),
  readFile(at('cocos/assets/scripts/ui/sheet-theme.ts'), 'utf8'),
  readFile(at('cocos/assets/scripts/ui/sheet-styles.ts'), 'utf8'),
  readFile(at('cocos/assets/scripts/ui/InfiniteFlowSheetGallery.ts'), 'utf8'),
  readFile(at('cocos/assets/scripts/ui/sheet-gallery-shared.ts'), 'utf8'),
  readFile(at('cocos/assets/scripts/ui/dark-ui.ts'), 'utf8'),
]);

// 1. Compile-time guard + runtime guard around the only branch.
assert.match(app, /if\s*\(HTML5\s*&&\s*DEBUG\s*&&\s*sheetGalleryRequested\(\)\)/,
  'app: gallery branch is guarded by HTML5 && DEBUG && sheetGalleryRequested()');
assert.match(app, /from 'cc\/env'/, 'app: HTML5/DEBUG come from the compile-time cc/env constants');
assert.match(gallery, /if \(global\.wx !== undefined\) return false/, 'gallery: wx runtime defense is present');
assert.match(gallery, /URLSearchParams/, 'gallery: URL gating stays inside the gallery module');
// The compile-time constants are used nowhere but the single gallery gate.
const envUses = app.match(/\b(?:HTML5|DEBUG)\b/g) ?? [];
assert.ok(envUsagesWithinGuard(app), 'app: HTML5/DEBUG only appear in the gallery guard');

// 2. Production mount never themes the sheet.
const productionMount = view.slice(view.indexOf('renderInfiniteFlowInfoSheet('));
assert.ok(productionMount.includes('safeInsets,') && !/theme\s*:/.test(productionMount.slice(0, productionMount.indexOf('});'))),
  'view: production renderInfiniteFlowInfoSheet options contain no theme');
assert.doesNotMatch(view, /InfiniteFlowSheetGallery|sheet-styles|GALLERY_SHEET_THEMES/,
  'view: production renderer never imports gallery code');
// The theme option is optional and the sheet only consumes it from options.
assert.match(sheet, /theme\?: SheetTheme/, 'sheet: theme stays an optional seam');
assert.match(sheet, /activeTheme = options\.theme \?\? DEFAULT_SHEET_THEME/,
  'sheet: omitted theme resolves to the pixel-identical DEFAULT');

// 3. Gallery import boundary: only the guarded app branch may import it.
const otherSources = await Promise.all(([
  'cocos/assets/scripts/ui/InfiniteFlowView.ts',
  'cocos/assets/scripts/ui/InfiniteFlowWalkScene.ts',
  'cocos/assets/scripts/ui/InfiniteFlowInfoSheet.ts',
  'cocos/assets/scripts/ui/walk-world.ts',
]).map(async (path) => [path, await readFile(at(path), 'utf8')]));
for (const [path, source] of otherSources) {
  assert.doesNotMatch(source, /InfiniteFlowSheetGallery|sheet-styles|sheet-gallery-shared/,
    `${path}: no gallery dependency`);
}
assert.match(app, /import \{ startInfiniteFlowSheetGallery, sheetGalleryRequested/,
  'app: single static gallery import sits beside the compile-time guard');

// 4. No mutation of the shared DARK_UI tokens from the new modules.
for (const [name, source] of [['sheet-theme', theme], ['sheet-styles', styles], ['gallery', gallery]]) {
  assert.doesNotMatch(source, /DARK_UI\.[a-zA-Z]+\s*=(?!=)/, `${name}: DARK_UI tokens are never assigned`);
  assert.doesNotMatch(source, /paintDarkFrame\s*=/, `${name}: production painter is never replaced`);
}
// DEFAULT must delegate to the exact production painter rather than fork it.
assert.match(theme, /paintFrame\(g, width, height, input\) \{\s*paintDarkFrame\(g, width, height,/,
  'theme: DEFAULT frame painter delegates verbatim to paintDarkFrame');

// 5. The shared dark-ui module stays free of any gallery awareness.
assert.doesNotMatch(darkUi, /gallery|SheetTheme|GALLERY/i, 'dark-ui: zero gallery awareness');

// 6. The ten themes and the gallery fixture stay read-only over domain modules.
assert.match(galleryShared, /import \{ createInfiniteFlowClient/,
  'gallery-shared: fixture uses the real client command path');
assert.match(gallery, /import \{[^}]*createGalleryClient[^}]*\} from '\.\/sheet-gallery-shared'/,
  'gallery: client fixture comes solely from the shared gallery module');
assert.match(styles, /GALLERY_SHEET_THEMES: readonly SheetTheme\[\] = \[/, 'styles: frozen readonly theme list');
// Style 1 is DEFAULT_SHEET_THEME (sheet-theme.ts); styles.ts adds styles 2-10.
const builtStyles = (styles.match(/buildStyle\(\{/g) ?? []).length;
assert.equal(builtStyles, 9, `styles: DEFAULT plus nine crafted themes (found ${builtStyles} built)`);
assert.match(styles, /DEFAULT_SHEET_THEME,/, 'styles: gallery list leads with the production DEFAULT');

function envUsagesWithinGuard(source) {
  const stripped = source
    .replace(/import\s*\{[^}]*\}\s*from 'cc\/env';?/, '')
    .replace(/if\s*\(HTML5\s*&&\s*DEBUG\s*&&\s*sheetGalleryRequested\(\)\)/, '')
    .replace(/if\s*\(HTML5\s*&&\s*DEBUG\s*&&\s*sheetLayoutGalleryRequested\(\)\)/, '')
    .replace(/^\s*\/\/.*$/gm, '');
  return !/\b(HTML5|DEBUG)\b/.test(stripped);
}

console.log('Sheet gallery guard: compile-time HTML5 && DEBUG gate, runtime ?gallery=1 + wx defense, '
  + 'production mount theme-free, import boundary single-sourced, DARK_UI immutable, dark-ui gallery-free.');

// 7. Layout gallery (?gallery=2): same isolation discipline, orthogonal seam.
const [layoutGallery, layoutStyles, sheetKit, style01, galleryImages] = await Promise.all([
  readFile(at('cocos/assets/scripts/ui/InfiniteFlowSheetLayoutGallery.ts'), 'utf8'),
  readFile(at('cocos/assets/scripts/ui/sheet-layout-styles.ts'), 'utf8'),
  readFile(at('cocos/assets/scripts/ui/sheet-kit.ts'), 'utf8'),
  readFile(at('cocos/assets/scripts/ui/layouts/sheet-style-01.ts'), 'utf8'),
  readFile(at('cocos/assets/scripts/ui/sheet-gallery-images.ts'), 'utf8'),
]);

// v2 branch sits ahead of the v1 branch and shares the compile-time gate.
const v2At = app.indexOf('sheetLayoutGalleryRequested()');
const v1At = app.indexOf('sheetGalleryRequested()');
assert.ok(v2At > 0 && v1At > v2At, 'app: layout gallery guard precedes the skin gallery guard');
assert.match(app, /import \{ startInfiniteFlowSheetLayoutGallery, sheetLayoutGalleryRequested/,
  'app: single static layout-gallery import beside the compile-time guard');
assert.match(layoutGallery, /if \(global\.wx !== undefined\) return false/, 'layout-gallery: wx runtime defense');
assert.match(layoutGallery, /get\('gallery'\) === '2'/, 'layout-gallery: URL gating on gallery=2');
assert.match(layoutGallery, /createGalleryClient,[\s\S]*?\} from '\.\/sheet-gallery-shared'/,
  'layout-gallery: fixture comes solely from the shared gallery module');

// The seam contract stays gallery-free; production renderer options never set it.
assert.doesNotMatch(sheetKit, /gallery|wx\b|URLSearchParams|location/i, 'sheet-kit: zero gallery awareness');
const productionOptions = productionMount.slice(0, productionMount.indexOf('});'));
assert.ok(!/layout\s*:/.test(productionOptions) && !/images\s*:/.test(productionOptions),
  'view: production renderInfiniteFlowInfoSheet options contain no layout/images');
assert.doesNotMatch(view, /sheet-layout|SheetLayout|InfiniteFlowSheetLayoutGallery|sheet-gallery/,
  'view: production renderer never imports layout-gallery code');

// Exactly ten styles aggregate in order; style 01 is the production baseline.
const styleImports = (layoutStyles.match(/import \{ SHEET_STYLE_\d{2} \}/g) ?? []).length;
assert.equal(styleImports, 10, 'layout-styles: exactly ten style imports');
for (let index = 1; index <= 10; index += 1) {
  const id = String(index).padStart(2, '0');
  assert.match(layoutStyles, new RegExp(`SHEET_STYLE_${id}[,\\n]`), `layout-styles: style ${id} aggregated`);
}
assert.match(style01, /PRODUCTION_SHEET_LAYOUT/, 'style-01: mounts PRODUCTION_SHEET_LAYOUT');
assert.match(style01, /DEFAULT_SHEET_THEME/, 'style-01: mounts DEFAULT_SHEET_THEME');
assert.match(style01, /NO_SHEET_IMAGES/, 'style-01: raster images disabled');

// Image preloading stays best-effort and gallery-only.
assert.match(galleryImages, /Promise\.allSettled/, 'gallery-images: best-effort allSettled preload');
assert.match(galleryImages, /EMPTY_SHEET_IMAGE_LIBRARY/, 'gallery-images: empty library fallback');

console.log('Sheet layout guard: gallery=2 compile-time + wx + URL gates, seam gallery-free, '
  + 'production mount layout-free, exactly ten styles with 01 production identity, best-effort image preload.');

// 8. The production sheet-figure registry carries no loader/platform awareness.
const sheetFigures = await readFile(at('cocos/assets/scripts/ui/sheet-figures.ts'), 'utf8');
assert.doesNotMatch(sheetFigures, /gallery|wx\b|URLSearchParams|location|assetManager|resources\b/i,
  'sheet-figures: registry holds no gallery/platform/loading awareness');
assert.match(sheetFigures, /EMPTY_SHEET_IMAGE_LIBRARY/, 'sheet-figures: defaults to the empty library');
assert.match(sheet, /getSheetFigures\(\)/, 'sheet: production bodies consume the registry');
assert.match(app, /registerSheetFigures/, 'app: the app prime step owns registration');

console.log('Sheet figures guard: registry gallery/platform-free, empty-library default, '
  + 'consumed by the sheet and registered solely by the app prime step.');
