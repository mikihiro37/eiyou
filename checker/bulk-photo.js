// ============================================================
// まとめて写真解析 — 複数写真プレビューUI + 逐次Gemini解析
// Phase 2b Step 1-5
// ============================================================

const MAX_BULK_PHOTOS = 5;
const BULK_DELAY_MS = 1500;

let _bpItems = [];
let _bpAnalyzing = false;
let _bpCancelled = false;

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
  if (cancelBtn) {
    cancelBtn.style.display = analyzing ? '' : 'none';
  }
  if (fileInput) {
    fileInput.disabled = analyzing;
  }

  // カードの削除ボタン・入力欄を無効化
  document.querySelectorAll('.bp-card-remove').forEach(btn => {
    btn.disabled = analyzing;
  });
  document.querySelectorAll('.bp-card-fields input, .bp-card-fields select').forEach(el => {
    el.disabled = analyzing;
  });
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
  if (fillEl) fillEl.style.width = pct + '%';
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

  // 既存の結果・エラーエリアを削除
  const existing = card.querySelector('.bp-card-result, .bp-card-error');
  if (existing) existing.remove();

  if (item.status === 'done' && item.result) {
    card.querySelector('.bp-card-fields').appendChild(buildBpResultSummary(item));
  } else if (item.status === 'error' && item.error) {
    card.querySelector('.bp-card-fields').appendChild(buildBpErrorArea(item));
  }
}

function buildBpResultSummary(item) {
  const r = item.result;
  const div = document.createElement('div');
  div.className = 'bp-card-result';

  const conf = (r.confidence || '').toLowerCase();
  const confBadge = document.createElement('span');
  confBadge.className = 'bp-conf-badge ' + (conf === 'high' ? 'conf-high' : conf === 'medium' ? 'conf-mid' : 'conf-low');
  const confLabels = { high: '信頼度：高', medium: '信頼度：中', low: '信頼度：低' };
  confBadge.textContent = confLabels[conf] || '信頼度：不明';
  div.appendChild(confBadge);

  const cal = r.nutrients && r.nutrients.calories != null ? r.nutrients.calories : null;
  if (cal !== null) {
    const calEl = document.createElement('div');
    calEl.className = 'bp-result-calories';
    calEl.textContent = '推定エネルギー：約 ' + Math.round(cal) + ' kcal';
    div.appendChild(calEl);
  }

  const foods = Array.isArray(r.estimatedFoods) ? r.estimatedFoods : [];
  if (foods.length > 0) {
    const foodsEl = document.createElement('div');
    foodsEl.className = 'bp-result-foods';
    const show = foods.slice(0, 3);
    show.forEach(food => {
      const tag = document.createElement('span');
      tag.className = 'bp-result-food-tag';
      tag.textContent = food;
      foodsEl.appendChild(tag);
    });
    if (foods.length > 3) {
      const more = document.createElement('span');
      more.className = 'bp-result-food-more';
      more.textContent = '他' + (foods.length - 3) + '品';
      foodsEl.appendChild(more);
    }
    div.appendChild(foodsEl);
  }

  return div;
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

      if (_bpCancelled || errCode === 'CANCELLED') {
        break;
      }
      if (isFatalBpError(errCode)) {
        showToast(_humanizeBpError(errCode), 'error');
        break;
      }
      // 個別エラーはそのまま次へ
    }

    if (i < pendingItems.length - 1 && !_bpCancelled) {
      await sleep(BULK_DELAY_MS);
    }
  }

  setBpAnalyzing(false);
  updateAnalyzeBtnState();

  // プログレスバーを最終状態のまま残す（完了時のみ非表示）
  const allDone = _bpItems.every(i => i.status === 'done' || i.status === 'error');
  if (allDone) {
    const progressEl = document.getElementById('bpProgress');
    if (progressEl) progressEl.style.display = 'none';
  }

  if (_bpCancelled) {
    showToast('解析を中断しました', 'info');
  }
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
    if (isFatalBpError(errCode)) {
      showToast(_humanizeBpError(errCode), 'error');
    }
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
