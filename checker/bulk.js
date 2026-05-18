// ============================================================
// まとめて食事テキスト解析 — レポート + 解釈選択UI
// ============================================================

let _bulkResult = null;
let _bulkSelections = {};
let _bulkProfile = null;

// --- 初期化 ---
function initBulk() {
  const profile = loadProfile();
  document.getElementById('bulkAge').value = profile.age;
  document.getElementById('bulkSex').value = profile.sex;
  document.getElementById('bulkWeight').value = profile.bodyWeight;
  document.getElementById('bulkActivity').value = profile.activityLevel;

  document.getElementById('bulkAnalyzeBtn').addEventListener('click', handleBulkAnalyze);
  document.getElementById('bulkReportSave').addEventListener('click', handleBulkSave);
}

// --- メインフロー ---
async function handleBulkAnalyze() {
  const text = document.getElementById('textInput').value.trim();
  if (!text) { showToast('テキストを入力してください', 'error'); return; }
  if (!checkApiKey()) return;

  _bulkProfile = {
    age: Number(document.getElementById('bulkAge').value) || 35,
    sex: document.getElementById('bulkSex').value,
    bodyWeight: Number(document.getElementById('bulkWeight').value) || 65,
    activityLevel: document.getElementById('bulkActivity').value
  };

  showLoading('食事を解析中...');
  try {
    _bulkResult = await analyzeBulkText(text);
    hideLoading();
    initSelections();
    renderReport();
    openModal('bulkReportModal');
  } catch (err) {
    hideLoading();
    handleApiError(err);
  }
}

// --- 選択状態の初期化 ---
function initSelections() {
  _bulkSelections = {};
  if (!_bulkResult?.days) return;
  _bulkResult.days.forEach((day, di) => {
    (day.meals || []).forEach((meal, mi) => {
      if (meal.skipped) return;
      (meal.items || []).forEach((_, ii) => {
        _bulkSelections[`${di}-${mi}-${ii}`] = 0;
      });
    });
  });
}

// --- 現在の選択に基づく1日平均栄養素 ---
function calcBulkDaily() {
  const totals = {};
  NUTRIENT_KEYS.forEach(k => totals[k] = 0);
  if (!_bulkResult?.days) return totals;

  _bulkResult.days.forEach((day, di) => {
    (day.meals || []).forEach((meal, mi) => {
      if (meal.skipped) return;
      (meal.items || []).forEach((item, ii) => {
        const sel = _bulkSelections[`${di}-${mi}-${ii}`] || 0;
        const interp = item.interpretations?.[sel];
        if (interp?.nutrients) {
          NUTRIENT_KEYS.forEach(k => { totals[k] += (interp.nutrients[k] || 0); });
        }
      });
    });
  });

  const numDays = _bulkResult.days.length || 1;
  const daily = {};
  NUTRIENT_KEYS.forEach(k => daily[k] = totals[k] / numDays);
  return daily;
}

// --- レポート全体の描画 ---
function renderReport() {
  const rda = calcRDA(_bulkProfile);
  const daily = calcBulkDaily();
  const numDays = _bulkResult?.days?.length || 1;

  renderProfileSummary(numDays);
  renderBulkMeta();
  renderBarChart(daily, rda, numDays);
  renderAlertSection(daily, rda);
  renderMealBreakdown();
}

// --- プロフィールサマリー ---
function renderProfileSummary(numDays) {
  const p = _bulkProfile;
  const sexLabel = p.sex === 'male' ? '男性' : '女性';
  const actLabel = {low:'低い', normal:'普通', high:'高い'}[p.activityLevel] || '普通';
  const dateRange = _bulkResult.days.map(d => esc(d.date)).join('、');
  document.getElementById('bulkProfileSummary').innerHTML =
    `<div class="bulk-profile-badge">${dateRange} | ${esc(String(p.age))}歳 ${esc(sexLabel)} ${esc(String(p.bodyWeight))}kg 活動量:${esc(actLabel)}` +
    (numDays > 1 ? ` | ${numDays}日間の1日平均` : '') + '</div>';
}

