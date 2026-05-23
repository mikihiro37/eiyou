// ============================================================
// まとめて写真解析 — 複数写真プレビューUI
// Phase 2b Step 1-3: 選択・プレビュー・メタデータ設定
// ============================================================

const MAX_BULK_PHOTOS = 5;
const BULK_DELAY_MS = 1500; // Step 4以降で使用

let _bpItems = [];
let _bpAnalyzing = false;

// ============================================================
// 初期化
// ============================================================
function initBulkPhoto() {
  const fileInput = document.getElementById('bpFileInput');
  if (!fileInput) return;
  fileInput.addEventListener('change', onBpFileSelect);
}

// ============================================================
// ファイル選択
// ============================================================
function onBpFileSelect(e) {
  const files = Array.from(e.target.files || []);
  // 先に配列化してからリセット（再選択で change が発火するよう）
  e.target.value = '';

  if (files.length === 0) return;

  revokeAllBpUrls();

  let selected = files;
  if (files.length > MAX_BULK_PHOTOS) {
    showToast(
      files.length + '枚が選択されましたが、最大' + MAX_BULK_PHOTOS + '枚です。最初の' + MAX_BULK_PHOTOS + '枚を使用します。',
      'info'
    );
    selected = files.slice(0, MAX_BULK_PHOTOS);
  }

  const today = new Date().toISOString().split('T')[0];
  _bpItems = selected.map((file, i) => createBpItem(file, i, today));
  renderBpList();
}

function createBpItem(file, index, today) {
  return {
    id: 'bp-' + Date.now() + '-' + index,
    file: file,
    previewUrl: URL.createObjectURL(file),
    date: today,
    mealType: 'lunch',
    memo: '',
    status: 'pending',
    result: null,
    error: null,
    createdAt: Date.now()
  };
}

// ============================================================
// URL 解放
// ============================================================
function revokeAllBpUrls() {
  _bpItems.forEach(item => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  });
}

// ============================================================
// カード削除
// ============================================================
function removeBpItem(id) {
  const item = _bpItems.find(i => i.id === id);
  if (item && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  _bpItems = _bpItems.filter(i => i.id !== id);
  renderBpList();
}

// ============================================================
// リスト描画
// ============================================================
function renderBpList() {
  const list = document.getElementById('bpList');
  const actions = document.getElementById('bpActions');
  if (!list) return;

  while (list.firstChild) list.removeChild(list.firstChild);

  if (_bpItems.length === 0) {
    if (actions) actions.style.display = 'none';
    return;
  }

  _bpItems.forEach(item => list.appendChild(buildBpCard(item)));

  if (actions) actions.style.display = 'flex';
}

function buildBpCard(item) {
  const card = document.createElement('div');
  card.className = 'bp-card';
  card.dataset.bpId = item.id;

  // 削除ボタン
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'bp-card-remove';
  removeBtn.setAttribute('aria-label', '削除');
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', () => removeBpItem(item.id));
  card.appendChild(removeBtn);

  // プレビュー画像
  const img = document.createElement('img');
  img.className = 'bp-card-img';
  img.src = item.previewUrl;
  img.alt = item.file.name || '食事の写真';
  card.appendChild(img);

  // フィールド群
  const fields = document.createElement('div');
  fields.className = 'bp-card-fields';

  // 日付
  const dateLabel = document.createElement('label');
  dateLabel.textContent = '日付';
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.value = item.date;
  dateInput.addEventListener('change', e => { item.date = e.target.value; });
  fields.appendChild(dateLabel);
  fields.appendChild(dateInput);

  // 食事区分
  const mealLabel = document.createElement('label');
  mealLabel.textContent = '食事';
  const mealSelect = document.createElement('select');
  [
    { value: 'breakfast', text: '朝食' },
    { value: 'lunch',     text: '昼食' },
    { value: 'dinner',    text: '夕食' },
    { value: 'snack',     text: '間食' }
  ].forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.text;
    if (opt.value === item.mealType) o.selected = true;
    mealSelect.appendChild(o);
  });
  mealSelect.addEventListener('change', e => { item.mealType = e.target.value; });
  fields.appendChild(mealLabel);
  fields.appendChild(mealSelect);

  // メモ
  const memoLabel = document.createElement('label');
  memoLabel.textContent = 'メモ（任意）';
  const memoInput = document.createElement('input');
  memoInput.type = 'text';
  memoInput.placeholder = '例：外食、残り物など';
  memoInput.value = item.memo;
  memoInput.addEventListener('input', e => { item.memo = e.target.value; });
  fields.appendChild(memoLabel);
  fields.appendChild(memoInput);

  // ステータスバッジ
  const badge = document.createElement('span');
  badge.className = 'bp-status-badge pending';
  badge.textContent = '未解析';
  badge.dataset.bpStatus = item.id;
  fields.appendChild(badge);

  card.appendChild(fields);
  return card;
}

// ============================================================
// リセット（Step 7以降で保存後に呼ぶ）
// ============================================================
function resetBpState() {
  revokeAllBpUrls();
  _bpItems = [];
  _bpAnalyzing = false;
  renderBpList();
}
