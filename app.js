/* =========================================================
   再待一会儿 · 皇后镇湖边小屋
   场景插画来自 Figma「04 · Scene artwork」，界面对应「03 · Components & styles」。
   纯前端，无依赖。手账存 localStorage，照片存 IndexedDB，只留在当前浏览器。
   ========================================================= */
(() => {
'use strict';

/* ---------------------------------------------------------
   可替换素材
   --------------------------------------------------------- */
const CONFIG = {
  audio: {            // 环境音文件（留空 = 浏览器实时合成）
    lake: '',         // 湖水与微风，例如 'assets/audio/lake.mp3'
    rain: '',         // 雨声
  },
};

/* ---------------------------------------------------------
   两种构图。坐标单位：电脑图宽 2000、手机图宽 1125（与原图等比）。
   换插画时，只要构图不变就只需替换图片文件；构图变了再调整这里的坐标。
   --------------------------------------------------------- */
const LAYOUTS = {
  desktop: {
    src: 'assets/scene/desktop.webp', w: 2000, h: 1333.33,
    safe: [330, 470, 2000, 1230],          // 这块区域总会完整显示（植物、窗、桌上物品、台灯）
    focus: [1080, 700],
    window: [[378, 15], [1660, 15], [1660, 845], [378, 845]],
    windowCuts: [
      'M346,668 L392,648 L420,605 L452,628 L500,652 L545,690 L512,728 L530,760 L512,800 L505,850 L440,862 L378,850 L372,766 L346,740 Z',
      'M640,760 Q712,700 790,760 L800,980 L630,980 Z',
    ],
    lake: [560, 570, 1620, 830],
    mug: {
      d: 'M603,962 L640,950 L709,944 L780,948 L816,958 L819,1000 L812,1048 L792,1088 L762,1114 L709,1129 L660,1123 L633,1108 L618,1102 L594,1098 L562,1074 L542,1040 L548,1006 L566,988 L590,984 L605,990 Z M574,1020 L602,1018 L614,1048 L612,1078 L598,1086 L580,1070 L570,1045 Z',
      origin: [709, 1128], shadow: [712, 1124, 110, 16], lift: -9,
    },
    steam: [712, 968, 210],
    plant: {
      d: 'M346,668 L372,662 L392,648 L402,620 L420,605 L440,606 L452,628 L455,648 L478,650 L500,652 L515,662 L537,668 L545,690 L530,712 L512,728 L530,740 L530,760 L512,768 L480,772 L420,772 L388,770 L372,766 L352,758 L346,740 L358,722 L362,712 L350,700 Z',
      origin: [440, 772],
    },
    lamp: { glow: [1902, 620], r: [330, 430] },
    hot: [
      { id: 'coffee', box: [530, 740, 870, 1180], tip: '喝一口热咖啡', label: '咖啡', aria: '咖啡：喝一口' },
      { id: 'journal', box: [1000, 1020, 1450, 1225], tip: '写下一句话', label: '手账', aria: '旅行手账：留下一句话' },
      { id: 'camera', box: [1450, 960, 1830, 1150], tip: '翻看旅行相册', label: '相机', aria: '相机：打开旅行相册' },
      { id: 'lamp', box: [1780, 490, 2000, 975], tip: '开 / 关台灯', label: '台灯', aria: '台灯：开关' },
      { id: 'plant', box: [338, 598, 552, 865], tip: '摸摸小植物', label: '小植物', aria: '小植物：摸摸它' },
    ],
  },
  mobile: {
    src: 'assets/scene/mobile.webp', w: 1125, h: 2000,
    safe: [160, 900, 1080, 1630],
    focus: [610, 1100],
    window: [[185, 215], [965, 215], [992, 450], [1030, 650], [1072, 760], [1062, 830], [1045, 1000], [1030, 1100], [975, 1110], [980, 1290], [1005, 1345], [128, 1345], [124, 1150], [115, 1000], [90, 800], [100, 760], [130, 650], [160, 450]],
    windowCuts: ['M215,1240 Q270,1190 330,1240 L340,1420 L205,1420 Z'],
    lake: [150, 930, 1040, 1170],
    mug: {
      d: 'M201,1428 L268,1416 L336,1426 L334,1470 L328,1510 L312,1540 L285,1557 L255,1558 L228,1548 L214,1535 L205,1528 L190,1520 L170,1500 L160,1478 L165,1458 L180,1450 L200,1449 Z M180,1470 L196,1468 L205,1495 L200,1512 L186,1500 Z',
      origin: [268, 1558], shadow: [270, 1556, 80, 12], lift: -14,
    },
    steam: [270, 1418, 175],
    plant: null,                           // 手机插画里没有小植物，彩蛋换成「湖面」
    lamp: { glow: [1052, 1195], r: [210, 300] },
    hot: [
      { id: 'coffee', box: [150, 1240, 345, 1575], tip: '喝一口热咖啡', label: '咖啡', aria: '咖啡：喝一口' },
      { id: 'journal', box: [430, 1475, 705, 1625], tip: '写下一句话', label: '手账', aria: '旅行手账：留下一句话' },
      { id: 'camera', box: [815, 1435, 1085, 1595], tip: '翻看旅行相册', label: '相机', aria: '相机：打开旅行相册' },
      { id: 'lamp', box: [970, 1100, 1125, 1515], tip: '开 / 关台灯', label: '台灯', aria: '台灯：开关' },
      { id: 'lake', box: [330, 960, 940, 1160], tip: '碰碰湖面', label: '湖面', aria: '湖面：碰一碰' },
    ],
  },
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => reduceMQ.matches;
const touchMQ = matchMedia('(hover: none), (pointer: coarse)');
const body = document.body;
let seed = 20261119;
const rand = (a = 0, b = 1) => { seed = (seed * 1664525 + 1013904223) >>> 0; return a + (seed / 4294967296) * (b - a); };
const f1 = n => (+n).toFixed(1);

/* ---------- 本地存储 ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};
const SKEY = 'zdyhr:settings:v2';
const MKEY = 'zdyhr:mood';
const settings = Object.assign({ weather: 'sunset', lamp: true, lake: 60, rain: 0, rainTouched: false, tagsSeen: false, showTags: null }, store.get(SKEY, {}));
const saveSettings = () => store.set(SKEY, settings);

/* =========================================================
   1. 场景：插画 + 叠加层
   ========================================================= */
let L = null, layoutName = '', scale = 1;
const sBase = $('#sBase'), sFx = $('#sFx'), sHot = $('#sHot'), stage = $('#stage');

function insidePoly([x, y], poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const polyD = pts => 'M' + pts.map(p => p.join(',')).join(' L') + ' Z';

function build(name) {
  L = LAYOUTS[name]; layoutName = name;
  body.classList.toggle('is-mobile', name === 'mobile');
  const { w, h, src } = L, W = f1(w), H = f1(h);
  const k = name === 'mobile' ? 2.3 : 1.4;            // 约等于「1 屏幕像素 = k 个图单位」
  const winD = polyD(L.window);
  const cuts = L.windowCuts.map(d => `<path d="${d}" fill="#000"/>`).join('');
  const [gx, gy] = L.lamp.glow, [grx, gry] = L.lamp.r;
  const xs = L.window.map(p => p[0]), ys = L.window.map(p => p[1]);
  const wb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  // 窗户遮罩：底层色调只柔和地避开植物；雨丝再避开热气。边缘做了羽化，不会出现硬边。
  const feather = `<filter id="fFeather" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f1(5 * k)}"/></filter>`;
  const mask = (id, withCuts) => `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#000"/><path d="${winD}" fill="#fff"/><g filter="url(#fFeather)">${withCuts ? cuts : ''}${L.plant ? `<path d="${L.plant.d}" fill="#000"/><ellipse cx="${L.plant.origin[0]}" cy="${L.plant.origin[1] + 40}" rx="70" ry="60" fill="#000"/>` : ''}</g></mask>`;
  $('#backdrop').style.backgroundImage = `url(${src})`;

  /* --- 底层：插画、可动的小物件、天气与灯光色调 --- */
  const m = L.mug, p = L.plant;
  [sBase, sFx, sHot].forEach(s => { s.setAttribute('viewBox', `0 0 ${W} ${H}`); s.setAttribute('preserveAspectRatio', 'none'); });
  sBase.innerHTML = `
    <defs>
      <clipPath id="cpMug"><path d="${m.d}" clip-rule="evenodd"/></clipPath>
      ${p ? `<clipPath id="cpPlant"><path d="${p.d}"/></clipPath>` : ''}
      ${feather}${mask('mWinB', false)}
      <radialGradient id="gLampOff"><stop offset="0" stop-color="#24170e" stop-opacity=".78"/><stop offset=".45" stop-color="#2e2016" stop-opacity=".42"/><stop offset="1" stop-color="#2e2016" stop-opacity="0"/></radialGradient>
      <radialGradient id="gLampBoost"><stop offset="0" stop-color="#ffcf8a" stop-opacity=".75"/><stop offset="1" stop-color="#ffcf8a" stop-opacity="0"/></radialGradient>
      <radialGradient id="gMugShadow"><stop offset="0" stop-color="#3a2416" stop-opacity=".9"/><stop offset="1" stop-color="#3a2416" stop-opacity="0"/></radialGradient>
      <linearGradient id="gMist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef1f4" stop-opacity="0"/><stop offset=".55" stop-color="#eef1f4" stop-opacity=".55"/><stop offset="1" stop-color="#eef1f4" stop-opacity=".15"/></linearGradient>
    </defs>
    <image href="${src}" width="${W}" height="${H}" preserveAspectRatio="none"/>
    ${p ? `<g class="sprite-plant" style="transform-origin:${p.origin[0]}px ${p.origin[1]}px"><image href="${src}" width="${W}" height="${H}" preserveAspectRatio="none" clip-path="url(#cpPlant)"/></g>` : ''}
    <ellipse class="mug-shadow" cx="${m.shadow[0]}" cy="${m.shadow[1]}" rx="${m.shadow[2]}" ry="${m.shadow[3]}" fill="url(#gMugShadow)"/>
    <g class="sprite-mug" style="transform-origin:${m.origin[0]}px ${m.origin[1]}px;--lift:${m.lift}px"><image href="${src}" width="${W}" height="${H}" preserveAspectRatio="none" clip-path="url(#cpMug)"/></g>
    <g class="w-sunny">
      <rect width="${W}" height="${H}" fill="#e4eef7" opacity=".45" style="mix-blend-mode:soft-light"/>
      <g mask="url(#mWinB)">
        <rect width="${W}" height="${H}" fill="#7fb6ea" opacity=".45" style="mix-blend-mode:soft-light"/>
        <rect width="${W}" height="${H}" fill="#9cc8ee" opacity=".14" style="mix-blend-mode:hue"/>
      </g>
    </g>
    <g class="w-rain">
      <rect width="${W}" height="${H}" fill="#808080" opacity=".5" style="mix-blend-mode:saturation"/>
      <rect width="${W}" height="${H}" fill="#7d8896" opacity=".5" style="mix-blend-mode:multiply"/>
      <g mask="url(#mWinB)">
        <rect width="${W}" height="${H}" fill="#c9d1d8" opacity=".38"/>
        <rect x="0" y="${f1(wb[1] + (wb[3] - wb[1]) * .25)}" width="${W}" height="${f1((wb[3] - wb[1]) * .6)}" fill="url(#gMist)"/>
      </g>
    </g>
    <g class="lamp-off">
      <rect width="${W}" height="${H}" fill="#d9d0c7" opacity=".35" style="mix-blend-mode:multiply"/>
      <ellipse cx="${gx}" cy="${gy}" rx="${grx}" ry="${gry}" fill="url(#gLampOff)" style="mix-blend-mode:multiply"/>
    </g>
    <g class="lamp-boost"><ellipse cx="${gx}" cy="${gy + gry * .2}" rx="${grx * 1.5}" ry="${gry * 1.2}" fill="url(#gLampBoost)" style="mix-blend-mode:screen"/></g>`;

  /* --- 动效层：雨、雨珠、涟漪、波光、热气 --- */
  const [lx0, ly0, lx1, ly1] = L.lake;
  let drops = '', ripples = '', twinkles = '';
  for (let i = 0, n = 0; i < 400 && n < 34; i++) {
    const x = rand(wb[0], wb[2]), y = rand(wb[1], wb[3] - 40);
    if (!insidePoly([x, y], L.window)) continue;
    const r = rand(2.4, 5.2) * k * .8;
    drops += `<g class="${n % 3 === 0 ? 'drop-slide' : ''}" style="--slide:${f1(60 * k)}px;animation-delay:${f1(-rand(0, 7))}s"><ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(r)}" ry="${f1(r * 1.25)}" fill="#e3ebf1" fill-opacity=".3" stroke="#fff" stroke-opacity=".65" stroke-width="${f1(k * .7)}"/><circle cx="${f1(x - r * .35)}" cy="${f1(y - r * .4)}" r="${f1(r * .3)}" fill="#fff" opacity=".8"/></g>`;
    n++;
  }
  for (let i = 0; i < 16; i++) {
    const y = rand(ly0 + 20, ly1), t = (y - ly0) / (ly1 - ly0);
    ripples += `<ellipse class="ripple" cx="${f1(rand(lx0, lx1))}" cy="${f1(y)}" rx="${f1((5 + t * 9) * k)}" ry="${f1((1.4 + t * 2) * k)}" fill="none" stroke="#eef5f9" stroke-width="${f1(k * .8)}" style="animation-delay:${f1(-rand(0, 1.9))}s"/>`;
  }
  for (let i = 0; i < 14; i++) {
    const y = rand(ly0 + 20, ly1), t = (y - ly0) / (ly1 - ly0);
    twinkles += `<ellipse class="twinkle" cx="${f1(rand(lx0, lx1))}" cy="${f1(y)}" rx="${f1((4 + t * 10) * k)}" ry="${f1(1.2 * k)}" fill="#fff" style="animation-delay:${f1(-rand(0, 4.5))}s"/>`;
  }
  const [sx, sy, sh] = L.steam;
  const wisp = (cls, dx, wd, sw) => `<path class="steam ${cls}" d="M${f1(sx + dx)},${sy} C${f1(sx + dx - wd)},${f1(sy - sh * .25)} ${f1(sx + dx + wd)},${f1(sy - sh * .45)} ${f1(sx + dx)},${f1(sy - sh * .62)} S${f1(sx + dx - wd * .5)},${f1(sy - sh * .9)} ${f1(sx + dx + 4)},${f1(sy - sh)}" fill="none" stroke="#fff" stroke-width="${f1(sh * sw)}" stroke-linecap="round"/>`;
  const cx = (wb[0] + wb[2]) / 2, cy = (wb[1] + wb[3]) / 2;
  sFx.innerHTML = `
    <defs>
      ${feather}${mask('mWinF', true)}
      <pattern id="pRainN" width="${f1(70 * k)}" height="${f1(160 * k)}" patternUnits="userSpaceOnUse">
        <g stroke="#eef4fa" stroke-linecap="round" stroke-width="${f1(1.6 * k)}" opacity=".55">
          <line x1="${f1(8 * k)}" y1="${f1(6 * k)}" x2="${f1(8 * k)}" y2="${f1(40 * k)}"/><line x1="${f1(44 * k)}" y1="${f1(74 * k)}" x2="${f1(44 * k)}" y2="${f1(112 * k)}"/><line x1="${f1(26 * k)}" y1="${f1(122 * k)}" x2="${f1(26 * k)}" y2="${f1(150 * k)}"/><line x1="${f1(60 * k)}" y1="${f1(20 * k)}" x2="${f1(60 * k)}" y2="${f1(48 * k)}"/>
        </g>
      </pattern>
      <pattern id="pRainF" width="${f1(40 * k)}" height="${f1(100 * k)}" patternUnits="userSpaceOnUse">
        <g stroke="#e6edf4" stroke-linecap="round" stroke-width="${f1(1 * k)}" opacity=".42">
          <line x1="${f1(6 * k)}" y1="${f1(4 * k)}" x2="${f1(6 * k)}" y2="${f1(22 * k)}"/><line x1="${f1(26 * k)}" y1="${f1(52 * k)}" x2="${f1(26 * k)}" y2="${f1(72 * k)}"/><line x1="${f1(16 * k)}" y1="${f1(80 * k)}" x2="${f1(16 * k)}" y2="${f1(96 * k)}"/>
        </g>
      </pattern>
      <filter id="fSteam" x="-100%" y="-50%" width="300%" height="200%"><feGaussianBlur stdDeviation="${f1(sh * .03)}"/></filter>
    </defs>
    <g class="w-sunny w-sunset" mask="url(#mWinF)">${twinkles}</g>
    <g class="w-rain rain-anim" mask="url(#mWinF)">
      <g transform="rotate(10 ${f1(cx)} ${f1(cy)})">
        <rect class="rain-far" style="--tile-f:${f1(100 * k)}px" x="${f1(-w)}" y="${f1(-h)}" width="${f1(w * 3)}" height="${f1(h * 3)}" fill="url(#pRainF)"/>
        <rect class="rain-near" style="--tile-n:${f1(160 * k)}px" x="${f1(-w)}" y="${f1(-h)}" width="${f1(w * 3)}" height="${f1(h * 3)}" fill="url(#pRainN)"/>
      </g>
      ${ripples}${drops}
    </g>
    <g id="rippleLayer"></g>
    <g class="steam-wrap" filter="url(#fSteam)">
      ${wisp('s1', -18, 26, .055)}${wisp('s2', 8, -22, .05)}${wisp('s3', 26, 18, .04)}
    </g>`;

  /* --- 热区：透明可点击区域 + 悬停光晕 + 键盘焦点环 --- */
  sHot.innerHTML = `
    <title>小屋里的物品</title>
    <defs><radialGradient id="gGlow"><stop offset="0" stop-color="#fffaf1" stop-opacity=".42"/><stop offset=".6" stop-color="#fff5e6" stop-opacity=".16"/><stop offset="1" stop-color="#fff5e6" stop-opacity="0"/></radialGradient></defs>
    ${L.hot.map(o => {
      const [x0, y0, x1, y1] = o.box, bw = x1 - x0, bh = y1 - y0;
      return `<g class="hot" id="hot-${o.id}" tabindex="0" role="button" aria-label="${o.aria}" data-action="${o.id}" data-tip="${o.tip}"${o.id === 'lamp' ? ` aria-pressed="${settings.lamp}"` : ''}>
        <ellipse class="glow" cx="${(x0 + x1) / 2}" cy="${(y0 + y1) / 2}" rx="${bw * .62}" ry="${bh * .62}" fill="url(#gGlow)"/>
        <rect class="ring" x="${x0}" y="${y0}" width="${bw}" height="${bh}" rx="${f1(20 * k)}" stroke-dasharray="${f1(2 * k)} ${f1(9 * k)}" style="stroke-width:${f1(2.5 * k)}"/>
        <rect class="hit" x="${x0}" y="${y0}" width="${bw}" height="${bh}" rx="${f1(20 * k)}"/>
      </g>`;
    }).join('')}`;
  wireHot();
  buildTags();
}

/* ---------- 让插画铺满屏幕，同时保证关键物品可见 ---------- */
function fit() {
  const vw = innerWidth, vh = innerHeight;
  const name = vw / vh < 0.75 ? 'mobile' : 'desktop';
  if (name !== layoutName) build(name);
  const [x0, y0, x1, y1] = L.safe;
  let s = Math.max(vw / L.w, vh / L.h);
  if ((x1 - x0) * s > vw || (y1 - y0) * s > vh) s = Math.min(vw / (x1 - x0), vh / (y1 - y0));
  const W = L.w * s, H = L.h * s;
  const clamp = (v, a, b) => Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b));
  let left = W >= vw ? clamp(vw / 2 - L.focus[0] * s, vw - W, 0) : (vw - W) / 2;
  let top = H >= vh ? clamp(vh / 2 - L.focus[1] * s, vh - H, 0) : (vh - H) / 2;
  left = clamp(left, vw - x1 * s, -x0 * s);
  top = clamp(top, vh - y1 * s, -y0 * s);
  scale = s;
  Object.assign(stage.style, { width: W + 'px', height: H + 'px', left: left + 'px', top: top + 'px' });
  placeTags();
}

/* =========================================================
   2. 天气 / 台灯
   ========================================================= */
const WEATHER_NAME = { sunny: '晴天', sunset: '日落', rain: '雨天' };
function setWeather(w, quiet) {
  if (!WEATHER_NAME[w]) w = 'sunset';
  body.dataset.weather = w;
  $$('.wbtn, .wopt').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.w === w)));
  $('#weatherPillText').textContent = WEATHER_NAME[w];
  $('#weatherPill').setAttribute('aria-label', `切换天气，当前：${WEATHER_NAME[w]}`);
  settings.weather = w;
  if (!settings.rainTouched) { settings.rain = w === 'rain' ? 70 : 0; $('#volRain').value = settings.rain; sound.setVol('rain', settings.rain); }
  saveSettings();
  if (!quiet) toast({ sunny: '天亮了，湖面很清', sunset: '太阳快落到山后面了', rain: '下雨了，山间起了雾' }[w]);
}
function setLamp(on, quiet) {
  body.classList.toggle('lamp-dark', !on);
  $('#hot-lamp')?.setAttribute('aria-pressed', String(on));
  settings.lamp = on; saveSettings();
  if (!quiet) { sound.click(); toast(on ? '台灯亮了，暖暖的' : '台灯关上了'); }
}