// --- 解析メタ情報（仮定・信頼度・注意事項） ---
function renderBulkMeta() {
  const container = document.getElementById('bulkMetaSection');
  if (!container || !_bulkResult) return;

  const conf = _bulkResult.overallConfidence || '中';
  const confClass = {'低':'conf-low','中':'conf-mid','高':'conf-high'}[conf] || 'conf-mid';

  const assumptions    = _bulkResult.overallAssumptions    || [];
  const uncertainItems = _bulkResult.overallUncertainItems || [];
  const warnings       = _bulkResult.warnings              || [];

  let html = `<div class="confirm-meta-section" style="margin-bottom:10px">
    <div class="confirm-meta-row">
      <span class="confirm-meta-label">推定精度</span>
      <span class="confidence-badge ${confClass}">${esc(conf)}</span>
      <span class="confirm-meta-note">AIによる概算です</span>
    </div>`;

  if (assumptions.length > 0) {
    html += `<div class="confirm-meta-sub">仮定した内容</div>
      <ul class="confirm-meta-list">${assumptions.map(a => `<li>${esc(a)}</li>`).join('')}</ul>`;
  }
  if (uncertainItems.length > 0) {
    html += `<div class="confirm-meta-sub">不確実な項目</div>
      <ul class="confirm-meta-list uncertain">${uncertainItems.map(u => `<li>${esc(u)}</li>`).join('')}</ul>`;
  }
  if (warnings.length > 0) {
    html += warnings.map(w => `<div class="confirm-warning-item">${esc(w)}</div>`).join('');
  }
  html += '</div>';
  container.innerHTML = html;
}

