// ============================================================
// 栄養バランスチェッカー — メインアプリケーション
// ============================================================

// --- Storage ---
function loadMeals() {
  try { return JSON.parse(localStorage.getItem('eiyou_meals')) || []; }
  catch { return []; }
}
function saveMeals(meals) {
  localStorage.setItem('eiyou_meals', JSON.stringify(meals));
}
function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem('eiyou_profile')) ||
      {age:35, sex:'male', activityLevel:'normal', bodyWeight:65};
  } catch {
    return {age:35, sex:'male', activityLevel:'normal', bodyWeight:65};
  }
}
function saveProfile(p) {
  localStorage.setItem('eiyou_profile', JSON.stringify(p));
}

// --- API Key Helpers ---
// sessionStorage（セッション限定）→ localStorage（端末保存）の順で取得
function getApiKey() {
  return sessionStorage.getItem('eiyou_apikey_session') || localStorage.getItem('eiyou_apikey') || '';
}
// mode: 'local'=localStorage, 'session'=sessionStorage
function saveApiKey(key, mode) {
  localStorage.removeItem('eiyou_apikey');
  sessionStorage.removeItem('eiyou_apikey_session');
  if (!key) { localStorage.removeItem('eiyou_apikey_mode'); return; }
  if (mode === 'session') {
    sessionStorage.setItem('eiyou_apikey_session', key);
  } else {
    localStorage.setItem('eiyou_apikey', key);
  }
  localStorage.setItem('eiyou_apikey_mode', mode || 'local');
}
function deleteApiKey() {
  localStorage.removeItem('eiyou_apikey');
  sessionStorage.removeItem('eiyou_apikey_session');
  localStorage.removeItem('eiyou_apikey_mode');
}

// --- CSV Injection 対策 ---
// Excelで数式として解釈されうる先頭文字をエスケープする
function csvSanitize(val) {
  const s = String(val ?? '');
  return /^[=+\-@\t\r\n]/.test(s) ? "'" + s : s;
}

// --- 栄養豆知識（ローディング中に表示） ---
const NUTRITION_TIPS = [
  'ビタミンCは鉄の吸収を高めます。レモンやピーマンと一緒に！',
  'カルシウムの吸収にはビタミンDが必要です。日光浴も大切',
  '食物繊維は腸内環境を整え、血糖値の急上昇を抑えます',
  '亜鉛は味覚に関わるミネラル。牡蠣や牛肉に豊富です',
  'ビタミンB12は植物性食品にはほとんど含まれません',
  '葉酸は妊娠前から摂取が推奨されるビタミンです',
  'タンパク質は体重1kgあたり約0.8〜1.0g/日が目安',
  'ナトリウムの過剰摂取は高血圧のリスクを高めます',
  'マグネシウムは筋肉の弛緩とエネルギー代謝に関与します',
  'ビタミンAは目の健康に重要。にんじんやレバーに豊富',
  'ビタミンEは抗酸化作用があり、細胞膜を保護します',
  'カリウムはナトリウムの排出を促し、血圧調整に役立ちます',
  'ビタミンKは血液凝固と骨の形成に必要なビタミンです',
  '鉄分不足は疲労感や集中力低下の原因になります',
  'ビタミンB1不足は「脚気」の原因。豚肉や玄米に豊富',
  'セレンは甲状腺ホルモンの代謝に関わる微量ミネラルです',
  '必須アミノ酸は体内で合成できない9種のアミノ酸です',
  'パントテン酸はストレス対策のビタミンとも呼ばれます',
  'ビオチンは皮膚や髪の健康維持に重要なビタミンです',
  'リンはカルシウムと結合して骨や歯の主成分になります',
  '銅は鉄の代謝を助け、貧血予防に関与します',
  'ヨウ素は海藻類に多く含まれ、甲状腺機能に必須です',
  'モリブデンは肝臓での解毒反応に関わる酵素の成分です',
  'クロムはインスリンの働きを助け、血糖値の調整に関与します',
  'マンガンは骨の形成と糖質・脂質の代謝に関わります',
  'ナイアシン不足はペラグラ（皮膚炎・下痢・認知症）の原因',
  'ビタミンB6はタンパク質の代謝に必要。鶏肉やバナナに豊富',
  'トリプトファンはセロトニンの原料。睡眠の質にも関わります',
  '日本人の食事摂取基準は5年ごとに改訂されます',
  '1日に必要な水分量は体重1kgあたり約30〜35mL',
];

