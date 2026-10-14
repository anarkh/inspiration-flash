import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../', import.meta.url));
const cc = `
export class Node {
  constructor(name='') { this.name=name; this.layer=1; this.children=[]; this.components=[]; }
  addChild(node) { this.children.push(node); node.parent=this; }
  addComponent(Type) { const component=new Type(); component.node=this; this.components.push(component); return component; }
  getComponent(Type) { return this.components.find(c=>c instanceof Type); }
  setPosition(point) { this.position=point; }
  destroy() { this.destroyed=true; }
}
export class UITransform { setContentSize(size) { this.contentSize=size; } }
export class Size { constructor(width,height) { Object.assign(this,{width,height}); } }
export class Vec3 { constructor(x,y,z=0) { Object.assign(this,{x,y,z}); } }
export class Color { constructor(r,g,b,a=255) { Object.assign(this,{r,g,b,a}); } }
export class Graphics { clear() {} moveTo() {} lineTo() {} stroke() {} }
export class Label { static HorizontalAlign={CENTER:1}; static VerticalAlign={CENTER:1}; }
`;
const bundle = await build({
  stdin: { contents: `export { createInfiniteFlowCombatEffects } from './cocos/assets/scripts/ui/InfiniteFlowCombatEffects.ts'; export { Node, Label } from 'cc';`, resolveDir: root, loader: 'ts' },
  absWorkingDir: root, bundle: true, write: false, format: 'esm', platform: 'node', target: 'node20',
  plugins: [{ name: 'combat-effects-cc', setup(builder) {
    builder.onResolve({ filter: /^cc$/ }, () => ({ path: 'cc', namespace: 'combat-effects-cc' }));
    builder.onLoad({ filter: /.*/, namespace: 'combat-effects-cc' }, () => ({ contents: cc }));
  } }],
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const rootNode = new api.Node('BattlefieldMask');
let playerOffset, enemyOffset;
const effect = api.createInfiniteFlowCombatEffects(rootNode, {
  getAnchors: () => ({ player: { x: -100, y: 0 }, enemy: { x: 120, y: 45 } }),
  movePlayer: offset => { playerOffset=offset; }, moveEnemy: offset => { enemyOffset=offset; },
});
const labels = () => rootNode.children[0].children.map(node => node.getComponent(api.Label));
const advance = count => { for (let i=0;i<count;i++) effect.tick(0.05); };
for (const kind of ['attack','weapon','art','pill','guard','mist','iron','talisman','escape','other']) {
  let impacts=0, counters=0, completions=0;
  assert.equal(effect.resolve({}, () => {}), false, `${kind}: cannot resolve an action that never started`);
  assert.equal(effect.start(kind, () => { impacts++; }), true);
  assert.equal(effect.start(kind, () => { throw new Error('duplicate action fired'); }), false);
  assert.equal(effect.resolve({}, () => {}), false, `${kind}: cannot skip the pre-impact phase`);
  advance(30);
  assert.equal(impacts, 1, `${kind}: impact delivered once`);
  assert.equal(effect.isPlaying(), true, `${kind}: waits for the real command result`);
  assert.ok(labels().every(label => label.string === ''), `${kind}: no invented damage while awaiting result`);
  advance(50);
  assert.equal(impacts, 1, `${kind}: waiting does not dispatch again`);
  assert.equal(effect.resolve({ enemyDamage: 17, playerHealing: 9, playerDamage: 6, counter: true, guarded: kind === 'guard', onCounterImpact: () => { counters++; } }, () => { completions++; }), true);
  assert.ok(labels().some(label => label.string === '−17'), `${kind}: exact authoritative damage`);
  assert.ok(labels().some(label => label.string === '+9'), `${kind}: exact authoritative healing`);
  assert.ok(labels().every(label => label.string !== '−6'), `${kind}: counter number not shown before counter impact`);
  advance(10);
  assert.equal(counters, 0);
  advance(3);
  assert.equal(counters, 1);
  assert.ok(labels().some(label => label.string === '−6'), `${kind}: actual counter result appears at its impact`);
  advance(20);
  assert.equal(counters, 1);
  assert.equal(completions, 1);
  assert.equal(effect.isPlaying(), false);
  assert.deepEqual(playerOffset, { x: 0, y: 0 });
  assert.deepEqual(enemyOffset, { x: 0, y: 0 });
}
let cancelled=0;
effect.start('art', () => { cancelled++; });
effect.cancel();
advance(50);
assert.equal(cancelled, 0, 'cancel prevents the pending command callback');
let synchronousCompletion=0;
effect.start('guard', () => {
  assert.equal(effect.resolve({ playerDamage: 0, counter: false }, () => { synchronousCompletion++; }), true);
});
advance(30);
assert.equal(synchronousCompletion, 1, 'a synchronous command result safely resumes the same timeline');
assert.ok(labels().every(label => label.string === ''), 'zero damage does not create a fictional hit number');
let interruptedCompletion=0;
effect.start('attack', () => {
  effect.resolve({ counter: true, onCounterImpact: () => effect.cancel() }, () => { interruptedCompletion++; });
});
advance(40);
assert.equal(interruptedCompletion, 0, 'cancel from counter callback does not continue into stale completion');
effect.start('pill', () => { cancelled++; });
effect.dispose();
advance(50);
assert.equal(cancelled, 0, 'dispose cancels callbacks and restores both actors');
assert.equal(effect.start('attack', () => {}), false, 'disposed effects cannot restart');
assert.equal(rootNode.children[0].destroyed, true);
console.log('COCOS_COMBAT_EFFECTS_VALID 10 actions; command wait, exact numbers, counter timing and cancellation');
