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
    // エラーレスポンスの詳細を取得
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

// レスポンスのバリデーション・正規化
function normalizeNutrients(raw) {
  const result = {};
  for (const key of NUTRIENT_KEYS) {
    const v = Number(raw[key]) || 0;
    result[key] = Math.max(0, v);
  }
  // カロリーの範囲チェック
  if (result.calories < 10 || result.calories > 8000) {
    console.warn('Calorie value out of range:', result.calories);
  }
  return result;
}

// --- フォーム入力解析 ---
async function analyzeFormItems(items) {
  const itemList = items.map(it =>
    `${it.name} ${it.quantity || '普通'} (${it.grams ? it.grams+'g' : '標準量'})`
  ).join('\n');

  const prompt = `あなたは管理栄養士です。以下の食事内容の栄養素を推定してください。

食事内容:
${itemList}

以下のJSON形式で各栄養素の推定値を数値で返してください。単位に注意してください。
{${NUTRIENT_PROMPT_KEYS}}

注意:
- 全てのキーを含めてください
- 値は数値のみ（文字列不可）
- 日本食品標準成分表に基づいて推定
- アミノ酸はmg単位で返してください`;

  const raw = await callGemini(prompt);
  return normalizeNutrients(raw);
}

// --- 写真解析 ---
async function analyzePhoto(imageBase64) {
  const prompt = `あなたは管理栄養士です。この食事の写真を分析してください。

以下のJSON形式で返してください:
{
  "items": [{"name": "食品名", "quantity": "推定量", "grams": 推定グラム数}],
  "nutrients": {${NUTRIENT_PROMPT_KEYS}}
}

注意:
- 写真に写っている全ての食品を特定してください
- nutrientsの全てのキーを含めてください
- 値は数値のみ
- 日本食品標準成分表に基づいて推定`;

  const raw = await callGemini(prompt, imageBase64);

  return {
    items: Array.isArray(raw.items) ? raw.items : [],
    nutrients: normalizeNutrients(raw.nutrients || raw)
  };
}

// --- テキスト解析 ---
async function analyzeText(text) {
  const today = new Date().toISOString().split('T')[0];

  const prompt = `あなたは管理栄養士です。以下の食事の記述を分析してください。

入力: "${text}"

以下のJSON形式で返してください:
{
  "date": "YYYY-MM-DD形式（推定できない場合は${today}）",
  "mealType": "breakfast/lunch/dinner/snackのいずれか",
  "items": [{"name": "食品名", "quantity": "量", "grams": 推定グラム数}],
  "nutrients": {${NUTRIENT_PROMPT_KEYS}}
}

注意:
- 「朝」「昼」「夜」「夕」等のキーワードからmealTypeを推定
- 「昨日」「一昨日」等は今日(${today})基準で計算
- nutrientsの全てのキーを含めてください
- 値は数値のみ
- 日本食品標準成分表に基づいて推定`;

  const raw = await callGemini(prompt);

  return {
    date: raw.date || today,
    mealType: raw.mealType || 'lunch',
    items: Array.isArray(raw.items) ? raw.items : [],
    nutrients: normalizeNutrients(raw.nutrients || raw)
  };
}

// --- AI献立提案 ---
async function suggestMeals(deficiencies, excesses, days) {
  const defList = deficiencies.map(d =>
    `${NUTRIENT_INFO[d.key].name}: 充足率${d.pct}%（RDA: ${d.rda}${NUTRIENT_INFO[d.key].unit}）`
  ).join('\n');

  const excList = excesses.map(d =>
    `${NUTRIENT_INFO[d.key].name}: 充足率${d.pct}%（過剰）`
  ).join('\n');

  const prompt = `あなたは管理栄養士です。以下の栄養状態を改善する${days}日分の献立を提案してください。

不足している栄養素:
${defList || 'なし'}

過剰な栄養素:
${excList || 'なし'}

以下のJSON形式で返してください:
{
  "days": [
    {
      "day": 1,
      "breakfast": {
        "dishes": [
          {"category": "主食", "name": "玄米ご飯", "amount": "茶碗1杯（150g）", "tip": "白米より食物繊維・ビタミンB1が豊富"}
        ]
      },
      "lunch": {
        "dishes": [同上の形式]
      },
      "dinner": {
        "dishes": [同上の形式]
      },
      "point": "この日の献立全体のポイント（30字程度で簡潔に）"
    }
  ]
}

categoryは「主食」「主菜」「副菜」「汁物」「デザート」「飲み物」のいずれか。
各dishのtipには作り方のコツ・栄養面のワンポイントを1文で書いてください。

注意:
- 日本の家庭料理を中心に、簡単に作れるメニューを提案
- 不足栄養素を重点的に補う食材を含める
- 過剰な栄養素（特にナトリウム）は控えめに
- 各食事は3〜5品で構成`;

  return await callGemini(prompt);
}

// --- まとめてテキスト解析（複数日・複数食対応） ---
async function analyzeBulkText(text) {
  const today = new Date().toISOString().split('T')[0];
  const year = new Date().getFullYear();

  const prompt = `あなたは管理栄養士です。以下の食事記録を分析してください。
複数日・複数食をまとめてパースし、各食材の栄養素を推定してください。

食事記録:
"""
${text}
"""

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
  ]
}

ルール:
- 「欠食」「食べてない」等はskipped:trueにし、itemsは空配列
- 改行で途切れた食材名は結合して1つにする（例: "ブロ\\nッコリー" → "ブロッコリー"）
- 曖昧な食材（「野菜サラダ」「丼」等、内容が特定できないもの）はambiguous:trueで2〜3の解釈候補を返す
  - 各候補は栄養素が大きく異なるバリエーションを選ぶ
- 明確な食材（「豆腐」「珈琲」「納豆」等）はambiguous:falseで候補1つ
- 各解釈のnutrientsには全てのキーを含めること（値は数値のみ）
- 日本食品標準成分表に基づいて推定
- 「朝」「昼」「夜」「夕」等からmealTypeを推定
- 日付が推定できない場合は${today}を使用
- アミノ酸はmg単位`;

  const raw = await callGemini(prompt);

  // レスポンスの正規化
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

  return raw;
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
        canvas.width = Math.round(img.width * scale);
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
