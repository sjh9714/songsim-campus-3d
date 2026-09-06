import './style.css';
import { createElement, ArrowLeft, ArrowRight, ArrowUpRight, Building2, Check, ChevronDown, ChevronRight, Compass, Expand, ExternalLink, Focus, Image, Info, Layers2, Map, MapPin, Menu, Minus, Mouse, Plus, Search, Tags, X } from 'lucide';
import type { IconNode } from 'lucide';
import type { Building, CampusData } from './types';
import { CampusViewer } from './viewer';

const icons: Record<string, IconNode> = { ArrowLeft, ArrowRight, ArrowUpRight, Building2, Check, ChevronDown, ChevronRight, Compass, Expand, ExternalLink, Focus, Image, Info, Layers2, Map, MapPin, Menu, Minus, Mouse, Plus, Search, Tags, X };
const icon = (name: string, size = 18) => createElement(icons[name], { width: size, height: size, 'stroke-width': 1.65, 'aria-hidden': 'true' }).outerHTML;
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div id="scene"></div>
  <header class="topbar">
    <a class="brand" href="#" aria-label="성심교정 전체 보기">
      <span class="brand-symbol">${icon('Building2', 23)}</span>
      <span class="brand-name">가톨릭대학교<span>THE CATHOLIC UNIVERSITY OF KOREA</span></span>
    </a>
    <div class="topbar-right"><span class="location">${icon('MapPin', 14)} 경기도 부천시</span><span class="edition"><span></span> SONGSIM CAMPUS</span>
      <button id="mobile-menu" class="icon-button" aria-label="건물 목록 열기" aria-expanded="false">${icon('Menu')}</button>
    </div>
  </header>

  <aside id="sidebar" class="sidebar" aria-label="캠퍼스 건물 목록">
    <div class="sidebar-intro"><div class="eyebrow">EXPLORE IN 3D</div><h1>성심교정<span>聖心校庭</span></h1><p>건물과 길, 그리고 초록의 풍경.</p></div>
    <div class="search-field">${icon('Search', 17)}<input id="search" type="search" placeholder="건물명 또는 코드 검색" aria-label="건물명 또는 코드 검색" autocomplete="off" spellcheck="false"/><span class="search-key">/</span></div>
    <div class="list-heading"><span>캠퍼스 건물</span><span id="result-count"></span></div>
    <nav id="building-list" aria-label="건물 선택"></nav>
    <div id="no-results" hidden><span>${icon('Search', 25)}</span><strong>검색 결과가 없습니다</strong><p>다른 건물명이나 코드를 입력해 보세요.</p><button id="clear-search">검색 지우기</button></div>
    <div class="sidebar-footer"><button id="plan-button">${icon('Map', 16)} 공식 캠퍼스 안내도 ${icon('ArrowUpRight', 15)}</button></div>
  </aside>

  <div class="scene-heading"><span class="scene-dot"></span><span id="view-caption">성심교정 전체</span><span class="scene-divider"></span><span>3D VIEW</span></div>
  <aside id="detail" class="detail" aria-label="선택한 건물" hidden>
    <div class="detail-top"><span id="detail-code"></span><span>BUILDING GUIDE</span><button id="detail-close" class="icon-button" aria-label="건물 정보 닫기">${icon('X', 18)}</button></div>
    <div class="detail-photo"><img id="building-photo" alt=""/><span class="photo-tag">${icon('Image', 13)} 학교 공식 사진</span><div id="photo-unavailable" hidden>${icon('Map', 28)}<span>공식 안내도로 위치 확인</span></div></div>
    <div class="detail-body"><div class="detail-title"><h2 id="detail-name"></h2><span id="detail-english"></span></div><p id="detail-subtitle"></p>
      <div class="detail-actions"><button id="compare-button">${icon('Layers2', 16)}<span>사진과 비교</span></button><button id="close-view-button" class="icon-button" aria-label="건물 외관 가까이 보기" title="외관 가까이 보기">${icon('Focus', 18)}</button></div>
      <div class="detail-facts"><div><span>건물 코드</span><strong id="detail-code-value"></strong></div><div><span id="floor-label"></span><strong id="detail-floor"></strong></div></div>
      <details id="source-details"><summary>재구성에 사용한 자료 ${icon('ChevronDown', 15)}</summary><p id="source-note"></p><div class="source-links"><a id="photo-source" href="#" target="_blank" rel="noopener noreferrer">공식 원본 사진 ${icon('ExternalLink', 12)}</a><a id="footprint-source" href="#" target="_blank" rel="noopener noreferrer">건물 외곽선 ${icon('ExternalLink', 12)}</a><a id="architecture-source" href="#" target="_blank" rel="noopener noreferrer" hidden>공개 건축 자료 ${icon('ExternalLink', 12)}</a></div></details>
      <p class="photo-credit">사진 © 가톨릭대학교</p>
    </div>
    <div class="detail-navigation"><button id="previous-building">${icon('ArrowLeft', 15)} 이전 건물</button><span id="detail-index"></span><button id="next-building">다음 건물 ${icon('ArrowRight', 15)}</button></div>
  </aside>

  <div class="map-controls" aria-label="지도 조작">
    <button id="north-button" class="north-button" aria-label="지도를 북쪽 기준으로 정렬" title="북쪽 정렬"><span>N</span><svg id="compass-arrow" width="25" height="31" viewBox="0 0 25 31" aria-hidden="true"><path d="M12.5 3 20.5 25 12.5 20 4.5 25Z" fill="#8f9b90"/><path d="M12.5 3V20L4.5 25Z" fill="#244b3e"/></svg></button>
    <div class="zoom-controls"><button id="zoom-in" class="icon-button" aria-label="확대" title="확대">${icon('Plus', 19)}</button><button id="zoom-out" class="icon-button" aria-label="축소" title="축소">${icon('Minus', 19)}</button></div>
    <button id="fullscreen-button" class="icon-button floating" aria-label="전체 화면" title="전체 화면">${icon('Expand', 18)}</button>
  </div>

  <div class="bottom-area"><div class="view-toolbar" role="group" aria-label="보기 설정">
    <button id="home-button" class="is-active" aria-pressed="true">${icon('Compass', 17)}<span>전체 보기</span></button>
    <button id="top-button" aria-pressed="false">${icon('Map', 17)}<span>위에서 보기</span></button>
    <span class="toolbar-divider"></span><button id="labels-button" aria-pressed="true" title="건물 이름 표시">${icon('Tags', 17)}<span>건물 이름</span></button>
  </div><div class="gesture-hint">${icon('Mouse', 13)} 드래그로 회전 <span>·</span> 스크롤로 확대 <span>·</span> 오른쪽 드래그로 이동</div></div>
  <footer class="attribution"><span>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a></span><button id="sources-button">${icon('Info', 13)} 자료와 재현 범위</button></footer>
  <div id="toast" role="status" aria-live="polite"></div>
  <div id="loading" class="loading"><div class="loading-mark">${icon('Building2', 34)}</div><span class="eyebrow">THE CATHOLIC UNIVERSITY OF KOREA</span><h2>성심교정</h2><div class="loading-line"><span></span></div><p id="loading-message">캠퍼스 자료를 불러오고 있습니다</p></div>
  <dialog id="sources-dialog" class="sources-dialog"><div class="dialog-head"><div><span class="eyebrow">ABOUT THIS CAMPUS</span><h2>자료와 재현 범위</h2></div><button class="icon-button dialog-close" aria-label="닫기">${icon('X', 20)}</button></div>
    <p class="dialog-lead">실제 위치와 공개 사진을 바탕으로 만든<br/>성심교정의 3D 외관 재구성입니다.</p>
    <div class="source-entry"><span class="source-number">01</span><div><h3>가톨릭대학교 공식 자료</h3><p>건물 이름, 위치, 외관 사진과 캠퍼스 안내도를 참조했습니다. 사진과 안내도의 권리는 가톨릭대학교에 있습니다.</p><a href="https://www.catholic.ac.kr/ko/about/campus-map.do" target="_blank" rel="noopener noreferrer">공식 캠퍼스맵 ${icon('ArrowUpRight', 14)}</a></div></div>
    <div class="source-entry"><span class="source-number">02</span><div><h3>OpenStreetMap</h3><p>건물 외곽선, 도로와 운동장 위치를 사용했습니다. 오래된 건물 정보는 현재 공식 안내도와 대조해 일부 보정했습니다.</p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors · ODbL ${icon('ArrowUpRight', 14)}</a></div></div>
    <div class="source-entry"><span class="source-number">03</span><div><h3>공개 고도 자료</h3><p>Mapzen Terrain Tiles의 고도 자료로 캠퍼스 주변 경사를 구성했습니다. 건물 바닥과 운동장 주변은 평탄화했습니다. SRTM·GMTED2010 고도 자료: U.S. Geological Survey.</p><a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener noreferrer">고도 자료 출처 및 기여자 ${icon('ArrowUpRight', 14)}</a></div></div>
    <div class="source-entry"><span class="source-number">04</span><div><h3>건축가 공개 도면과 건축 기록</h3><p>안드레아관의 기준층·단면도, 정림건축의 김수환관 자료, 학생회관의 건축 기록을 대조했습니다. 확인된 층수와 추정 치수를 건물별로 구분했습니다.</p><a href="https://online.fliphtml5.com/njumk/nghu/#p=86" target="_blank" rel="noopener noreferrer">WIDE AR 91 · 안드레아관 설계 자료 ${icon('ArrowUpRight', 14)}</a><br/><a href="https://ggarchimap.gg.go.kr/archives/gg_building-presentday/07/57/2594/" target="_blank" rel="noopener noreferrer">경기건축포털 · 학생회관 ${icon('ArrowUpRight', 14)}</a><br/><a href="https://junglim.com/%EA%B0%80%ED%86%A8%EB%A6%AD%EB%8C%80%ED%95%99%EA%B5%90-150%EC%A3%BC%EB%85%84-%EA%B8%B0%EB%85%90%EA%B4%80/" target="_blank" rel="noopener noreferrer">정림건축 · 김수환관 설계 자료 ${icon('ArrowUpRight', 14)}</a></div></div>
    <div class="accuracy-note"><strong>실제와 비교하며 살펴봐 주세요.</strong><p>측량 모델이 아닙니다. 층수가 확인된 건물도 높이와 상세 치수는 대부분 추정입니다. 창호, 사진에 없는 뒷면, 수목과 세부 조경에는 추정이 남아 있습니다. 실내 전체는 구현하지 않았으며, 실제와 완전히 같은 외관은 검증되지 않았습니다.</p></div><p class="source-date">자료 확인 2026. 09. 06. · 비공식 개인 제작</p>
  </dialog>
  <dialog id="plan-dialog" class="plan-dialog"><div class="dialog-head"><div><span class="eyebrow">OFFICIAL CAMPUS MAP</span><h2>성심교정 안내도</h2></div><button class="icon-button dialog-close" aria-label="닫기">${icon('X', 20)}</button></div><div class="plan-image"><img src="/reference/campus-plan.png" alt="가톨릭대학교 공식 성심교정 평면 안내도"/></div><div class="plan-footer"><span>© 가톨릭대학교 · 공식 안내도</span><a href="https://www.catholic.ac.kr/ko/about/campus-map.do" target="_blank" rel="noopener noreferrer">공식 사이트에서 보기 ${icon('ArrowUpRight', 14)}</a></div></dialog>