// --- HTML Escape (XSS対策) ---
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

// --- UI Utilities ---
let _tipTimer = null;
let _tipIndex = 0;

function showLoading(msg) {
  const overlay = document.getElementById('loadingOverlay');
  document.getElementById('loadingText').textContent = msg || '処理中...';
  const tipEl = document.getElementById('loadingTip');
  // ランダム開始 + 4秒ローテーション
  _tipIndex = Math.floor(Math.random() * NUTRITION_TIPS.length);
  if (tipEl) {
    tipEl.textContent = NUTRITION_TIPS[_tipIndex];
    tipEl.classList.remove('fade');
  }
  clearInterval(_tipTimer);
  _tipTimer = setInterval(() => {
    if (!tipEl) return;
    tipEl.classList.add('fade');
    setTimeout(() => {
      _tipIndex = (_tipIndex + 1) % NUTRITION_TIPS.length;
      tipEl.textContent = NUTRITION_TIPS[_tipIndex];
      tipEl.classList.remove('fade');
    }, 300);
  }, 4000);
  overlay.classList.add('show');
}

function hideLoading() {
  document.getElementById('loadingOverlay').classList.remove('show');
  clearInterval(_tipTimer);
  _tipTimer = null;
}
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + (type || 'info');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}
function openModal(id) {
  document.getElementById(id).classList.add('show');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}

// --- Card Toggle ---
document.querySelectorAll('.card-header').forEach(hdr => {
  hdr.addEventListener('click', () => {
    hdr.closest('.card').classList.toggle('collapsed');
  });
});

// --- Tab Switching ---
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    btn.closest('.card-body').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    btn.closest('.card-body').querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
  });
});

// --- Modal Close ---
document.querySelectorAll('.modal-close, [data-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.close || btn.closest('.modal-overlay').id;
    closeModal(id);
  });
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.show').forEach(m => closeModal(m.id));
  }
});

// --- Settings ---
const settingsBtn = document.getElementById('settingsBtn');
const apiKeyInput = document.getElementById('apiKeyInput');
const toggleApiKey = document.getElementById('toggleApiKey');
const saveSettingsBtn = document.getElementById('saveSettings');
const profileAge = document.getElementById('profileAge');
const profileSex = document.getElementById('profileSex');
const profileActivity = document.getElementById('profileActivity');
const profileWeight = document.getElementById('profileWeight');

settingsBtn.addEventListener('click', () => {
  apiKeyInput.value = getApiKey();
  document.getElementById('modelSelect').value = localStorage.getItem('eiyou_model') || 'gemini-2.5-flash';
  const savedMode = localStorage.getItem('eiyou_apikey_mode') || 'local';
  const modeLocal = document.getElementById('modeLocal');
  const modeSession = document.getElementById('modeSession');
  if (modeLocal) modeLocal.checked = savedMode !== 'session';
  if (modeSession) modeSession.checked = savedMode === 'session';
  const p = loadProfile();
  profileAge.value = p.age;
  profileSex.value = p.sex;
  profileActivity.value = p.activityLevel;
  profileWeight.value = p.bodyWeight;
  openModal('settingsModal');
});

document.getElementById('toggleGuide').addEventListener('click', () => {
  const guide = document.getElementById('apiGuide');
  const btn = document.getElementById('toggleGuide');
  const show = guide.style.display === 'none';
  guide.style.display = show ? '' : 'none';
  btn.textContent = show ? 'ガイドを閉じる' : 'APIキーの取得方法を見る';
});

toggleApiKey.addEventListener('click', () => {
  const isPass = apiKeyInput.type === 'password';
  apiKeyInput.type = isPass ? 'text' : 'password';
  toggleApiKey.textContent = isPass ? '非表示' : '表示';
});

saveSettingsBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  const modeSession = document.getElementById('modeSession');
  const mode = modeSession?.checked ? 'session' : 'local';
  saveApiKey(key, mode);

  localStorage.setItem('eiyou_model', document.getElementById('modelSelect').value);

  saveProfile({
    age: Number(profileAge.value) || 35,
    sex: profileSex.value,
    activityLevel: profileActivity.value,
    bodyWeight: Number(profileWeight.value) || 65
  });
  closeModal('settingsModal');
  showToast('設定を保存しました', 'success');
  renderAll();
});

// --- Autocomplete ---
const foodInput = document.getElementById('foodInput');
const foodAC = document.getElementById('foodAC');
let acIndex = -1;

