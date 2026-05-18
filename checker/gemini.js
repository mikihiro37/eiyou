// ============================================================
// Gemini API 連携
// ============================================================

// 栄養素キーリスト（プロンプト埋め込み用）
const NUTRIENT_PROMPT_KEYS = NUTRIENT_KEYS.map(k => {
  const n = NUTRIENT_INFO[k];
  return `"${k}": ${n.name}(${n.unit})`;
}).join(', ');

// ============================================================
// APIキー取得（単一の共通関数 — app.js も gemini.js もここを参照する）
// sessionStorage（セッション限定）→ localStorage（端末保存）の順で探す
// ============================================================
function getApiKey() {
  return sessionStorage.getItem('eiyou_apikey_session') || localStorage.getItem('eiyou_apikey') || '';
}

// AbortController（外部からキャンセル可能）
let _currentAbort = null;
function cancelGemini() {
  if (_currentAbort) { _currentAbort.abort(); _currentAbort = null; }
}

// Gemini API呼び出し
async function callGemini(prompt, imageBase64) {
  // 共通関数 getApiKey() で取得（checkApiKey と同じ取得元を保証）
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API_KEY_MISSING');

  const parts = [];
  if (imageBase64) {
    parts.push({inlineData: {mimeType:'image/jpeg', data:imageBase64}});
  }
  parts.push({text: prompt});

  // モデル名（設定から取得）
  const model = localStorage.getItem('eiyou_model') || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const genConfig = {temperature:0.2, responseMimeType:'application/json'};

  // AbortController: ユーザーキャンセル + 60秒タイムアウト
  _currentAbort = new AbortController();
  const timeoutId = setTimeout(() => _currentAbort?.abort(), 60000);
  const signal = _currentAbort.signal;

  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        contents: [{parts}],
        generationConfig: genConfig
      }),
      signal
    });
  } catch (e) {
    clearTimeout(timeoutId);
    _currentAbort = null;
    if (e.name === 'AbortError') throw new Error('CANCELLED');
    throw e;
  }
  clearTimeout(timeoutId);
  _currentAbort = null;

  if (!resp.ok) {
    let detail = '';
    try {
      const errBody = await resp.json();
      detail = errBody.error?.message || JSON.stringify(errBody.error || errBody);
    } catch { detail = resp.statusText; }
    console.error('Gemini API error:', resp.status, detail);

    if (resp.status === 400) throw new Error('BAD_REQUEST:' + detail);
    if (resp.status === 401 || resp.status === 403) throw new Error('API_KEY_INVALID');
    if (resp.status === 429) throw new Error('RATE_LIMITED:' + detail);
    throw new Error(`API_ERROR_${resp.status}:${detail}`);
  }

  const data = await resp.json();

  // candidates が空の場合（安全フィルタ等）
  if (!data.candidates || data.candidates.length === 0) {
    const reason = data.promptFeedback?.blockReason || 'unknown';
    throw new Error('BLOCKED:' + reason);
  }

  let text = data.candidates[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('EMPTY_RESPONSE');

  // markdownコードブロック(```json ... ```)を除去
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

  return JSON.parse(text);
}

// 栄養素値のバリデーション・正規化（nutrients オブジェクト専用）
function normalizeNutrients(raw) {
  const result = {};
  for (const key of NUTRIENT_KEYS) {
    const v = Number(raw[key]) || 0;
    result[key] = Math.max(0, v);
  }
  // カロリーの範囲チェック（参考ログ）
  if (result.calories < 10 || result.calories > 8000) {
    console.warn('Calorie value out of range:', result.calories);
  }
  return result;
}

// Gemini出力のメタ情報（仮定・不確実性・信頼度・注意事項）を正規化
function normalizeMeta(raw) {
  return {
    assumptions:    Array.isArray(raw.assumptions)    ? raw.assumptions.map(String)    : [],
    uncertainItems: Array.isArray(raw.uncertainItems) ? raw.uncertainItems.map(String) : [],
    confidence:     (raw.confidence === '低' || raw.confidence === '高') ? raw.confidence : '中',
    warnings:       Array.isArray(raw.warnings)       ? raw.warnings.map(String)       : [],
    notForMedicalUse: true
  };
}