// --- バーチャート ---
function renderBarChart(daily, rda, numDays) {
  const container = document.getElementById('bulkBarChart');
  const groupedKeys = {};
  NUTRIENT_KEYS.forEach(k => {
    const g = NUTRIENT_INFO[k].group;
    if (!groupedKeys[g]) groupedKeys[g] = [];
    groupedKeys[g].push(k);
  });

  let html = '';
  for (const group of NUTRIENT_GROUPS) {
    const keys = groupedKeys[group] || [];
    const color = GROUP_COLORS[group] || '#666';
    html += `<div class="bar-group"><div class="bar-group-title" style="background:${color}">${group}</div>`;
    for (const k of keys) {
      const info = NUTRIENT_INFO[k];
      const rdaVal = rda[k];
      if (!rdaVal) continue;
      const val = daily[k];
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
  container.innerHTML = html;
}

// --- アラート ---
function renderAlertSection(daily, rda) {
  const container = document.getElementById('bulkAlerts');
  const alerts = [];

  NUTRIENT_KEYS.forEach(k => {
    const info = NUTRIENT_INFO[k];
    const rdaVal = rda[k];
    if (!rdaVal) return;
    const pct = Math.round((daily[k] / rdaVal) * 100);

    if (k === 'na') {
      // ナトリウムは参考値超過を表示（病名・症状名は表示しない）
      if (pct > 150) {
        alerts.push({ icon: pct > 200 ? '🔴' : '🟠', type: 'excess',
          label: '多めに推定',
          title: info.name,
          pctText: `参考値の${pct}%`,
          note: '食塩（ナトリウム）の多い食事傾向があります'
        });
      }
    } else if (pct < 80 && info.deficiency) {
      // 病名・症状名は表示せず、傾向のみ表示
      alerts.push({ icon: pct < 50 ? '🔴' : '🟡', type: pct < 50 ? 'danger' : 'warning',
        label: pct < 50 ? 'かなり少なめに推定' : '少なめに推定',
        title: info.name,
        pctText: `参考値の${pct}%`,
        note: pct < 50 ? '摂取量が参考値を大きく下回っています' : '摂取量が参考値をやや下回っています'
      });
    }
  });

  if (alerts.length === 0) {
    container.innerHTML = '<div class="bulk-no-alert">参考値を大きく外れている栄養素はありません ✅</div>';
    return;
  }

  container.innerHTML = '<div class="bulk-alert-title">栄養バランス参考表示（' + alerts.length + '件）</div>' +
    alerts.map(a =>
      `<div class="alert-item ${a.type}">
        <span class="alert-icon">${a.icon}</span>
        <div class="alert-body">
          <div class="alert-title-row">
            <span class="alert-title">${esc(a.title)}</span>
            <span class="alert-label ${a.type}">${esc(a.label)}</span>
          </div>
          <div class="alert-sub">${esc(a.pctText)} — ${esc(a.note)}</div>
        </div>
      </div>`
    ).join('') +
    '<div class="alert-footer-note">摂取傾向の参考表示です。食事の見直しや健康管理については専門職にご相談ください。</div>';
}

// --- 食事内訳 + 解釈選択 ---
function renderMealBreakdown() {
  const container = document.getElementById('bulkMealBreakdown');
  if (!_bulkResult?.days) { container.innerHTML = ''; return; }

  const mealLabels = {breakfast:'朝食', lunch:'昼食', dinner:'夕食', snack:'間食'};
  const mealIcons = {breakfast:'🌅', lunch:'☀️', dinner:'🌙', snack:'🍪'};

  let html = '<div class="bulk-meals-title">食事内訳</div>';

  _bulkResult.days.forEach((day, di) => {
    // day.date はGemini出力のため esc() でエスケープ
    html += `<div class="bulk-day-header">${esc(day.date)}</div>`;
    (day.meals || []).forEach((meal, mi) => {
      // meal.mealType はGemini出力。内部マップにない値は '不明' にフォールバック（生文字列使用禁止）
      const label = mealLabels[meal.mealType] || '不明';
      const icon = mealIcons[meal.mealType] || '🍽️';

      if (meal.skipped) {
        html += `<div class="bulk-meal-card"><div class="bulk-meal-header">${icon} ${label}</div><div class="bulk-skipped">欠食</div></div>`;
        return;
      }

      html += `<div class="bulk-meal-card"><div class="bulk-meal-header">${icon} ${label}</div>`;
      (meal.items || []).forEach((item, ii) => {
        const key = `${di}-${mi}-${ii}`;
        const sel = _bulkSelections[key] || 0;
        const interps = item.interpretations || [];
        const current = interps[sel];

        html += `<div class="bulk-item">`;
        html += `<div class="bulk-item-original">${esc(item.original)}</div>`;

        if (item.ambiguous && interps.length > 1) {
          // 候補切り替えUI
          html += '<div class="bulk-interp-selector">';
          interps.forEach((interp, idx) => {
            const n = interp.nutrients;
            const macro = `${Math.round(n.calories)}kcal P${Math.round(n.protein)}g F${Math.round(n.fat)}g C${Math.round(n.carbs)}g`;
            const selected = idx === sel ? ' selected' : '';
            html += `<label class="bulk-interp-option${selected}">
              <input type="radio" name="interp-${key}" value="${idx}" ${idx === sel ? 'checked' : ''}
                onchange="onBulkInterpChange('${key}',${idx})">
              <span class="bulk-interp-label">${esc(interp.label)}</span>
              <span class="bulk-interp-details">${esc(interp.details)}</span>
              <span class="bulk-interp-macro">${macro}</span>
            </label>`;
          });
          html += '</div>';
        } else if (current) {
          // 単一候補
          const n = current.nutrients;
          const macro = `${Math.round(n.calories)}kcal P${Math.round(n.protein)}g F${Math.round(n.fat)}g C${Math.round(n.carbs)}g`;
          html += `<div class="bulk-interp-single">
            <span class="bulk-interp-label">${esc(current.label)}</span>
            <span class="bulk-interp-details">${esc(current.details)}</span>
            <span class="bulk-interp-macro">${macro}</span>
          </div>`;
        }
        html += '</div>';
      });
      html += '</div>';
    });
  });

  container.innerHTML = html;
}

// --- 候補切り替え時のハンドラ ---
function onBulkInterpChange(key, idx) {
  if (!_bulkProfile || !_bulkResult) return;
  _bulkSelections[key] = idx;

  // ラジオボタンの選択状態を更新
  const radios = document.querySelectorAll(`input[name="interp-${key}"]`);
  radios.forEach(r => {
    r.closest('.bulk-interp-option').classList.toggle('selected', Number(r.value) === idx);
  });

  // チャート・アラートをリアルタイム再計算
  const rda = calcRDA(_bulkProfile);
  const daily = calcBulkDaily();
  renderBarChart(daily, rda, _bulkResult.days.length);
  renderAlertSection(daily, rda);
}

// --- 保存 ---
function handleBulkSave() {
  if (!_bulkResult?.days) return;
  const result = _bulkResult;
  _bulkResult = null;

  const meals = loadMeals();

  result.days.forEach((day, di) => {
    (day.meals || []).forEach((meal, mi) => {
      if (meal.skipped) return;

      // 選択された解釈に基づいて栄養素を合算
      const mealNutrients = {};
      NUTRIENT_KEYS.forEach(k => mealNutrients[k] = 0);
      const items = [];

      (meal.items || []).forEach((item, ii) => {
        const sel = _bulkSelections[`${di}-${mi}-${ii}`] || 0;
        const interp = item.interpretations?.[sel];
        if (interp) {
          items.push({ name: interp.label || item.original, quantity: interp.details });
          NUTRIENT_KEYS.forEach(k => { mealNutrients[k] += (interp.nutrients[k] || 0); });
        }
      });

      meals.push({
        id: crypto.randomUUID(),
        date: day.date,
        mealType: meal.mealType,
        inputMethod: 'bulk-text',
        items: items,
        nutrients: mealNutrients,
        isDemo: false,
        createdAt: new Date().toISOString()
      });
    });
  });

  saveMeals(meals);
  closeModal('bulkReportModal');
  showToast('食事記録を保存しました', 'success');
  renderAll();
}