`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let data: CampusData;
let viewer: CampusViewer;
let current: string | null = null;
let labelsShown = true;
let comparing = false;
let toastTimer: ReturnType<typeof setTimeout>;
const search = $<HTMLInputElement>('search');
$('sidebar').inert = innerWidth < 1000;

function toast(message: string) {
  $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2800);
}

function renderList() {
  const scrollTop = $('building-list').scrollTop;
  const value = search.value.trim().toLocaleLowerCase();
  const aliases: Record<string, string> = { '3': '스테파노 기숙사 국제관', '11': '소피이바라 학생회관', '13': '행정동 교수연구동 T', '15': '중앙도서관 도서관', '17': '정진석 약학관', '5': '기숙사 생활관' };
  const filtered = data.buildings.filter(b => [b.name, b.code, b.subtitle, b.english, aliases[b.id] || ''].join(' ').toLocaleLowerCase().includes(value));
  $('building-list').replaceChildren();
  filtered.forEach(b => {
    const button = document.createElement('button'); button.className = 'building-row'; button.dataset.id = b.id;
    button.classList.toggle('selected', b.id === current); button.setAttribute('aria-pressed', String(b.id === current));
    button.innerHTML = '<span class="building-code"></span><span class="building-row-name"></span><span class="row-arrow">' + icon('ChevronRight', 14) + '</span>';
    button.querySelector('.building-code')!.textContent = b.code;
    button.querySelector('.building-row-name')!.textContent = b.name;
    button.addEventListener('click', () => selectBuilding(b.id)); $('building-list').append(button);
  });
  $('result-count').textContent = String(filtered.length).padStart(2, '0');
  $('no-results').hidden = filtered.length > 0;
  $('building-list').scrollTop = scrollTop;
}

function selectBuilding(id: string) {
  if (!viewer) return;
  const b = data.buildings.find(b => b.id === id); if (!b) return;
  current = id;
  if (!b.photo && comparing) { comparing = false; app.classList.remove('is-comparing'); viewer.setComparison(false); }
  syncSidebar();
  $('detail').hidden = false; app.classList.add('has-selection');
  $('detail-code').textContent = b.code; $('detail-code-value').textContent = b.code === 'H' ? 'H · T' : b.code;
  $('detail-name').textContent = b.name; $('detail-english').textContent = b.english;
  $('detail-english').hidden = !b.english || b.english === b.name;
  $('detail-subtitle').textContent = b.subtitle;
  $('detail-subtitle').hidden = b.subtitle === b.name;
  document.querySelector<HTMLElement>('.photo-credit')!.hidden = !b.photo;
  const photo = $<HTMLImageElement>('building-photo');
  photo.hidden = !b.photo; $('photo-unavailable').hidden = !!b.photo;
  document.querySelector<HTMLElement>('.photo-tag')!.hidden = !b.photo;
  if (b.photo) { photo.src = b.photo; photo.alt = '가톨릭대학교 공식 ' + b.name + ' 외관 사진'; }
  else photo.removeAttribute('src');
  $<HTMLButtonElement>('compare-button').disabled = !b.photo;
  $('compare-button').querySelector('span')!.textContent = b.photo ? comparing ? '비교 화면 닫기' : '사진과 비교' : '비교 사진 미확보';
  $('floor-label').textContent = b.floorsVerified ? '지상 층수 · 자료 확인' : '모델 층수 · 추정';
  $('detail-floor').textContent = (b.kind === 'michael' ? '최고 ' : '') + b.floors + '층';
  $('source-note').textContent = b.sourceNote;
  const architectureLink = $<HTMLAnchorElement>('architecture-source');
  architectureLink.hidden = !b.architecture; architectureLink.href = b.architecture?.sourceUrl || '#';
  architectureLink.title = b.architecture?.sourceTitle || '';
  $<HTMLAnchorElement>('footprint-source').href = b.sourceUrl;
  const link = $<HTMLAnchorElement>('photo-source'); link.hidden = !b.photoSource; link.href = b.photoSource || '#';
  $('detail-index').textContent = String(data.buildings.indexOf(b) + 1).padStart(2, '0') + ' / ' + data.buildings.length;
  $<HTMLDetailsElement>('source-details').open = false;
  $('view-caption').textContent = b.name;
  setViewMode(null); closeMobileList(); renderList(); viewer.select(id);
  history.replaceState(null, '', '#' + b.code.toLowerCase());
}

function closeDetail(home = false) {
  current = null; comparing = false; app.classList.remove('has-selection', 'is-comparing');
  syncSidebar(); viewer?.setComparison(false);
  $('detail').hidden = true; $('view-caption').textContent = '성심교정 전체';
  $('compare-button').querySelector('span')!.textContent = '사진과 비교';
  viewer?.select(null); if (home) { viewer?.home(); setViewMode('home'); }
  if (data) renderList(); history.replaceState(null, '', location.pathname + location.search);
}

function setViewMode(mode: string | null) {
  for (const id of ['home', 'top']) { const active = mode === id; $(id + '-button').classList.toggle('is-active', active); $(id + '-button').setAttribute('aria-pressed', String(active)); }
}
function goHome() { closeDetail(); viewer?.home(); setViewMode('home'); }
function syncSidebar() { $('sidebar').inert = innerWidth < 1000 ? !app.classList.contains('list-open') : comparing; }
function closeMobileList() { app.classList.remove('list-open'); $('mobile-menu').setAttribute('aria-expanded', 'false'); syncSidebar(); }

search.addEventListener('input', () => { $('building-list').scrollTop = 0; if (data) renderList(); });
$('clear-search').addEventListener('click', () => { search.value = ''; renderList(); search.focus(); });
$('detail-close').addEventListener('click', () => closeDetail(true));
$('home-button').addEventListener('click', goHome);
document.querySelector('.brand')!.addEventListener('click', e => { e.preventDefault(); goHome(); });
$('top-button').addEventListener('click', () => { viewer?.top(); setViewMode('top'); });
$('labels-button').addEventListener('click', () => {
  labelsShown = !labelsShown; viewer?.setLabels(labelsShown); $('labels-button').setAttribute('aria-pressed', String(labelsShown));
  toast(labelsShown ? '건물 이름을 표시합니다' : '건물 이름을 숨겼습니다');
});
$('north-button').addEventListener('click', () => viewer?.north());
$('zoom-in').addEventListener('click', () => viewer?.zoom(.78));
$('zoom-out').addEventListener('click', () => viewer?.zoom(1.28));
$('close-view-button').addEventListener('click', () => { viewer?.closeView(); setViewMode(null); });
$('compare-button').addEventListener('click', () => {
  comparing = !comparing; app.classList.toggle('is-comparing', comparing);
  syncSidebar();
  $('compare-button').querySelector('span')!.textContent = comparing ? '비교 화면 닫기' : '사진과 비교';
  viewer?.setComparison(comparing);
});
for (const [id, delta] of [['previous-building', -1], ['next-building', 1]] as const) $(id).addEventListener('click', () => {
  const index = data.buildings.findIndex(b => b.id === current);
  selectBuilding(data.buildings[(index + delta + data.buildings.length) % data.buildings.length].id);
});
$('mobile-menu').addEventListener('click', () => { const open = app.classList.toggle('list-open'); $('mobile-menu').setAttribute('aria-expanded', String(open)); syncSidebar(); });
$('fullscreen-button').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await app.requestFullscreen(); }
  catch { toast('이 브라우저에서는 전체 화면을 사용할 수 없습니다.'); }
});
document.addEventListener('fullscreenchange', () => $('fullscreen-button').setAttribute('aria-label', document.fullscreenElement ? '전체 화면 종료' : '전체 화면'));
for (const [button, dialog] of [['sources-button', 'sources-dialog'], ['plan-button', 'plan-dialog']]) $(button).addEventListener('click', () => $<HTMLDialogElement>(dialog).showModal());
document.querySelectorAll<HTMLDialogElement>('dialog').forEach(dialog => {
  dialog.querySelector('.dialog-close')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { const rect = dialog.getBoundingClientRect(); if (e.target === dialog && (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)) dialog.close(); });
});
document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && !document.querySelector('dialog[open]')) { e.preventDefault(); if (innerWidth < 1000) { app.classList.add('list-open'); $('mobile-menu').setAttribute('aria-expanded', 'true'); syncSidebar(); } search.focus(); }
  if (e.key === 'Escape' && !document.querySelector('dialog[open]')) { if (app.classList.contains('list-open')) closeMobileList(); else if (current) closeDetail(true); }
});
window.addEventListener('resize', () => { syncSidebar(); viewer?.resize(); });

async function boot() {
  try {
    const response = await fetch('/data/campus.json'); if (!response.ok) throw new Error('캠퍼스 데이터를 불러오지 못했습니다.');
    data = await response.json() as CampusData; renderList();
    $('loading-message').textContent = '건물과 지형을 구성하고 있습니다';
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    viewer = new CampusViewer($('scene'), data, selectBuilding);
    viewer.onOrientation = angle => { $('compass-arrow').style.transform = `rotate(${-angle}deg)`; };
    viewer.onUserMove = () => { setViewMode(null); };
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    $('loading').classList.add('finished');
    const initial = data.buildings.find(b => b.code.toLowerCase() === location.hash.slice(1));
    if (initial) selectBuilding(initial.id);
    setTimeout(() => { $('loading').hidden = true; }, 450);
    window.addEventListener('pagehide', () => viewer.dispose(), { once: true });
  } catch (error) {
    console.error(error);
    $('loading').classList.add('failed');
    $('loading-message').textContent = '3D 화면을 열지 못했습니다. WebGL을 지원하는 브라우저에서 다시 시도해 주세요.';
    const retry = document.createElement('button'); retry.textContent = '다시 불러오기'; retry.className = 'retry-button'; retry.addEventListener('click', () => location.reload());
    const plan = document.createElement('button'); plan.textContent = '공식 안내도 보기'; plan.className = 'retry-button secondary'; plan.addEventListener('click', () => $<HTMLDialogElement>('plan-dialog').showModal());
    $('loading').append(retry, plan);
  }
}
void boot();