// ============================================================
// --- フォーム入力解析 ---
// ============================================================
async function analyzeFormItems(items) {
  const itemList = items.map(it =>
    `${it.name} ${it.quantity || '普通'} (${it.grams ? it.grams+'g' : '標準量'})`
  ).join('\n');

  const prompt = `あなたは食事記録の内容を整理し、栄養素を概算する補助ツールです。
医療・診断・治療・疾病予防・栄養指導を目的とした出力は行いません。

以下の食事内容について、各食材の栄養素の概算値を推定してください。

食事内容:
${itemList}

重要な前提:
- 食材の産地・調理法・ブランドにより実際の栄養値は大きく異なります
- 分量の記載がない場合は、日本の標準的な1人前を仮定します
- 仮定した内容はassumptionsに記載してください
- 判断できない食材や不明な内容はuncertainItemsに記載してください
- 結果は食事を振り返るための参考情報です
- 「改善」「予防」「効果がある」などの医療的表現は使用しないでください

以下のJSON形式で返してください:
{
  "nutrients": {${NUTRIENT_PROMPT_KEYS}},
  "assumptions": ["仮定した内容を日本語で箇条書き"],
  "uncertainItems": ["推定が難しかった食材・内容"],
  "confidence": "低または中または高",
  "warnings": ["特記すべき注意事項（ない場合は空配列）"],
  "notForMedicalUse": true
}

confidenceの基準:
- 高: 食材・分量が明確で推定精度が比較的高い
- 中: 概ね把握できるが一部に不明点がある
- 低: 不明点が多く推定誤差が大きい

注意:
- nutrients の全てのキーを含めてください
- 値は数値のみ（文字列不可）
- 日本食品標準成分表を参考に概算
- アミノ酸はmg単位`;

  const raw = await callGemini(prompt);
  return {
    nutrients: normalizeNutrients(raw.nutrients || raw),
    ...normalizeMeta(raw)
  };
}

// ============================================================
// --- 写真解析 ---
// ============================================================
async function analyzePhoto(imageBase64) {
  const prompt = `あなたは食事の写真から食べている内容を推定し、栄養素を概算する補助ツールです。
医療・診断・治療・疾病予防・栄養指導を目的とした出力は行いません。

この食事の写真に写っている食品を推定し、栄養素の概算値を計算してください。

重要な前提:
- 写真からの食品・分量の特定には誤差があります
- 食材の産地・調理法・調味料の量は写真から正確に判断できません
- 一般的な調理法と標準的な分量を仮定します
- 写真に写っていない食品（飲み物など）は含まれません
- 結果は食事を振り返るための参考情報です

以下のJSON形式で返してください:
{
  "estimatedFoods": [{"name": "食品名", "quantity": "推定量", "grams": 推定グラム数}],
  "nutrients": {${NUTRIENT_PROMPT_KEYS}},
  "assumptions": ["仮定した内容を日本語で箇条書き"],
  "uncertainItems": ["特定が難しかった食品・内容"],
  "confidence": "低または中または高",
  "warnings": ["特記すべき注意事項（ない場合は空配列）"],
  "notForMedicalUse": true
}

confidenceの基準:
- 高: 食品が明確に特定でき分量も推定しやすい
- 中: 概ね特定できるが一部に不確かな点がある
- 低: 写真が不鮮明または食品が特定しにくい

注意:
- 写真に写っている全ての食品を推定してください
- nutrientsの全てのキーを含めてください
- 値は数値のみ
- 日本食品標準成分表を参考に概算`;

  const raw = await callGemini(prompt, imageBase64);
  return {
    estimatedFoods: Array.isArray(raw.estimatedFoods) ? raw.estimatedFoods
                  : Array.isArray(raw.items) ? raw.items : [],
    nutrients: normalizeNutrients(raw.nutrients || raw),
    ...normalizeMeta(raw)
  };
}

