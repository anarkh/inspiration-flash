(() => {
  'use strict';

  const assets = {
    fullbody: { path: '../../art-source/hero-redesign/reincarnator-fullbody-v1.png', title: '轮回者 · 全身设定原图', caption: '全身设计 · 已用于游戏行走素材制作' },
    portrait: { path: '../../cocos/assets/resources/character/reincarnator-v2.png', title: '轮回者 · 现有角色肖像', caption: '游戏中现有肖像，作为人物身份与材质依据' },
    'old-atlas': { path: '../../art-source/reincarnator-walk-v1.png', title: '轮回者 · 替换前行走图集', caption: '完整原图 · 朝下 / 朝左 / 朝右 / 朝上 · 每行四帧' },
    'new-atlas': { path: '../../art-source/hero-redesign/reincarnator-walk-v2-candidate.png', title: '轮回者 · 新设计行走图集', caption: '四方向 16 帧设计草图 · 原始画布行列间距不等 · 接入前须整理网格、脚点与动作连续性' },
  };
  const scenes = {
    hub: { path: '../../cocos/assets/resources/hub-courtyard/walk-sanctuary-v1.png', name: '轮回庭院现有游戏背景' },
    dungeon: { path: '../../cocos/assets/resources/dungeon-world/demon_tower_1-v1.png', name: '镇妖塔现有游戏背景' },
  };
  const directions = ['朝下', '朝左', '朝右', '朝上'];
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const state = { direction: 0, frame: 0, playing: !motionPreference.matches, lastFrameAt: 0, scene: 'hub' };
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const sprites = $$('[data-sprite]');
  const frameDuration = 1000 / 9;
  // Measured row/column positions in the untouched 1254 × 1254 candidate source.
  // Keep a 313.5-square window and 400% scale; crop only transparent row gaps.
  const candidateColumnCenters = [245, 503, 761, 1024];
  const candidateRowOffsets = [8, 314, 624, 930];
  const candidateRowClipHeights = [305, 308, 306, 304];
  const candidateWindowSize = 1254 / 4;
  const candidateXPositions = candidateColumnCenters.map(center => (center - candidateWindowSize / 2) / (1254 - candidateWindowSize) * 100);
  const dialog = $('#image-dialog');
  let animationRequest = null;
  let dialogTrigger = null;

  function reportError(message) {
    const notice = $('#page-error');
    if (!notice.textContent.includes(message)) {
      notice.textContent += `${notice.textContent ? ' ' : ''}${message}`;
    }
    notice.hidden = false;
  }

  function renderFrame() {
    for (const sprite of sprites) {
      const isCandidate = sprite.dataset.sprite === 'new';
      const positionX = isCandidate ? candidateXPositions[state.frame] : state.frame * 100 / 3;
      const positionY = isCandidate ? candidateRowOffsets[state.direction] / (1254 - candidateWindowSize) * 100 : state.direction * 100 / 3;
      sprite.style.backgroundPosition = `${positionX}% ${positionY}%`;
      if (isCandidate) {
        const bottomClip = (candidateWindowSize - candidateRowClipHeights[state.direction]) / candidateWindowSize * 100;
        sprite.style.clipPath = `inset(0 0 ${bottomClip}% 0)`;
      }
      sprite.setAttribute('aria-label', `${sprite.dataset.sprite === 'old' ? '替换前' : '新设计'}主角${directions[state.direction]}${state.playing ? '行走动画' : `第 ${state.frame + 1} 帧`}${sprite.dataset.sprite === 'new' ? '候选' : ''}`);
    }
    $('#frame-select').value = String(state.frame);
    $('#frame-select').setAttribute('aria-valuetext', `第 ${state.frame + 1} 帧`);
    $('#frame-label').value = `${state.frame + 1} / 4`;
    $('#animation-meta').textContent = `${directions[state.direction]} · ${state.playing ? '9 fps' : '已暂停'} · 帧 ${state.frame + 1} / 4`;
  }

  function animate(timestamp) {
    if (!state.playing) {
      animationRequest = null;
      return;
    }
    if (!state.lastFrameAt) state.lastFrameAt = timestamp;
    const elapsed = timestamp - state.lastFrameAt;
    if (elapsed >= frameDuration) {
      const steps = Math.floor(elapsed / frameDuration);
      state.frame = (state.frame + steps) % 4;
      state.lastFrameAt = timestamp - elapsed % frameDuration;
      renderFrame();
    }
    animationRequest = window.requestAnimationFrame(animate);
  }

  function updatePlayback() {
    const button = $('#play-toggle');
    button.textContent = state.playing ? '暂停动作' : '播放动作';
    button.setAttribute('aria-pressed', String(state.playing));
    if (animationRequest !== null) window.cancelAnimationFrame(animationRequest);
    animationRequest = null;
    state.lastFrameAt = 0;
    if (state.playing && !document.hidden) animationRequest = window.requestAnimationFrame(animate);
    renderFrame();
  }

  function changeScene(value) {
    const scene = scenes[value];
    if (!scene) throw new Error(`未知预览场景：${value}`);
    state.scene = value;
    for (const node of $$('[data-sprite-scene]')) node.dataset.scene = value;
    for (const background of $$('[data-scene-background]')) {
      background.src = scene.path;
      background.alt = scene.name;
    }
    $('#live-status').textContent = `已切换至${scene.name}。`;
  }

  function openPreview(key, trigger) {
    const asset = assets[key];
    if (!asset) throw new Error(`未知原图：${key}`);
    dialogTrigger = trigger;
    $('#dialog-title').textContent = asset.title;
    $('#dialog-caption').textContent = asset.caption;
    $('#dialog-image').src = asset.path;
    $('#dialog-image').alt = asset.title;
    $('#dialog-original').href = asset.path;
    dialog.showModal();
    $('#close-dialog').focus();
  }

  for (const button of $$('[data-preview]')) {
    button.addEventListener('click', () => openPreview(button.dataset.preview, button));
  }
  $('#close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    if (dialogTrigger) dialogTrigger.focus();
  });
  $('#dialog-image').addEventListener('error', () => {
    $('#dialog-caption').textContent = '原图加载失败，请检查本地素材文件是否存在，或使用下方原图链接。';
  });

  for (const button of $$('[data-direction]')) {
    button.addEventListener('click', () => {
      state.direction = Number(button.dataset.direction);
      state.frame = 0;
      state.lastFrameAt = 0;
      for (const other of $$('[data-direction]')) other.setAttribute('aria-pressed', String(other === button));
      renderFrame();
      $('#live-status').textContent = `已切换为${directions[state.direction]}。`;
    });
  }
  $('#play-toggle').addEventListener('click', () => {
    state.playing = !state.playing;
    updatePlayback();
  });
  $('#scene-select').addEventListener('change', event => changeScene(event.target.value));
  $('#size-select').addEventListener('change', event => {
    document.documentElement.style.setProperty('--sprite-size', `${event.target.value}px`);
    $('#live-status').textContent = `帧窗已切换至 ${event.target.value} 像素。`;
  });
  $('#guide-toggle').addEventListener('change', event => {
    for (const scene of $$('[data-sprite-scene]')) scene.classList.toggle('show-guide', event.target.checked);
  });
  $('#frame-select').addEventListener('input', event => {
    state.frame = Number(event.target.value);
    state.playing = false;
    updatePlayback();
  });
  document.addEventListener('visibilitychange', updatePlayback);
  motionPreference.addEventListener('change', event => {
    if (event.matches) {
      state.playing = false;
      updatePlayback();
    }
  });

  for (const image of $$('[data-required-image], [data-scene-background]')) {
    const handleFailure = () => {
      image.classList.add('image-failed');
      reportError(`素材加载失败：${image.alt}。请确认本地图片文件存在后刷新。`);
    };
    image.addEventListener('error', handleFailure);
    if (image.complete && image.naturalWidth === 0 && image.loading !== 'lazy') handleFailure();
  }
  for (const [kind, key] of [['old', 'old-atlas'], ['new', 'new-atlas']]) {
    const image = new Image();
    image.addEventListener('error', () => {
      const status = $(`[data-sprite-state="${kind}"]`);
      status.textContent = `${kind === 'old' ? '替换前' : '新设计'}行走图集加载失败。请检查原图文件后刷新。`;
      status.hidden = false;
      $(`[data-sprite="${kind}"]`).hidden = true;
    });
    image.src = assets[key].path;
  }
  updatePlayback();
})();