/* =========================================================
   3. 物品互动
   ========================================================= */
const SIP_LINES = ['热热的，慢慢喝。', '嗯，刚刚好的温度。', '慢慢喝，不着急。', '暖意从手心传开了。'];
const PLANT_LINES = ['小植物伸了个懒腰。', '叶子沙沙地笑了。', '它说：今天的光很好。', '它悄悄长高了一毫米。'];
const LAKE_LINES = ['湖面泛起一圈涟漪。', '远处的水声轻轻回应了你。', '湖水凉凉的，很清。'];
let sipN = 0, plantN = 0, lakeN = 0, sipping = false, bubbleTimer;

function showBubble(text, hotId) {
  const b = $('#bubble'), h = $('#hot-' + hotId);
  if (!h) return;
  const r = h.querySelector('.hit').getBoundingClientRect();
  b.textContent = text;
  const bw = b.offsetWidth || 160;
  b.style.left = Math.min(innerWidth - bw / 2 - 12, Math.max(bw / 2 + 12, r.left + r.width / 2)) + 'px';
  b.style.top = Math.max(120, r.top + r.height * .12) + 'px';
  b.classList.add('show');
  clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => b.classList.remove('show'), 2400);
}

function drinkCoffee() {
  if (sipping) return;
  sipping = true;
  const mug = $('.sprite-mug'), lite = reduced();
  mug.classList.add(lite ? 'sip-lite' : 'sip');
  body.classList.add('sipping');
  sound.sip(lite ? .05 : .25);
  showBubble(SIP_LINES[sipN++ % SIP_LINES.length], 'coffee');
  setTimeout(() => { mug.classList.remove('sip', 'sip-lite'); body.classList.remove('sipping'); sipping = false; }, lite ? 650 : 1350);
}
function wigglePlant() {
  const g = $('.sprite-plant'); if (!g) return;
  g.classList.remove('wiggle', 'wiggle-lite'); void g.getBBox();
  g.classList.add(reduced() ? 'wiggle-lite' : 'wiggle');
  sound.rustle();
  showBubble(PLANT_LINES[plantN++ % PLANT_LINES.length], 'plant');
}
function touchLake(evt) {
  const [x0, y0, x1, y1] = L.hot.find(o => o.id === 'lake').box;
  let x = (x0 + x1) / 2, y = (y0 + y1) / 2;
  if (evt && evt.clientX) {
    const r = stage.getBoundingClientRect();
    x = (evt.clientX - r.left) / scale; y = (evt.clientY - r.top) / scale;
  }
  sound.plop();
  showBubble(LAKE_LINES[lakeN++ % LAKE_LINES.length], 'lake');
  if (reduced()) return;
  const layer = $('#rippleLayer'), k = 2.3;
  [0, .35, .7].forEach(d => {
    const e = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    Object.entries({ cx: x, cy: y, rx: 90 * k, ry: 22 * k, fill: 'none', stroke: '#fff', 'stroke-width': 1.4 * k, class: 'ripple-big', style: `animation-delay:${d}s;opacity:0` }).forEach(([a, v]) => e.setAttribute(a, v));
    layer.appendChild(e); setTimeout(() => e.remove(), 3400);
  });
}
function openCamera(src) {
  const f = $('#flashOverlay');
  f.classList.remove('pop'); void f.offsetWidth;
  if (!reduced()) f.classList.add('pop');
  sound.shutter();
  setTimeout(() => album.open(src), reduced() ? 0 : 260);
}