foodInput.addEventListener('input', () => {
  const q = foodInput.value.trim().toLowerCase();
  foodAC.innerHTML = '';
  acIndex = -1;
  if (!q) { foodAC.classList.remove('show'); return; }
  const matches = FOOD_LIST.filter(f => f.toLowerCase().includes(q)).slice(0, 10);
  if (matches.length === 0) { foodAC.classList.remove('show'); return; }
  matches.forEach(f => {
    const div = document.createElement('div');
    div.className = 'autocomplete-item';
    div.textContent = f;
    div.addEventListener('click', () => {
      foodInput.value = f;
      foodAC.classList.remove('show');
    });
    foodAC.appendChild(div);
  });
  foodAC.classList.add('show');
});

foodInput.addEventListener('keydown', e => {
  const items = foodAC.querySelectorAll('.autocomplete-item');
  if (!items.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    acIndex = Math.min(acIndex + 1, items.length - 1);
    items.forEach((it, i) => it.classList.toggle('selected', i === acIndex));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    acIndex = Math.max(acIndex - 1, 0);
    items.forEach((it, i) => it.classList.toggle('selected', i === acIndex));
  } else if (e.key === 'Enter' && acIndex >= 0) {
    e.preventDefault();
    foodInput.value = items[acIndex].textContent;
    foodAC.classList.remove('show');
  }
});

document.addEventListener('click', e => {
  if (!e.target.closest('.autocomplete-wrap')) foodAC.classList.remove('show');
});

// --- Food Item List ---
let foodItems = [];
const foodList = document.getElementById('foodList');
const addFoodBtn = document.getElementById('addFoodBtn');
const formAnalyzeBtn = document.getElementById('formAnalyzeBtn');

addFoodBtn.addEventListener('click', addFood);
foodInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && acIndex < 0) { e.preventDefault(); addFood(); }
});

function addFood() {
  const name = foodInput.value.trim();
  if (!name) return;
  const qty = document.getElementById('foodQty').value;
  const grams = Number(document.getElementById('foodGrams').value) || null;
  foodItems.push({name, quantity: qty, grams});
  foodInput.value = '';
  document.getElementById('foodGrams').value = '';
  renderFoodList();
}

