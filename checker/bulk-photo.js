// ============================================================
// まとめて写真解析 — 複数写真プレビューUI + 逐次Gemini解析 + 結果確認
// Phase 2b Step 1-6
// ============================================================

const MAX_BULK_PHOTOS = 5;
const BULK_DELAY_MS = 1500;

let _bpItems = [];
let _bpAnalyzing = false;
let _bpCancelled = false;

// Step 6: 表示する栄養素グループ定義（data.js の NUTRIENT_INFO を参照）
const BP_MACRO_KEYS = ['calories', 'protein', 'fat', 'carbs', 'fiber'];
const BP_DETAIL_GROUPS = [
  { label: 'ビタミン（脂溶性）',  keys: ['vitA','vitD','vitE','vitK'] },
  { label: 'ビタミン（水溶性）',  keys: ['vitB1','vitB2','vitB3','vitB5','vitB6','vitB7','vitB9','vitB12','vitC'] },
  { label: 'ミネラル（主要）',    keys: ['ca','p','mg','na','k'] },
  { label: 'ミネラル（微量）',    keys: ['fe','zn','cu','mn','iodine','se','mo'] },
  { label: '必須アミノ酸',        keys: ['ile','leu','lys','met','phe','thr','trp','val'] }
];

// ============================================================
// 初期化
// ============================================================
function initBulkPhoto() {
  const fileInput = document.getElementById('bpFileInput');
  if (!fileInput) return;
  fileInput.addEventListener('change', onBpFileSelect);

  const analyzeBtn = document.getElementById('bpAnalyzeBtn');
  if (analyzeBtn) analyzeBtn.addEventListener('click', startBpAnalysis);

  const cancelBtn = document.getElementById('bpCancelBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', () => {
    _bpCancelled = true;
    cancelGemini();
  });
}

// ============================================================
// ファイル選択
// ============================================================
function onBpFileSelect(e) {
  const files = Array.from(e.target.files || []);
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
  _bpItems.forEach(item => updateBpCardStatus(item));

  if (actions) actions.style.display = 'flex';
  updateAnalyzeBtnState();
}

function buildBpCard(item) {
  const card = document.createElement('div');
  card.className = 'bp-card';
  card.dataset.bpId = item.id;

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'bp-card-remove';
  removeBtn.setAttribute('aria-label', '削除');
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', () => removeBpItem(item.id));
  card.appendChild(removeBtn);

  const img = document.createElement('img');
  img.className = 'bp-card-img';
  img.src = item.previewUrl;
  img.alt = item.file.name || '食事の写真';
  card.appendChild(img);

  const fields = document.createElement('div');
  fields.className = 'bp-card-fields';

  const dateLabel = document.createElement('label');
  dateLabel.textContent = '日付';
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.value = item.date;
  dateInput.addEventListener('change', e => { item.date = e.target.value; });
  fields.appendChild(dateLabel);
  fields.appendChild(dateInput);

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

  const memoLabel = document.createElement('label');
  memoLabel.textContent = 'メモ（任意）';
  const memoInput = document.createElement('input');
  memoInput.type = 'text';
  memoInput.placeholder = '例：外食、残り物など';
  memoInput.value = item.memo;
  memoInput.addEventListener('input', e => { item.memo = e.target.value; });
  fields.appendChild(memoLabel);
  fields.appendChild(memoInput);

  const badge = document.createElement('span');
  badge.className = 'bp-status-badge pending';
  badge.textContent = '未解析';
  badge.dataset.bpStatus = item.id;
  fields.appendChild(badge);

  card.appendChild(fields);
  return card;
}

// ============================================================
// ユーティリティ
// ============================================================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isFatalBpError(msg) {
  if (!msg) return false;
  return (
    msg.startsWith('RATE_LIMITED') ||
    msg.startsWith('API_ERROR_503') ||
    msg === 'API_KEY_MISSING' ||
    msg === 'API_KEY_INVALID'
  );
}

function _normalizeFoodItem(food) {
  if (typeof food === 'string') return { name: food, quantity: '', grams: 0 };
  return { name: String(food.name || ''), quantity: String(food.quantity || ''), grams: Number(food.grams) || 0 };
}

// ============================================================
// UI 状態制御
// ============================================================
function updateAnalyzeBtnState() {
  const analyzeBtn = document.getElementById('bpAnalyzeBtn');
  if (!analyzeBtn) return;
  const hasPending = _bpItems.some(i => i.status === 'pending');
  analyzeBtn.disabled = !hasPending || _bpAnalyzing;
}