// ============================================================
// --- テキスト解析（1食分） ---
// ============================================================
async function analyzeText(text) {
  const today = new Date().toISOString().split('T')[0];

  const prompt = `あなたは食事の記述内容を構造化し、栄養素を概算する補助ツールです。
医療・診断・治療・疾病予防・栄養指導を目的とした出力は行いません。

以下の食事の記述を解析してください。

入力: "${text}"

重要な前提:
- 文章から読み取れない食材・分量は、一般的なものを仮定します
- 仮定した内容はassumptionsに記載してください
- 特定できない内容はuncertainItemsに記載してください
- 結果は食事を振り返るための参考情報です

以下のJSON形式で返してください:
{
  "date": "YYYY-MM-DD形式（推定できない場合は${today}）",
  "mealType": "breakfast/lunch/dinner/snackのいずれか",
  "estimatedFoods": [{"name": "食品名", "quantity": "量", "grams": 推定グラム数}],
  "nutrients": {${NUTRIENT_PROMPT_KEYS}},
  "assumptions": ["仮定した内容を日本語で箇条書き"],
  "uncertainItems": ["特定できなかった食材・内容"],
  "confidence": "低または中または高",
  "warnings": ["特記すべき注意事項（ない場合は空配列）"],
  "notForMedicalUse": true
}

注意:
- 「朝」「昼」「夜」「夕」等のキーワードからmealTypeを推定
- 「昨日」「一昨日」等は今日(${today})基準で計算
- nutrientsの全てのキーを含めてください
- 値は数値のみ
- 日本食品標準成分表を参考に概算`;

  const raw = await callGemini(prompt);
  return {
    date:    raw.date || today,
    mealType: raw.mealType || 'lunch',
    estimatedFoods: Array.isArray(raw.estimatedFoods) ? raw.estimatedFoods
                  : Array.isArray(raw.items) ? raw.items : [],
    nutrients: normalizeNutrients(raw.nutrients || raw),
    ...normalizeMeta(raw)
  };
}

// ============================================================
// --- AI献立アイデア ---
// ============================================================
async function suggestMeals(deficiencies, excesses, days) {
  const defList = deficiencies.map(d =>
    `${NUTRIENT_INFO[d.key].name}: 参考値の${d.pct}%（参考値: ${d.rda}${NUTRIENT_INFO[d.key].unit}）`
  ).join('\n');

  const excList = excesses.map(d =>
    `${NUTRIENT_INFO[d.key].name}: 参考値の${d.pct}%`
  ).join('\n');

  const prompt = `あなたは食事内容の振り返りと参考情報の提供を補助するツールです。
医療・診断・治療・疾病予防・栄養指導を目的とした出力は行いません。

以下の栄養摂取傾向を参考に、${days}日分の食事の参考例を提案してください。

参考値を下回っている傾向の栄養素:
${defList || 'なし'}

参考値を上回っている傾向の栄養素:
${excList || 'なし'}

以下のJSON形式で返してください:
{
  "days": [
    {
      "day": 1,
      "breakfast": {
        "dishes": [
          {"category": "主食", "name": "玄米ご飯", "amount": "茶碗1杯（150g）", "tip": "白米より食物繊維・ビタミンB1を含みます"}
        ]
      },
      "lunch": {"dishes": [同上の形式]},
      "dinner": {"dishes": [同上の形式]},
      "point": "この日の食事内容のポイント（30字程度で簡潔に）"
    }
  ]
}

categoryは「主食」「主菜」「副菜」「汁物」「デザート」「飲み物」のいずれか。
各dishのtipには食材の特徴を事実として記載してください（例：「○○を多く含みます」）。

注意:
- 日本の家庭料理を中心に、取り入れやすいメニューを提案
- 参考値を下回っている栄養素を含む食材を意識する
- ナトリウムが多い傾向がある場合は塩分控えめの料理も含める
- 各食事は3〜5品で構成
- 「改善」「治療」「予防」「効果がある」などの医療的表現は使わないでください
- 結果はあくまでも食事の参考例であることを念頭においてください`;

  return await callGemini(prompt);
}