const ACTIONS = {
  coffee: () => drinkCoffee(),
  journal: src => { sound.page(); journal.open(src); },
  camera: src => openCamera(src),
  lamp: () => setLamp(!settings.lamp),
  plant: () => wigglePlant(),
  lake: (src, e) => touchLake(e),
};
function act(name, src, e) { sound.unlock(); hideTip(); ACTIONS[name]?.(src, e); }

const tip = $('#tooltip');
function showTip(h) {
  const r = h.querySelector('.hit').getBoundingClientRect();
  tip.textContent = h.dataset.tip;
  tip.style.left = Math.min(innerWidth - 80, Math.max(80, r.left + r.width / 2)) + 'px';
  tip.style.top = Math.max(60, r.top + 4) + 'px';
  tip.classList.add('show');
}
function hideTip() { tip.classList.remove('show'); }
function wireHot() {
  $$('.hot', sHot).forEach(h => {
    h.addEventListener('click', e => act(h.dataset.action, h, e));
    h.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(h.dataset.action, h); } });
    h.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') showTip(h); });
    h.addEventListener('pointerleave', hideTip);
    h.addEventListener('focus', () => { if (h.matches(':focus-visible')) showTip(h); });
    h.addEventListener('blur', hideTip);
  });
}

/* ---------- 物品标签（手机首次进入时显示，可在帮助里开关） ---------- */
const labelsBox = $('#labels');
function buildTags() {
  labelsBox.replaceChildren(...L.hot.map(o => {
    const b = document.createElement('button');
    b.className = 'tag'; b.type = 'button'; b.textContent = o.label; b.dataset.for = o.id; b.tabIndex = -1;
    b.addEventListener('click', () => act(o.id, $('#hot-' + o.id), null));
    return b;
  }));
  placeTags();
}
function placeTags() {
  $$('.tag', labelsBox).forEach(t => {
    const h = $('#hot-' + t.dataset.for); if (!h) return;
    const r = h.querySelector('.hit').getBoundingClientRect();
    const y = t.dataset.for === 'lamp' ? r.top + r.height * .25 : t.dataset.for === 'coffee' ? r.top + r.height * .45 : r.top + 8;
    t.style.left = Math.min(innerWidth - 44, Math.max(44, r.left + r.width / 2)) + 'px';
    t.style.top = Math.max(130, y) + 'px';
  });
}
function setTags(on, persist) {
  body.classList.toggle('show-tags', on);
  $('#tagSwitch').setAttribute('aria-checked', String(on));
  $('#coach').hidden = !on || settings.tagsSeen;
  if (persist) { settings.showTags = on; saveSettings(); }
  if (on) placeTags();
}
$('#tagSwitch').addEventListener('click', () => setTags(!body.classList.contains('show-tags'), true));
$('#coachClose').addEventListener('click', () => { settings.tagsSeen = true; saveSettings(); setTags(false, true); });

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* =========================================================
   4. 面板通用
   ========================================================= */