function setBpAnalyzing(analyzing) {
  _bpAnalyzing = analyzing;

  const analyzeBtn = document.getElementById('bpAnalyzeBtn');
  const cancelBtn  = document.getElementById('bpCancelBtn');
  const fileInput  = document.getElementById('bpFileInput');

  if (analyzeBtn) {
    analyzeBtn.disabled = analyzing;
    analyzeBtn.style.display = analyzing ? 'none' : '';
  }
  if (cancelBtn) cancelBtn.style.display = analyzing ? '' : 'none';
  if (fileInput) fileInput.disabled = analyzing;

  document.querySelectorAll('.bp-card-remove').forEach(btn => { btn.disabled = analyzing; });
  document.querySelectorAll('.bp-card-fields input, .bp-card-fields select').forEach(el => { el.disabled = analyzing; });
  document.querySelectorAll('.bp-food-add-btn, .bp-food-remove-btn').forEach(btn => { btn.disabled = analyzing; });
}

function updateBpProgress(current, total) {
  const progressEl = document.getElementById('bpProgress');
  const fillEl     = document.getElementById('bpProgressFill');
  const labelEl    = document.getElementById('bpProgressLabel');
  if (!progressEl) return;

  if (total === 0) {
    progressEl.style.display = 'none';
    return;
  }
  progressEl.style.display = '';
  const pct = Math.round((current / total) * 100);
  if (fillEl)  fillEl.style.width = pct + '%';
  if (labelEl) labelEl.textContent = current + ' / ' + total + ' 枚解析済み';
}

// ============================================================
// カードのステータス表示更新
// ============================================================
function updateBpCardStatus(item) {
  const card = document.querySelector('.bp-card[data-bp-id="' + item.id + '"]');
  if (!card) return;

  const badge = card.querySelector('[data-bp-status="' + item.id + '"]');
  if (badge) {
    badge.className = 'bp-status-badge ' + item.status;
    const labels = { pending: '未解析', analyzing: '解析中…', done: '完了', error: 'エラー' };
    badge.textContent = labels[item.status] || item.status;
  }

  const existing = card.querySelector('.bp-result-area, .bp-card-error');
  if (existing) existing.remove();

  if (item.status === 'done' && item.result) {
    card.querySelector('.bp-card-fields').appendChild(buildBpResultArea(item));
  } else if (item.status === 'error' && item.error) {
    card.querySelector('.bp-card-fields').appendChild(buildBpErrorArea(item));
  }
}

// ============================================================
// Step 6: 結果確認エリア
// ============================================================
function buildBpResultArea(item) {
  const r = item.result;
  // estimatedFoods を編集可能なオブジェクト配列に正規化（再描画でも安全）
  if (Array.isArray(r.estimatedFoods)) {
    r.estimatedFoods = r.estimatedFoods.map(_normalizeFoodItem);
  } else {
    r.estimatedFoods = [];
  }

  const area = document.createElement('div');
  area.className = 'bp-result-area';

  // 推定精度バッジ
  const confRow = document.createElement('div');
  confRow.className = 'bp-result-conf-row';
  const conf = r.confidence || '中';
  const confBadge = document.createElement('span');
  confBadge.className = 'bp-conf-badge ' + (conf === '高' ? 'conf-high' : conf === '低' ? 'conf-low' : 'conf-mid');
  confBadge.textContent = '推定精度：' + conf;
  confRow.appendChild(confBadge);
  area.appendChild(confRow);

  area.appendChild(_buildFoodSection(item));
  area.appendChild(_buildMacroSection(item));
  area.appendChild(_buildDetailSection(item));

  return area;
}

function _buildFoodSection(item) {
  const sec = document.createElement('div');
  sec.className = 'bp-result-section';

  const head = document.createElement('div');
  head.className = 'bp-result-section-head';
  head.textContent = '推定食品';
  sec.appendChild(head);

  const listEl = document.createElement('div');
  listEl.className = 'bp-food-list';
  sec.appendChild(listEl);
  _renderFoodList(item, listEl);

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'bp-food-add-btn';
  addBtn.textContent = '+ 食品を追加';
  addBtn.addEventListener('click', () => {
    item.result.estimatedFoods.push({ name: '', quantity: '', grams: 0 });
    _renderFoodList(item, listEl);
  });
  sec.appendChild(addBtn);

  return sec;
}