function renderFoodList() {
  foodList.innerHTML = '';
  // TODO Phase 1b-2: インラインイベントハンドラを addEventListener に置き換える
  foodItems.forEach((item, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="name">${esc(item.name)}</span>
      <select onchange="foodItems[${i}].quantity=this.value">
        <option${item.quantity==='少なめ'?' selected':''}>少なめ</option>
        <option${item.quantity==='普通'?' selected':''}>普通</option>
        <option${item.quantity==='多め'?' selected':''}>多め</option>
      </select>
      <button class="remove" onclick="foodItems.splice(${i},1);renderFoodList()">×</button>
    `;
    foodList.appendChild(li);
  });
  formAnalyzeBtn.disabled = foodItems.length === 0;
}

// --- Form Analyze ---
formAnalyzeBtn.addEventListener('click', async () => {
  if (!checkApiKey()) return;
  showLoading('食事を解析中...');
  try {
    const nutrients = await analyzeFormItems(foodItems);
    hideLoading();
    showConfirmModal({
      date: document.getElementById('formDate').value,
      mealType: document.getElementById('formMeal').value,
      inputMethod: 'form',
      items: [...foodItems],
      nutrients
    });
  } catch (err) {
    hideLoading();
    handleApiError(err);
  }
});

// --- Photo Input ---
const photoFile = document.getElementById('photoFile');
const photoPreview = document.getElementById('photoPreview');
const photoAnalyzeBtn = document.getElementById('photoAnalyzeBtn');

photoFile.addEventListener('change', () => {
  const file = photoFile.files[0];
  if (photoPreview.src && photoPreview.src.startsWith('blob:')) URL.revokeObjectURL(photoPreview.src);
  if (!file) { photoPreview.classList.remove('show'); photoAnalyzeBtn.disabled = true; return; }
  photoPreview.src = URL.createObjectURL(file);
  photoPreview.classList.add('show');
  photoAnalyzeBtn.disabled = false;
});

photoAnalyzeBtn.addEventListener('click', async () => {
  if (!checkApiKey()) return;
  const file = photoFile.files[0];
  if (!file) return;
  showLoading('写真を解析中...');
  try {
    const base64 = await resizeImage(file);
    const result = await analyzePhoto(base64);
    hideLoading();
    showConfirmModal({
      date: document.getElementById('photoDate').value,
      mealType: document.getElementById('photoMeal').value,
      inputMethod: 'photo',
      items: result.items,
      nutrients: result.nutrients
    });
  } catch (err) {
    hideLoading();
    handleApiError(err);
  }
});

// --- Text Input ---
const textInput = document.getElementById('textInput');
const textAnalyzeBtn = document.getElementById('textAnalyzeBtn');

textAnalyzeBtn.addEventListener('click', async () => {
  const text = textInput.value.trim();
  if (!text) { showToast('テキストを入力してください', 'error'); return; }
  if (!checkApiKey()) return;
  showLoading('テキストを解析中...');
  try {
    const result = await analyzeText(text);
    hideLoading();
    showConfirmModal({
      date: result.date,
      mealType: result.mealType,
      inputMethod: 'text',
      items: result.items,
      nutrients: result.nutrients
    });
  } catch (err) {
    hideLoading();
    handleApiError(err);
  }
});

// --- API Key Check ---
function checkApiKey() {
  if (!getApiKey()) {
    openModal('apiKeyModal');
    return false;
  }
  return true;
}

document.getElementById('apiKeySetupBtn').addEventListener('click', () => {
  closeModal('apiKeyModal');
  // ガイドを展開した状態で設定を開く
  const guide = document.getElementById('apiGuide');
  const btn = document.getElementById('toggleGuide');
  guide.style.display = '';
  btn.textContent = 'ガイドを閉じる';
  apiKeyInput.value = getApiKey();
  document.getElementById('modelSelect').value = localStorage.getItem('eiyou_model') || 'gemini-2.5-flash';
  const savedMode = localStorage.getItem('eiyou_apikey_mode') || 'local';
  const modeLocal = document.getElementById('modeLocal');
  const modeSession = document.getElementById('modeSession');
  if (modeLocal) modeLocal.checked = savedMode !== 'session';
  if (modeSession) modeSession.checked = savedMode === 'session';
  const p = loadProfile();
  profileAge.value = p.age;
  profileSex.value = p.sex;
  profileActivity.value = p.activityLevel;
  profileWeight.value = p.bodyWeight;
  openModal('settingsModal');
});

function handleApiError(err) {
  const msg = err.message || '';
  console.error('API Error:', msg, err);
  if (msg === 'CANCELLED') {
    showToast('キャンセルしました', 'info');
  } else if (msg === 'API_KEY_MISSING') {
    showToast('APIキーが未設定です', 'error');
    openModal('settingsModal');
  } else if (msg === 'API_KEY_INVALID') {
    showToast('APIキーが無効です。設定を確認してください', 'error');
  } else if (msg.startsWith('RATE_LIMITED:')) {
    showToast('レート制限: ' + msg.replace('RATE_LIMITED:', ''), 'error');
  } else if (msg.startsWith('BAD_REQUEST:')) {
    showToast('リクエストエラー: ' + msg.replace('BAD_REQUEST:', ''), 'error');
  } else if (msg.startsWith('BLOCKED:')) {
    showToast('安全フィルタでブロックされました', 'error');
  } else {
    showToast('解析エラー: ' + msg, 'error');
  }
}

// --- Confirm Modal ---
let pendingMealData = null;

function showConfirmModal(data) {
  pendingMealData = data;
  const body = document.getElementById('confirmBody');

  // Items list
  const itemsHtml = data.items.map(it =>
    `<span style="display:inline-block;background:#f0f0f0;padding:2px 8px;border-radius:4px;margin:2px;font-size:12px">${esc(it.name)} ${esc(it.quantity || '')} ${it.grams ? esc(it.grams)+'g' : ''}</span>`
  ).join('');

  // Editable nutrient table
  const groupedKeys = {};
  NUTRIENT_KEYS.forEach(k => {
    const info = NUTRIENT_INFO[k];
    if (!groupedKeys[info.group]) groupedKeys[info.group] = [];
    groupedKeys[info.group].push(k);
  });

  let tableHtml = '<table class="nutrient-edit-table"><thead><tr><th>栄養素</th><th>推定値</th><th>単位</th></tr></thead><tbody>';
  for (const group of NUTRIENT_GROUPS) {
    const keys = groupedKeys[group] || [];
    const color = GROUP_COLORS[group] || '#666';
    tableHtml += `<tr><td colspan="3"><span class="nutrient-edit-group" style="background:${color}">${group}</span></td></tr>`;
    for (const k of keys) {
      const info = NUTRIENT_INFO[k];
      const val = data.nutrients[k] || 0;
      // マクロとビタミン・ミネラル主要のみ編集表示、アミノ酸は折りたたみ
      tableHtml += `<tr>
        <td>${info.name}</td>
        <td><input type="number" data-key="${k}" value="${Math.round(val * 10) / 10}" step="any" min="0"></td>
        <td style="color:#999;font-size:11px">${info.unit}</td>
      </tr>`;
    }
  }
  tableHtml += '</tbody></table>';

  body.innerHTML = `
    <div style="margin-bottom:12px">
      <div style="font-size:12px;color:#888;margin-bottom:4px">食品</div>
      <div>${itemsHtml || '<span style="color:#ccc">食品情報なし</span>'}</div>
    </div>
    <div style="font-size:12px;color:#888;margin-bottom:4px">栄養素（値を修正できます）</div>
    <div style="max-height:400px;overflow-y:auto">${tableHtml}</div>
  `;
  openModal('confirmModal');
}

document.getElementById('confirmSave').addEventListener('click', () => {
  if (!pendingMealData) return;

  // Collect edited values
  const inputs = document.querySelectorAll('#confirmBody input[data-key]');
  inputs.forEach(inp => {
    pendingMealData.nutrients[inp.dataset.key] = Number(inp.value) || 0;
  });

  // Build meal record
  const meal = {
    id: crypto.randomUUID(),
    date: pendingMealData.date || new Date().toISOString().split('T')[0],
    mealType: pendingMealData.mealType || 'lunch',
    inputMethod: pendingMealData.inputMethod || 'form',
    items: pendingMealData.items,
    nutrients: pendingMealData.nutrients,
    isDemo: false,
    createdAt: new Date().toISOString()
  };

  const meals = loadMeals();
  meals.push(meal);
  saveMeals(meals);

  closeModal('confirmModal');
  pendingMealData = null;

  // Reset form
  foodItems = [];
  renderFoodList();
  foodInput.value = '';
  textInput.value = '';
  photoFile.value = '';
  photoPreview.classList.remove('show');

  showToast('食事を記録しました', 'success');
  renderAll();
});

// ============================================================
// DASHBOARD
// ============================================================
let currentPeriod = 'today';
let customStart = '';
let customEnd = '';

document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPeriod = btn.dataset.period;
    document.getElementById('customPeriod').classList.toggle('show', currentPeriod === 'custom');
    if (currentPeriod !== 'custom') renderAll();
  });
});

document.getElementById('applyPeriod').addEventListener('click', () => {
  customStart = document.getElementById('periodStart').value;
  customEnd = document.getElementById('periodEnd').value;
  if (customStart && customEnd) renderAll();
});

function getPeriodDates() {
  const today = new Date().toISOString().split('T')[0];
  if (currentPeriod === 'today') return {start: today, end: today, label: '今日'};
  if (currentPeriod === '7days') {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return {start: d.toISOString().split('T')[0], end: today, label: '過去7日'};
  }
  return {start: customStart || today, end: customEnd || today, label: `${customStart}〜${customEnd}`};
}

function getMealsForPeriod() {
  const {start, end} = getPeriodDates();
  return loadMeals().filter(m => m.date >= start && m.date <= end);
}

function aggregateNutrients(meals) {
  const totals = {};
  NUTRIENT_KEYS.forEach(k => totals[k] = 0);
  meals.forEach(m => {
    NUTRIENT_KEYS.forEach(k => {
      totals[k] += (m.nutrients?.[k] || 0);
    });
  });
  return totals;
}

function renderDashboard() {
  const meals = getMealsForPeriod();
  const {label} = getPeriodDates();
  document.getElementById('dashPeriodBadge').textContent = label;

  const content = document.getElementById('dashboardContent');

  if (loadMeals().length === 0) {
    content.innerHTML = '<div class="empty-state">食事を記録するとここに栄養バランスが表示されます</div>';
    document.getElementById('alertCard').style.display = 'none';
    document.getElementById('suggestCard').style.display = 'none';
    return;
  }

  if (meals.length === 0) {
    content.innerHTML = '<div class="empty-state">この期間の食事データがありません</div>';
    document.getElementById('alertCard').style.display = 'none';
    document.getElementById('suggestCard').style.display = 'none';
    return;
  }

  // Calculate unique days and daily average
  const days = [...new Set(meals.map(m => m.date))];
  const numDays = days.length || 1;
  const totals = aggregateNutrients(meals);
  const daily = {};
  NUTRIENT_KEYS.forEach(k => daily[k] = totals[k] / numDays);

  const profile = loadProfile();
  const rda = calcRDA(profile);

  // Build bar chart HTML
  let html = '';
  const groupedKeys = {};
  NUTRIENT_KEYS.forEach(k => {
    const group = NUTRIENT_INFO[k].group;
    if (!groupedKeys[group]) groupedKeys[group] = [];
    groupedKeys[group].push(k);
  });

  for (const group of NUTRIENT_GROUPS) {
    const keys = groupedKeys[group] || [];
    const color = GROUP_COLORS[group] || '#666';
    html += `<div class="bar-group">
      <div class="bar-group-title" style="background:${color}">${group}</div>`;

    for (const k of keys) {
      const info = NUTRIENT_INFO[k];
      const val = daily[k];
      const rdaVal = rda[k];
      if (!rdaVal) continue;
      const pct = Math.round((val / rdaVal) * 100);
      const barColor = k === 'na'
        ? (pct > 150 ? '#e74c3c' : pct > 120 ? '#e67e22' : '#27ae60')
        : getBarColor(pct);
      const barWidth = Math.min(pct, 200);
      const displayVal = val >= 100 ? Math.round(val) : Math.round(val * 10) / 10;

      html += `<div class="bar-row">
        <span class="bar-label">${info.name}</span>
        <div class="bar-track" style="--max-pct:200">
          <div class="bar-fill" style="width:${barWidth / 2}%;background:${barColor}"></div>
        </div>
        <span class="bar-value"><span class="bar-pct" style="color:${barColor}">${pct}%</span> <span style="font-size:10px">${displayVal}</span></span>
      </div>`;
    }
    html += '</div>';
  }

  if (numDays > 1) {
    html = `<div style="font-size:12px;color:#888;margin-bottom:12px">${numDays}日間の1日平均値</div>` + html;
  }

  content.innerHTML = html;

  // Render alerts
  renderAlerts(daily, rda);
}

// ============================================================
// ALERTS
// ============================================================
function renderAlerts(daily, rda) {
  const alertCard = document.getElementById('alertCard');
  const alertContent = document.getElementById('alertContent');
  const alertCount = document.getElementById('alertCount');

  const alerts = [];

  NUTRIENT_KEYS.forEach(k => {
    const info = NUTRIENT_INFO[k];
    const rdaVal = rda[k];
    if (!rdaVal) return;
    const pct = Math.round((daily[k] / rdaVal) * 100);

    if (k === 'na') {
      // ナトリウムは過剰警告
      if (pct > 150) {
        alerts.push({key:k, pct, type:'excess',
          icon: pct > 200 ? '🔴' : '🟠',
          title: `${info.name} ${pct}%`,
          desc: info.excess || '過剰摂取に注意'
        });
      }
    } else if (pct < 80 && info.deficiency) {
      alerts.push({key:k, pct, type: pct < 50 ? 'danger' : 'warning',
        icon: pct < 50 ? '🔴' : '🟡',
        title: `${info.name} ${pct}%`,
        desc: info.deficiency
      });
    }
  });

  if (alerts.length === 0) {
    alertCard.style.display = 'none';
    return;
  }

  alertCard.style.display = '';
  alertCount.textContent = alerts.length;

  alertContent.innerHTML = alerts.map(a => {
    const tags = a.desc.split('、').map(t => `<span class="alert-tag">${t}</span>`).join('');
    return `<div class="alert-item ${a.type}">
      <span class="alert-icon">${a.icon}</span>
      <div class="alert-body">
        <div class="alert-title">${a.title}</div>
        <div class="alert-tags">${tags}</div>
      </div>
    </div>`;
  }).join('');

  // Show suggestion card
  document.getElementById('suggestCard').style.display = '';
  // Store for suggestion use
  window._lastAlerts = {daily, rda, alerts};
}

// ============================================================
// AI SUGGESTIONS
// ============================================================
const suggestBtn = document.getElementById('suggestBtn');
const suggestContent = document.getElementById('suggestContent');

suggestBtn.addEventListener('click', async () => {
  if (!checkApiKey()) return;
  const data = window._lastAlerts;
  if (!data || !data.alerts.length) {
    showToast('参考表示する栄養素がありません', 'info');
    return;
  }

  const days = Number(document.getElementById('suggestDays').value) || 3;
  const deficiencies = data.alerts.filter(a => a.type !== 'excess').map(a => ({
    key: a.key, pct: a.pct, rda: data.rda[a.key]
  }));
  const excesses = data.alerts.filter(a => a.type === 'excess').map(a => ({
    key: a.key, pct: a.pct, rda: data.rda[a.key]
  }));

  showLoading('献立を考え中...');
  try {
    const result = await suggestMeals(deficiencies, excesses, days);
    hideLoading();

    if (!result.days || !result.days.length) {
      suggestContent.innerHTML = '<div class="empty-state">提案を生成できませんでした</div>';
      return;
    }

    suggestContent.innerHTML = result.days.map(day => {
      const mealLabels = [
        {key:'breakfast', icon:'🌅', label:'朝食'},
        {key:'lunch', icon:'☀️', label:'昼食'},
        {key:'dinner', icon:'🌙', label:'夕食'}
      ];
      const mealsHtml = mealLabels.map(ml => {
        const meal = day[ml.key];
        if (!meal) return '';
        // 新構造(dishes配列)と旧構造(文字列)の両方に対応
        if (typeof meal === 'string') {
          return `<div class="sg-meal"><div class="sg-meal-header">${ml.icon} ${ml.label}</div><div class="sg-dish"><span class="sg-dish-name">${esc(meal)}</span></div></div>`;
        }
        const dishes = (meal.dishes || []).map(d => {
          const cat = d.category ? `<span class="sg-cat">${esc(d.category)}</span>` : '';
          const tip = d.tip ? `<div class="sg-tip">${esc(d.tip)}</div>` : '';
          return `<div class="sg-dish">${cat}<span class="sg-dish-name">${esc(d.name)}</span><span class="sg-amount">${esc(d.amount || '')}</span>${tip}</div>`;
        }).join('');
        return `<div class="sg-meal"><div class="sg-meal-header">${ml.icon} ${ml.label}</div>${dishes}</div>`;
      }).join('');
      const point = day.point ? `<div class="sg-point">${esc(day.point)}</div>` : '';
      // day.day はGemini出力のため esc() でエスケープ
      return `<div class="sg-day"><div class="sg-day-title">${esc(String(day.day ?? ''))}日目</div>${mealsHtml}${point}</div>`;
    }).join('');
  } catch (err) {
    hideLoading();
    handleApiError(err);
  }
});

// ============================================================
// HISTORY
// ============================================================
function renderHistory() {
  const meals = loadMeals().sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    const order = {breakfast:0, lunch:1, dinner:2, snack:3};
    return (order[a.mealType]||0) - (order[b.mealType]||0);
  });

  const content = document.getElementById('historyContent');
  const actions = document.getElementById('historyActions');
  const count = document.getElementById('historyCount');
  const clearDemoBtn = document.getElementById('clearDemoBtn');

  count.textContent = meals.length;

  if (meals.length === 0) {
    content.innerHTML = '<div class="history-empty">記録がありません</div>';
    actions.style.display = 'none';
    return;
  }

  actions.style.display = 'flex';
  const hasDemo = meals.some(m => m.isDemo);
  clearDemoBtn.style.display = hasDemo ? '' : 'none';

  content.innerHTML = meals.map(m => {
    const mt = MEAL_TYPES[m.mealType] || {label:'?', icon:'🍽️'};
    const foods = (m.items || []).map(i => esc(i.name)).join(', ') || '(詳細なし)';
    const cal = Math.round(m.nutrients?.calories || 0);
    const demo = m.isDemo ? '<span class="history-demo">DEMO</span>' : '';
    // m.date は localStorage 由来のため esc() でエスケープ
    return `<div class="history-item">
      <span class="history-date">${esc(m.date)}</span>
      <span class="history-type" title="${esc(mt.label)}">${mt.icon}</span>
      <span class="history-foods">${foods}${demo}</span>
      <span class="history-cal">${cal}kcal</span>
      <button class="history-del" data-id="${esc(m.id)}" title="削除">×</button>
    </div>`;
  }).join('');

  // Delete handlers
  content.querySelectorAll('.history-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const updated = loadMeals().filter(m => m.id !== id);
      saveMeals(updated);
      showToast('削除しました', 'info');
      renderAll();
    });
  });
}

// --- CSV Export ---
document.getElementById('csvBtn').addEventListener('click', () => {
  const meals = loadMeals();
  if (meals.length === 0) { showToast('データがありません', 'info'); return; }

  const headers = ['日付', '食事区分', '食品', 'カロリー(kcal)'];
  const nutrientCols = NUTRIENT_KEYS.filter(k => k !== 'calories');
  nutrientCols.forEach(k => headers.push(`${NUTRIENT_INFO[k].name}(${NUTRIENT_INFO[k].unit})`));

  const rows = [headers.join(',')];
  meals.sort((a, b) => a.date.localeCompare(b.date)).forEach(m => {
    const mt = MEAL_TYPES[m.mealType]?.label || m.mealType;
    // CSVインジェクション対策: 各フィールドを csvSanitize() に通す
    const foods = (m.items || []).map(i => csvSanitize(i.name)).join('/');
    const csvFoods = '"' + foods.replace(/"/g, '""') + '"';
    const vals = [csvSanitize(m.date), csvSanitize(mt), csvFoods, Math.round(m.nutrients?.calories || 0)];
    nutrientCols.forEach(k => vals.push(Math.round((m.nutrients?.[k] || 0) * 10) / 10));
    rows.push(vals.join(','));
  });

  const bom = '\uFEFF';
  const blob = new Blob([bom + rows.join('\n')], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nutrition_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSVをダウンロードしました', 'success');
});

// --- Demo Data ---
function onLoadDemo() {
  loadDemoData();
  showToast('サンプルデータを読み込みました', 'success');
  renderAll();
}

document.getElementById('loadDemoBtn')?.addEventListener('click', onLoadDemo);

document.getElementById('clearDemoBtn').addEventListener('click', () => {
  clearDemoData();
  showToast('デモデータを削除しました', 'info');
  renderAll();
});

document.getElementById('resetAllBtn').addEventListener('click', () => {
  if (!confirm('全ての食事データを削除します。よろしいですか？')) return;
  saveMeals([]);
  showToast('全データをリセットしました', 'info');
  renderAll();
});

document.getElementById('factoryResetBtn').addEventListener('click', () => {
  if (!confirm('全データ・設定・APIキーを含め初期状態に戻します。よろしいですか？')) return;
  localStorage.removeItem('eiyou_meals');
  localStorage.removeItem('eiyou_profile');
  localStorage.removeItem('eiyou_model');
  deleteApiKey(); // localStorageとsessionStorageの両方をクリア
  showToast('初期状態に戻しました', 'info');
  renderAll();
});

// --- APIキー削除 ---
document.getElementById('deleteApiKeyBtn').addEventListener('click', () => {
  if (!confirm('Gemini APIキーをこの端末・このセッションから削除します。よろしいですか？')) return;
  deleteApiKey();
  document.getElementById('apiKeyInput').value = '';
  showToast('APIキーを削除しました', 'info');
});

// --- プロフィール削除 ---
document.getElementById('deleteProfileBtn').addEventListener('click', () => {
  if (!confirm('プロフィール情報（年齢・性別・活動量・体重）を削除します。よろしいですか？')) return;
  localStorage.removeItem('eiyou_profile');
  const defaults = {age:35, sex:'male', activityLevel:'normal', bodyWeight:65};
  document.getElementById('profileAge').value = defaults.age;
  document.getElementById('profileSex').value = defaults.sex;
  document.getElementById('profileActivity').value = defaults.activityLevel;
  document.getElementById('profileWeight').value = defaults.bodyWeight;
  showToast('プロフィール情報を削除しました', 'info');
});

// ============================================================
// RENDER ALL
// ============================================================
function renderAll() {
  // デモバナー: データなし時のみ表示
  const banner = document.getElementById('demoBanner');
  if (banner) banner.style.display = loadMeals().length === 0 ? '' : 'none';
  renderDashboard();
  renderHistory();
}

// ============================================================
// INIT
// ============================================================
(function init() {
  // Cancel button
  document.getElementById('loadingCancel').addEventListener('click', () => {
    cancelGemini();
    hideLoading();
  });

  // About modal button
  document.getElementById('aboutBtn').addEventListener('click', () => {
    openModal('aboutModal');
  });

  // 初回訪問時に注意事項モーダルを表示
  // TODO Phase 1b: sessionStorage / 保存しない選択肢を検討
  if (!localStorage.getItem('eiyou_notice_v1')) {
    openModal('aboutModal');
    localStorage.setItem('eiyou_notice_v1', '1');
  }

  // Set default dates
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('formDate').value = today;
  document.getElementById('photoDate').value = today;
  const d7 = new Date();
  d7.setDate(d7.getDate() - 6);
  document.getElementById('periodStart').value = d7.toISOString().split('T')[0];
  document.getElementById('periodEnd').value = today;

  initBulk();
  renderAll();
})();