function setupDialog(dlg, { onClose, onOpen } = {}) {
  let opener = null;
  const close = () => {
    if (!dlg.open) return;
    onClose?.();
    if (reduced()) { dlg.close(); return; }
    dlg.classList.add('closing');
    setTimeout(() => { dlg.classList.remove('closing'); dlg.close(); }, 170);
  };
  dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
  dlg.addEventListener('close', () => { opener?.focus?.({ preventScroll: true }); });
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
  $$('[data-close]', dlg).forEach(b => b.addEventListener('click', close));
  return {
    open(src) { opener = src || document.activeElement; hideTip(); if (!dlg.open) dlg.showModal(); onOpen?.(); },
    close,
  };
}
// label 作为按钮时支持键盘
$$('label[for="fileInput"]').forEach(l => l.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#fileInput').click(); } }));

/* ---------- 手账：空白 / 编辑 / 已收好 / 失败 ---------- */
const journal = (() => {
  const dlg = $('#journalDlg'), ta = $('#moodText'), status = $('#jStatus'), btn = $('#jSave');
  let saved = '';
  function state(s) {
    status.classList.toggle('error', s === 'error');
    btn.disabled = s === 'saved';
    if (s === 'saved') { status.textContent = '已收好，只留在这台设备。'; btn.innerHTML = '<svg class="ico"><use href="#i-check"/></svg>已收好'; }
    else if (s === 'error') { status.textContent = '暂时没能保存，请再试一次。'; btn.textContent = '再试一次'; }
    else { status.textContent = '仅保存在当前浏览器'; btn.textContent = '收好这一页'; }
  }
  function load() {
    const m = store.get(MKEY, null);
    saved = m?.text || ''; ta.value = saved;
    state(saved ? 'saved' : 'idle');
  }
  function save(silent) {
    const ok = store.set(MKEY, { text: ta.value, savedAt: Date.now() });
    if (!ok) { state('error'); return false; }
    saved = ta.value; state('saved');
    if (!silent) sound.page();
    return true;
  }
  const d = setupDialog(dlg, { onClose: () => { if (ta.value !== saved) save(true); } });
  btn.addEventListener('click', () => save());
  ta.addEventListener('input', () => state(ta.value === saved ? 'saved' : 'idle'));
  ta.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'Enter')) { e.preventDefault(); save(); } });
  return { open(src) { load(); d.open(src); setTimeout(() => ta.focus(), 50); }, _state: state };
})();