function _renderFoodList(item, listEl) {
  while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

  item.result.estimatedFoods.forEach((food, idx) => {
    const row = document.createElement('div');
    row.className = 'bp-food-item';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'bp-food-name-input';
    nameInput.placeholder = '食品名';
    nameInput.value = food.name;
    nameInput.addEventListener('input', e => { food.name = e.target.value; });

    const qtyInput = document.createElement('input');
    qtyInput.type = 'text';
    qtyInput.className = 'bp-food-qty-input';
    qtyInput.placeholder = '量（例：1杯）';
    qtyInput.value = food.quantity;
    qtyInput.addEventListener('input', e => { food.quantity = e.target.value; });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'bp-food-remove-btn';
    removeBtn.textContent = '×';
    removeBtn.setAttribute('aria-label', '削除');
    removeBtn.addEventListener('click', () => {
      item.result.estimatedFoods.splice(idx, 1);
      _renderFoodList(item, listEl);
    });

    row.appendChild(nameInput);
    row.appendChild(qtyInput);
    row.appendChild(removeBtn);
    listEl.appendChild(row);
  });
}

function _buildMacroSection(item) {
  const r = item.result;
  const sec = document.createElement('div');
  sec.className = 'bp-result-section';

  const head = document.createElement('div');
  head.className = 'bp-result-section-head';
  head.textContent = '主要栄養素（推定）';
  sec.appendChild(head);

  const grid = document.createElement('div');
  grid.className = 'bp-macro-grid';

  BP_MACRO_KEYS.forEach(key => {
    const info = NUTRIENT_INFO[key];
    if (!info) return;

    const macroItem = document.createElement('div');
    macroItem.className = 'bp-macro-item';

    const label = document.createElement('div');
    label.className = 'bp-macro-label';
    label.textContent = info.name;

    const valRow = document.createElement('div');
    valRow.className = 'bp-macro-value-row';

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'bp-macro-input';
    input.min = '0';
    input.value = r.nutrients && r.nutrients[key] != null ? r.nutrients[key] : 0;
    input.addEventListener('input', e => {
      if (!r.nutrients) r.nutrients = {};
      r.nutrients[key] = Math.max(0, Number(e.target.value) || 0);
    });

    const unit = document.createElement('span');
    unit.className = 'bp-macro-unit';
    unit.textContent = info.unit;

    valRow.appendChild(input);
    valRow.appendChild(unit);
    macroItem.appendChild(label);
    macroItem.appendChild(valRow);
    grid.appendChild(macroItem);
  });

  sec.appendChild(grid);
  return sec;
}

function _buildDetailSection(item) {
  const r = item.result;
  const sec = document.createElement('div');
  sec.className = 'bp-detail-section';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'bp-detail-toggle';
  toggle.textContent = '詳細栄養素を見る ▼';

  const body = document.createElement('div');
  body.className = 'bp-detail-body';
  body.style.display = 'none';

  toggle.addEventListener('click', () => {
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : '';
    toggle.textContent = isOpen ? '詳細栄養素を見る ▼' : '詳細栄養素を閉じる ▲';
  });

  BP_DETAIL_GROUPS.forEach(group => {
    const groupEl = document.createElement('div');
    groupEl.className = 'bp-detail-group';

    const groupTitle = document.createElement('div');
    groupTitle.className = 'bp-detail-group-title';
    groupTitle.textContent = group.label;
    groupEl.appendChild(groupTitle);

    group.keys.forEach(key => {
      const info = NUTRIENT_INFO[key];
      if (!info) return;

      const row = document.createElement('div');
      row.className = 'bp-detail-row';

      const label = document.createElement('span');
      label.className = 'bp-detail-label';
      label.textContent = info.name;

      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'bp-detail-input';
      input.min = '0';
      input.value = r.nutrients && r.nutrients[key] != null ? r.nutrients[key] : 0;
      input.addEventListener('input', e => {
        if (!r.nutrients) r.nutrients = {};
        r.nutrients[key] = Math.max(0, Number(e.target.value) || 0);
      });

      const unit = document.createElement('span');
      unit.className = 'bp-detail-unit';
      unit.textContent = info.unit;

      row.appendChild(label);
      row.appendChild(input);
      row.appendChild(unit);
      groupEl.appendChild(row);
    });

    body.appendChild(groupEl);
  });

  sec.appendChild(toggle);
  sec.appendChild(body);
  return sec;
}