// ============================================================
// --- まとめてテキスト解析（複数日・複数食対応） ---
// ============================================================
async function analyzeBulkText(text) {
  const today = new Date().toISOString().split('T')[0];
  const year  = new Date().getFullYear();

  const prompt = `あなたは食事記録の内容を整理し、栄養素を概算する補助ツールです。
医療・診断・治療・疾病予防・栄養指導を目的とした出力は行いません。

以下の食事記録を解析してください。
複数日・複数食をまとめてパースし、各食材の栄養素の概算値を推定してください。

食事記録:
"""
${text}
"""

重要な前提:
- 食材・分量が不明な場合は一般的なものを仮定し、overallAssumptionsに記載
- 特定できない食材・内容はoverallUncertainItemsに記載
- 結果は食事を振り返るための参考情報です
- 「改善」「予防」「効果がある」などの医療的表現は使わないでください

以下のJSON形式で返してください:
{
  "days": [
    {
      "date": "YYYY-MM-DD形式（年が不明なら${year}年）",
      "meals": [
        {
          "mealType": "breakfast|lunch|dinner|snack",
          "skipped": false,
          "items": [
            {
              "original": "元のテキストそのまま",
              "ambiguous": true,
              "interpretations": [
                {
                  "label": "解釈の短い名前（15字以内）",
                  "details": "具体的な内容と推定量",
                  "nutrients": {${NUTRIENT_PROMPT_KEYS}}
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "overallAssumptions": ["全体で仮定した内容を日本語で箇条書き"],
  "overallUncertainItems": ["特定できなかった食材・内容"],
  "overallConfidence": "低または中または高",
  "warnings": ["特記すべき注意事項（ない場合は空配列）"],
  "notForMedicalUse": true
}

ルール:
- 「欠食」「食べてない」等はskipped:trueにし、itemsは空配列
- 改行で途切れた食材名は結合して1つにする（例: "ブロ\\nッコリー" → "ブロッコリー"）
- 曖昧な食材（「野菜サラダ」「丼」等）はambiguous:trueで2〜3の解釈候補を返す
  - 各候補は栄養素が大きく異なるバリエーションを選ぶ
- 明確な食材（「豆腐」「珈琲」「納豆」等）はambiguous:falseで候補1つ
- 各解釈のnutrientsには全てのキーを含めること（値は数値のみ）
- 日本食品標準成分表を参考に概算
- 「朝」「昼」「夜」「夕」等からmealTypeを推定
- 日付が推定できない場合は${today}を使用
- アミノ酸はmg単位`;

  const raw = await callGemini(prompt);

  if (!raw.days || !Array.isArray(raw.days)) {
    throw new Error('解析結果のフォーマットが不正です');
  }

  raw.days.forEach(day => {
    (day.meals || []).forEach(meal => {
      if (meal.skipped) { meal.items = []; return; }
      (meal.items || []).forEach(item => {
        (item.interpretations || []).forEach(interp => {
          interp.nutrients = normalizeNutrients(interp.nutrients || {});
        });
      });
    });
  });

  return {
    days: raw.days,
    overallAssumptions:    Array.isArray(raw.overallAssumptions)    ? raw.overallAssumptions.map(String)    : [],
    overallUncertainItems: Array.isArray(raw.overallUncertainItems) ? raw.overallUncertainItems.map(String) : [],
    overallConfidence:     (raw.overallConfidence === '低' || raw.overallConfidence === '高') ? raw.overallConfidence : '中',
    warnings:              Array.isArray(raw.warnings)              ? raw.warnings.map(String)              : [],
    notForMedicalUse: true
  };
}

// --- 画像リサイズ ---
function resizeImage(file, maxBytes) {
  maxBytes = maxBytes || 3 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ファイル読み込みエラー'));
    reader.onload = () => {
      const dataUrl = reader.result;
      if (file.size <= maxBytes) {
        resolve(dataUrl.split(',')[1]);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const scale = Math.sqrt(maxBytes / file.size) * 0.9;
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
      };
      img.onerror = () => reject(new Error('画像読み込みエラー'));
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