/* ---------- 照片存储 ---------- */
const photoDB = (() => {
  let dbp = null, memory = [], fallback = false;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      try {
        const r = indexedDB.open('zdyhr', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id' });
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    }).catch(() => { fallback = true; return null; });
    return dbp;
  }
  const tx = (db, mode, fn) => new Promise((res, rej) => {
    const t = db.transaction('photos', mode), out = fn(t.objectStore('photos'));
    t.oncomplete = () => res(out.result ?? out); t.onerror = () => rej(t.error);
  });
  return {
    get fallback() { return fallback; },
    async all() { const db = await open(); if (!db) return memory.slice(); return (await tx(db, 'readonly', s => s.getAll())).sort((a, b) => a.added - b.added); },
    async add(rec) { const db = await open(); if (!db) { memory.push(rec); return; } await tx(db, 'readwrite', s => s.put(rec)); },
    async del(id) { const db = await open(); if (!db) { memory = memory.filter(p => p.id !== id); return; } await tx(db, 'readwrite', s => s.delete(id)); },
  };
})();
async function shrink(file) {
  const MAX = 1800;
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); }); }
  const k = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(res => c.toBlob(b => res(b || file), 'image/jpeg', .88));
}

/* ---------- 相册：空白 / 网格 / 单张 / 删除确认 ---------- */
const album = (() => {
  const dlg = $('#albumDlg'), grid = $('#aGrid'), single = $('#aSingle'), empty = $('#aEmpty');
  const img = $('#aImg'), cap = $('#aCap'), big = $('#aBig'), note = $('#aNote'), input = $('#fileInput');
  let photos = [], idx = 0, view = 'grid', confirming = false, loaded = false;
  const urls = new Map();
  const url = p => { if (!urls.has(p.id)) urls.set(p.id, URL.createObjectURL(p.blob)); return urls.get(p.id); };
  const tilt = id => ((parseInt(String(id).slice(-3), 36) || 5) % 5 - 2) * .9;
  const dateOf = p => { const d = new Date(p.added); return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`; };

  function render() {
    const has = photos.length > 0;
    if (!has) view = 'grid';
    empty.hidden = has;
    grid.hidden = !has || view !== 'grid';
    single.hidden = !has || view !== 'single';
    $('#aAdd').hidden = !has || view !== 'grid';
    $('#aBack').hidden = !has || view !== 'single' || confirming;
    $('#aDelete').hidden = !has || view !== 'single' || confirming;
    $('#aCancelDel').hidden = $('#aDoDel').hidden = !confirming;
    note.classList.toggle('error', confirming);
    note.textContent = confirming ? '删除后就找不回来了。' : !has ? '照片仅保存在当前浏览器'
      : view === 'grid' ? `共 ${photos.length} 张 · 点开一张可以放大或删除` : `${idx + 1} / ${photos.length} · 照片仅保存在当前浏览器`;
    if (has && view === 'grid') {
      grid.replaceChildren(...photos.map((p, i) => {
        const b = document.createElement('button');
        b.className = 'polaroid grid-item'; b.type = 'button'; b.setAttribute('role', 'listitem');
        b.style.setProperty('--tilt', tilt(p.id) + 'deg');
        b.setAttribute('aria-label', `第 ${i + 1} 张照片，${dateOf(p)}，点开查看`);
        b.innerHTML = `<img alt="" src="${url(p)}"><span class="cap"></span>`;
        const c = document.createElement('figcaption'); c.textContent = dateOf(p); b.querySelector('.cap').replaceWith(c);
        b.addEventListener('click', () => { idx = i; view = 'single'; render(); $('#aNext').focus(); });
        return b;
      }));
    }
    if (has && view === 'single') {
      idx = Math.max(0, Math.min(idx, photos.length - 1));
      const p = photos[idx];
      img.src = url(p); img.alt = `第 ${idx + 1} 张旅行照片`;
      cap.textContent = dateOf(p);
      big.style.setProperty('--tilt', tilt(p.id) + 'deg');
      $('#aPrev').disabled = $('#aNext').disabled = photos.length < 2;
    }
  }
  function go(dlt) {
    if (photos.length < 2 || view !== 'single' || confirming) return;
    idx = (idx + dlt + photos.length) % photos.length;
    if (reduced()) { render(); return; }
    big.classList.add('swap'); setTimeout(() => { render(); big.classList.remove('swap'); }, 150);
  }
  $('#aPrev').addEventListener('click', () => go(-1));
  $('#aNext').addEventListener('click', () => go(1));
  $('#aBack').addEventListener('click', () => { view = 'grid'; render(); grid.children[idx]?.focus(); });
  $('#aDelete').addEventListener('click', () => { confirming = true; render(); $('#aCancelDel').focus(); });
  $('#aCancelDel').addEventListener('click', () => { confirming = false; render(); $('#aDelete').focus(); });
  $('#aDoDel').addEventListener('click', async () => {
    const p = photos[idx];
    await photoDB.del(p.id);
    URL.revokeObjectURL(urls.get(p.id)); urls.delete(p.id);
    photos.splice(idx, 1); confirming = false;
    if (idx >= photos.length) idx = photos.length - 1;
    if (!photos.length) view = 'grid';
    render(); toast('这张照片已删除');
    (photos.length ? (view === 'single' ? $('#aNext') : grid.children[0]) : $('#aEmpty label'))?.focus();
  });
  dlg.addEventListener('keydown', e => {
    if (view !== 'single' || e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
  });
  let sx = null;
  single.addEventListener('pointerdown', e => { sx = e.clientX; });
  single.addEventListener('pointerup', e => { if (sx != null && Math.abs(e.clientX - sx) > 45) go(e.clientX < sx ? 1 : -1); sx = null; });

  async function addFiles(files) {
    const list = [...files].filter(f => f.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp|gif|avif)$/i.test(f.name));
    if (!list.length) return;
    let added = 0, failed = 0;
    for (const f of list) {
      try {
        const rec = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), blob: await shrink(f), added: Date.now(), name: f.name };
        await photoDB.add(rec); photos.push(rec); added++;
      } catch { failed++; }
    }
    view = 'grid'; confirming = false; render();
    let msg = added ? `放进了 ${added} 张照片` : '';
    if (failed) msg += (msg ? '，' : '') + `${failed} 张读不出来，可以先转成 JPG 再试`;
    if (photoDB.fallback && added) msg += '（这个浏览器无法长期保存，关闭后会消失）';
    if (msg) toast(msg);
  }
  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
  const dropZone = () => (photos.length ? grid : empty);
  ['dragenter', 'dragover'].forEach(t => dlg.addEventListener(t, e => { e.preventDefault(); dropZone().classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(t => dlg.addEventListener(t, e => { e.preventDefault(); grid.classList.remove('drag'); empty.classList.remove('drag'); }));
  dlg.addEventListener('drop', e => addFiles(e.dataTransfer.files));

  const d = setupDialog(dlg, { onClose: () => { confirming = false; } });
  return {
    async open(src) {
      if (!loaded) { photos = await photoDB.all().catch(() => []); loaded = true; }
      view = 'grid'; confirming = false; render(); d.open(src);
      setTimeout(() => (photos.length ? grid.children[0] : $('#aEmpty label'))?.focus(), 50);
    },
  };
})();

/* =========================================================
   5. 声音：Web Audio 实时合成（也可换成录音，见 CONFIG.audio）
   ========================================================= */
const sound = (() => {
  let ctx = null, master, sfx, lakeBus, rainBus, built = false, on = false;
  const vol = { lake: settings.lake / 100, rain: settings.rain / 100 };
  const files = {};
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = .9; master.connect(ctx.destination);
      sfx = ctx.createGain(); sfx.gain.value = .8; sfx.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function noise(kind, secs = 6) {
    const len = ctx.sampleRate * secs, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let l = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { l = (l + .02 * w) / 1.02; d[i] = l * 3.5; }
      else if (kind === 'pink') {
        b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852;
        b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926;
      } else d[i] = w;
    }
    return b;
  }
  const loop = buf => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * buf.duration); return s; };
  const filt = (type, f, q = .7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
  const gain = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const every = (fn, min, max) => { const t = () => { fn(); setTimeout(t, min + Math.random() * (max - min)); }; t(); };

  function build() {
    if (built) return; built = true;
    lakeBus = gain(0); lakeBus.connect(master);
    rainBus = gain(0); rainBus.connect(master);
    const W = noise('white'), P = noise('pink'), B = noise('brown');
    if (CONFIG.audio.lake) { files.lake = new Audio(CONFIG.audio.lake); files.lake.loop = true; files.lake.volume = 0; }
    else {
      const wave = gain(.4), lp = filt('lowpass', 480);
      loop(B).connect(lp).connect(wave).connect(lakeBus);
      every(() => wave.gain.setTargetAtTime(.18 + Math.random() * .75, ctx.currentTime, .9 + Math.random() * 1.2), 1800, 4200);
      const lap = gain(0), bp = filt('bandpass', 900, .9);
      loop(P).connect(bp).connect(lap).connect(lakeBus);
      every(() => {
        const t = ctx.currentTime;
        lap.gain.cancelScheduledValues(t); lap.gain.setTargetAtTime(.16 + Math.random() * .12, t, .25); lap.gain.setTargetAtTime(0, t + .6, .5);
        bp.frequency.setTargetAtTime(600 + Math.random() * 700, t, .3);
      }, 2600, 6000);
      const wind = gain(.12), wbp = filt('bandpass', 500, .55);
      loop(P).connect(wbp).connect(wind).connect(lakeBus);
      every(() => { const t = ctx.currentTime; wbp.frequency.setTargetAtTime(280 + Math.random() * 700, t, 2.5); wind.gain.setTargetAtTime(.05 + Math.random() * .2, t, 2.8); }, 3500, 7000);
    }
    if (CONFIG.audio.rain) { files.rain = new Audio(CONFIG.audio.rain); files.rain.loop = true; files.rain.volume = 0; }
    else {
      const hiss = gain(.22), hp = filt('highpass', 1100), lp = filt('lowpass', 7000);
      loop(W).connect(hp).connect(lp).connect(hiss).connect(rainBus);
      const roof = gain(.35), rlp = filt('lowpass', 320);
      loop(B).connect(rlp).connect(roof).connect(rainBus);
      every(() => {
        if (vol.rain <= 0 || !on) return;
        const n = 1 + (Math.random() * 3 | 0);
        for (let i = 0; i < n; i++) {
          const t = ctx.currentTime + Math.random() * .12, s = ctx.createBufferSource(); s.buffer = W;
          const f = filt('bandpass', 1800 + Math.random() * 4200, 6), g = gain(0);
          s.connect(f).connect(g).connect(rainBus);
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.12 + Math.random() * .25, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + .05 + Math.random() * .05);
          s.start(t, Math.random() * 5, .12);
        }
      }, 40, 160);
    }
  }
  function apply() {
    if (!ctx || !built) return;
    const t = ctx.currentTime;
    lakeBus.gain.setTargetAtTime(on ? vol.lake : 0, t, .6);
    rainBus.gain.setTargetAtTime(on ? vol.rain * .9 : 0, t, .6);
    for (const k of ['lake', 'rain']) {
      const a = files[k]; if (!a) continue;
      a.volume = on ? Math.min(1, vol[k]) : 0;
      if (on && vol[k] > 0) a.play().catch(() => {}); else a.pause();
    }
  }
  function env(g, t, peak, a, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
  function burst({ t, f1: a1, f2, q = 3, peak = .2, a = .03, d = .3, type = 'bandpass' }) {
    const s = ctx.createBufferSource(); s.buffer = burst.W || (burst.W = noise('white', 1));
    const f = filt(type, a1, q), g = gain(0);
    f.frequency.setValueAtTime(a1, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    s.connect(f).connect(g).connect(sfx); env(g, t, peak, a, d); s.start(t, 0, a + d + .05);
  }
  function tone({ t, f1: a1, f2, peak = .2, a = .01, d = .2 }) {
    const o = ctx.createOscillator(), g = gain(0);
    o.frequency.setValueAtTime(a1, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    o.connect(g).connect(sfx); env(g, t, peak, a, d); o.start(t); o.stop(t + a + d + .05);
  }
  const ready = () => ensure() && ctx.state !== 'closed';
  return {
    unlock() { ensure(); },
    get on() { return on; },
    start() { if (!ready()) return false; build(); on = true; apply(); return true; },
    stop() { on = false; apply(); },
    setVol(k, v) { vol[k] = v / 100; apply(); },
    sip(delay = .25) {
      if (!ready()) return; const t = ctx.currentTime + delay;
      burst({ t, f1: 700, f2: 2400, q: 5, peak: .16, a: .05, d: .3 });
      burst({ t: t + .38, f1: 900, f2: 2000, q: 6, peak: .1, a: .03, d: .16 });
      tone({ t: t + .6, f1: 230, f2: 105, peak: .32, a: .012, d: .13 });
      burst({ t: t + .6, f1: 300, q: 1, peak: .06, a: .01, d: .1, type: 'lowpass' });
      tone({ t: t + 1.05, f1: 2300, peak: .045, a: .003, d: .22 });
      tone({ t: t + 1.05, f1: 3460, peak: .025, a: .003, d: .16 });
    },
    click() { if (!ready()) return; const t = ctx.currentTime + .01; burst({ t, f1: 3200, q: 1.2, peak: .22, a: .002, d: .03, type: 'highpass' }); tone({ t, f1: 1800, f2: 900, peak: .08, a: .002, d: .04 }); },
    shutter() { if (!ready()) return; const t = ctx.currentTime + .01; burst({ t, f1: 4000, q: 1, peak: .25, a: .002, d: .035, type: 'highpass' }); burst({ t: t + .09, f1: 2500, q: 1, peak: .2, a: .002, d: .05, type: 'highpass' }); },
    rustle() { if (!ready()) return; const t = ctx.currentTime; for (let i = 0; i < 6; i++) burst({ t: t + i * .07 + Math.random() * .04, f1: 2600 + Math.random() * 2400, q: 2.5, peak: .05 + Math.random() * .05, a: .01, d: .08 }); },
    page() { if (!ready()) return; burst({ t: ctx.currentTime + .01, f1: 1200, f2: 4200, q: 1.4, peak: .07, a: .08, d: .22 }); },
    plop() { if (!ready()) return; const t = ctx.currentTime + .01; tone({ t, f1: 520, f2: 1300, peak: .18, a: .005, d: .12 }); burst({ t: t + .05, f1: 900, f2: 300, q: 2, peak: .08, a: .02, d: .5 }); },
  };
})();

/* ---------- 声音面板 ---------- */
const soundDlg = setupDialog($('#soundDlg'));
const soundToggle = $('#soundToggle'), soundBtn = $('#soundBtn');
function setSound(onNow) {
  if (onNow && !sound.start()) { toast('这个浏览器暂时不能播放声音'); return; }
  if (!onNow) sound.stop();
  soundBtn.setAttribute('aria-pressed', String(onNow));
  soundBtn.setAttribute('aria-label', onNow ? '声音设置（正在播放）' : '声音设置（已关闭）');
  soundToggle.textContent = onNow ? '先安静一下' : '开始聆听';
  soundToggle.className = 'btn ' + (onNow ? 'secondary' : 'primary');
}
soundBtn.addEventListener('click', () => { sound.unlock(); soundDlg.open(soundBtn); });
soundToggle.addEventListener('click', () => setSound(!sound.on));
$('#volLake').addEventListener('input', e => { settings.lake = +e.target.value; sound.setVol('lake', settings.lake); saveSettings(); });
$('#volRain').addEventListener('input', e => { settings.rain = +e.target.value; settings.rainTouched = true; sound.setVol('rain', settings.rain); saveSettings(); });

/* ---------- 帮助 / 天气（手机） ---------- */
const helpDlg = setupDialog($('#helpDlg'));
$('#helpBtn').addEventListener('click', () => helpDlg.open($('#helpBtn')));
const weatherDlg = setupDialog($('#weatherDlg'));
$('#weatherPill').addEventListener('click', () => weatherDlg.open($('#weatherPill')));
$$('.wopt').forEach(b => b.addEventListener('click', () => { setWeather(b.dataset.w); weatherDlg.close(); }));
$$('.wbtn').forEach(b => b.addEventListener('click', () => setWeather(b.dataset.w)));

/* ---------- 沉浸模式 ---------- */
function setImmersive(on) {
  body.classList.toggle('immersive', on);
  $('#exitImmersive').hidden = !on;
  hideTip();
  if (on) $('#exitImmersive').focus(); else $('#immersiveBtn').focus();
}
$('#immersiveBtn').addEventListener('click', () => setImmersive(true));
$('#exitImmersive').addEventListener('click', () => setImmersive(false));

/* ---------- 键盘 ---------- */
document.addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]') || e.target.matches('input, textarea')) return;
  if (e.key === 'Escape') { if (body.classList.contains('immersive')) setImmersive(false); else if (body.classList.contains('show-tags')) setTags(false, true); }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === '1') setWeather('sunny');
  if (e.key === '2') setWeather('sunset');
  if (e.key === '3') setWeather('rain');
});

/* =========================================================
   6. 启动
   ========================================================= */
$('#volLake').value = settings.lake;
$('#volRain').value = settings.rain;
fit();
setWeather(settings.weather, true);
setLamp(!!settings.lamp, true);
let rT; addEventListener('resize', () => { cancelAnimationFrame(rT); rT = requestAnimationFrame(fit); });
document.fonts?.ready?.then(placeTags);
const firstTouch = touchMQ.matches && !settings.tagsSeen && settings.showTags == null;
setTags(settings.showTags ?? firstTouch, false);
if (!touchMQ.matches && !settings.tagsSeen) setTimeout(() => toast('把鼠标移到桌上的小物件上看看'), 1200);
})();