function buildBpErrorArea(item) {
  const div = document.createElement('div');
  div.className = 'bp-card-error';

  const msg = document.createElement('div');
  msg.className = 'bp-error-msg';
  msg.textContent = _humanizeBpError(item.error);
  div.appendChild(msg);

  if (!isFatalBpError(item.error)) {
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'bp-retry-btn';
    retryBtn.textContent = '再試行';
    retryBtn.addEventListener('click', () => retrySingleBpItem(item));
    div.appendChild(retryBtn);
  }

  return div;
}

function _humanizeBpError(errorCode) {
  if (!errorCode) return '不明なエラーが発生しました';
  if (errorCode === 'CANCELLED') return '中断されました';
  if (errorCode === 'API_KEY_MISSING') return 'APIキーが設定されていません';
  if (errorCode === 'API_KEY_INVALID') return 'APIキーが正しくありません。設定を確認してください';
  if (errorCode.startsWith('RATE_LIMITED')) return 'APIのリクエスト上限に達しました。しばらく待ってから再試行してください';
  if (errorCode.startsWith('API_ERROR_503')) return 'APIサーバーが一時的に利用できません。しばらく待ってから再試行してください';
  if (errorCode.startsWith('BAD_REQUEST')) return '画像の送信に失敗しました。別の写真をお試しください';
  if (errorCode.startsWith('BLOCKED')) return '画像の内容によりブロックされました';
  return 'エラー：' + errorCode;
}

// ============================================================
// 1枚解析
// ============================================================
async function analyzeSingleItem(item) {
  item.status = 'analyzing';
  item.error = null;
  item.result = null;
  updateBpCardStatus(item);

  const base64 = await resizeImage(item.file);
  const result = await analyzePhoto(base64);
  item.result = result;
  item.status = 'done';
  updateBpCardStatus(item);
}

// ============================================================
// メイン解析ループ
// ============================================================
async function startBpAnalysis() {
  if (_bpAnalyzing) return;
  const pendingItems = _bpItems.filter(i => i.status === 'pending');
  if (pendingItems.length === 0) return;

  _bpCancelled = false;
  setBpAnalyzing(true);

  const total = pendingItems.length;
  let completed = 0;
  updateBpProgress(0, total);

  for (let i = 0; i < pendingItems.length; i++) {
    if (_bpCancelled) break;

    const item = pendingItems[i];
    try {
      await analyzeSingleItem(item);
      completed++;
      updateBpProgress(completed, total);
    } catch (err) {
      const errCode = err && err.message ? err.message : String(err);
      item.status = 'error';
      item.error = errCode;
      updateBpCardStatus(item);

      if (_bpCancelled || errCode === 'CANCELLED') break;
      if (isFatalBpError(errCode)) {
        showToast(_humanizeBpError(errCode), 'error');
        break;
      }
    }

    if (i < pendingItems.length - 1 && !_bpCancelled) {
      await sleep(BULK_DELAY_MS);
    }
  }

  setBpAnalyzing(false);
  updateAnalyzeBtnState();

  const allDone = _bpItems.every(i => i.status === 'done' || i.status === 'error');
  if (allDone) {
    const progressEl = document.getElementById('bpProgress');
    if (progressEl) progressEl.style.display = 'none';
  }

  if (_bpCancelled) showToast('解析を中断しました', 'info');
}

// ============================================================
// 個別再試行
// ============================================================
async function retrySingleBpItem(item) {
  if (_bpAnalyzing) return;
  if (item.status !== 'error') return;

  _bpCancelled = false;
  setBpAnalyzing(true);
  updateBpProgress(0, 1);

  try {
    await analyzeSingleItem(item);
    updateBpProgress(1, 1);
  } catch (err) {
    const errCode = err && err.message ? err.message : String(err);
    item.status = 'error';
    item.error = errCode;
    updateBpCardStatus(item);
    if (isFatalBpError(errCode)) showToast(_humanizeBpError(errCode), 'error');
  }

  setBpAnalyzing(false);
  updateAnalyzeBtnState();

  const progressEl = document.getElementById('bpProgress');
  if (progressEl) progressEl.style.display = 'none';
}

// ============================================================
// リセット
// ============================================================
function resetBpState() {
  revokeAllBpUrls();
  _bpItems = [];
  _bpAnalyzing = false;
  _bpCancelled = false;
  renderBpList();
  const progressEl = document.getElementById('bpProgress');
  if (progressEl) progressEl.style.display = 'none';
}
