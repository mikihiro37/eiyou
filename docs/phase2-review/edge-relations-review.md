# Phase 2 レビュー：エッジ（栄養素間関係）データ

作成日: 2026-05-22  
対象ファイル: `index.html`（`const edges = [...]`、L369〜416）  
作業種別: 読み取り専用・内容確認のみ（コード変更なし）

---

## 1. エッジ定義の概要

栄養素間の関係を3種類で表現：

| type | 表示ラベル | 色 | 意味 |
|---|---|---|---|
| synergy | 相乗 | #4caf50（緑） | 協働・相互作用 |
| absorption | 吸収促進 | #2196f3（青） | 一方が他方の吸収を促進 |
| antagonist | 拮抗 | #f44336（赤） | 一方が他方の吸収・利用を阻害 |

総エッジ数: **44本**（synergy: 22, absorption: 11, antagonist: 8）

---

## 2. エッジ一覧と注目フラグ

### 相乗（synergy）— 22本

| source | target | description | フラグ |
|---|---|---|---|
| vitC | vitE | ビタミンCが酸化されたビタミンEを再生し抗酸化力を維持 | 問題なし |
| vitE | se | ビタミンEとセレンが相乗的に抗酸化作用を発揮 | 問題なし |
| vitB12 | vitB9 | B12と葉酸が協働して赤血球を形成（造血ビタミン） | 問題なし |
| vitB2 | vitB6 | B2がB6の活性型への変換に必要 | 問題なし |
| vitB5 | vitC | 副腎皮質ホルモン合成でパントテン酸とビタミンCが協働 | 問題なし |
| co | vitB12 | コバルトはビタミンB12の中心金属元素として不可欠 | 問題なし |
| vitA | zn | 亜鉛がビタミンA結合タンパク質の合成に必要 | 問題なし |
| vitK | ca | ビタミンKがオステオカルシンを活性化しカルシウムの骨定着を促進 | 問題なし |
| vitB1 | mg | マグネシウムがチアミンの活性化（リン酸化）に必要 | 問題なし |
| iodine | se | セレンが甲状腺ホルモンの代謝（脱ヨード酵素）に必要 | 問題なし |
| mn | ca | マンガンとカルシウムが骨形成で協働 | 問題なし |
| leu | ile | BCAA（ロイシン・イソロイシン・バリン）が協働して筋タンパク合成を促進 | 問題なし |
| leu | val | BCAAとして筋肉のエネルギー供給と分解抑制に協働 | 問題なし |
| ile | val | BCAA3種がバランスよく存在することで効果を発揮 | 問題なし |
| lys | vitC | リシンとビタミンCがコラーゲン合成で協働 | 問題なし |
| met | vitB12 | B12がメチオニン合成酵素の補酵素として機能 | 問題なし |
| met | vitB9 | 葉酸がメチオニン再生（ホモシステイン→メチオニン）に必要 | 問題なし |
| rutin | vitC | ルチンがビタミンCの吸収と効果を増強 | ⚠ rutin は evidence=limited。「効果を増強」は一定の根拠があるが、エビデンスレベルとの整合性を要確認 |
| lipoicAcid | vitC | α-リポ酸がビタミンCを再生し抗酸化ネットワークを維持 | ⚠ lipoicAcid は evidence=limited。エッジ表現と限定的エビデンスの整合性 |
| lipoicAcid | vitE | α-リポ酸がビタミンEを再生 | ⚠ 同上 |
| choline | vitB9 | コリンと葉酸がメチル基代謝（一炭素代謝）で協働 | 問題なし |
| p | ca | リンとカルシウムが適正比率で骨の石灰化を促進 | 問題なし |

### 吸収促進（absorption）— 11本

| source | target | description | フラグ |
|---|---|---|---|
| vitC | fe | ビタミンCが非ヘム鉄を還元し吸収を3〜6倍促進 | 問題なし |
| vitD | ca | ビタミンDがカルシウムの腸管吸収を促進（カルビンディン誘導） | 問題なし |
| vitD | p | ビタミンDがリンの腸管吸収を促進 | 問題なし |
| vitB6 | mg | ビタミンB6がマグネシウムの細胞内取り込みを促進 | 問題なし |
| vitA | fe | ビタミンAが鉄の利用効率を高め**貧血を予防** | ⚠ **「貧血を予防」** → 安全表現ルール上の禁止表現「予防」を含む |
| vitD | mg | ビタミンDがマグネシウムの吸収を調節 | 問題なし |
| cu | fe | 銅（セルロプラスミン）が鉄の酸化を助け利用を促進 | 問題なし |
| vitC | cr | ビタミンCがクロムの吸収を促進 | ⚠ cr は evidence=probable。crの吸収促進効果の根拠強度を要確認 |
| lys | ca | リシンがカルシウムの腸管吸収を促進 | 問題なし |
| trp | vitB3 | トリプトファンが体内でナイアシン（B3）に変換される（60mg→1mg） | 問題なし |
| b | vitD | ホウ素がビタミンDの活性型への変換を促進 | ⚠ b は evidence=limited。エッジ表現と限定的エビデンスの整合性 |

### 拮抗（antagonist）— 8本

| source | target | description | フラグ |
|---|---|---|---|
| ca | fe | カルシウムが鉄の吸収を阻害（同時摂取で吸収率低下） | 問題なし |
| ca | zn | カルシウム過剰摂取が亜鉛の吸収を阻害 | 問題なし |
| zn | cu | 亜鉛過剰摂取が銅の吸収を競合的に阻害 | 問題なし |
| fe | zn | 鉄と亜鉛が高用量で腸管吸収を相互に阻害 | 問題なし |
| na | k | ナトリウムとカリウムが拮抗的に体液バランスを調節 | 問題なし |
| ca | mg | カルシウム過剰がマグネシウムの吸収を阻害 | 問題なし |
| mo | cu | モリブデン過剰が銅の排泄を促進し欠乏を誘発 | 問題なし |
| phe | trp | フェニルアラニンとトリプトファンが脳内輸送で競合 | 問題なし |

---

## 3. 注目フラグのまとめ

| # | エッジ | description中の問題箇所 | 種別 | 重要度 |
|---|---|---|---|---|
| E-1 | vitA → fe (absorption) | **「貧血を予防」** | 禁止表現「予防」を含む。修正候補 | A |
| E-2 | rutin → vitC (synergy) | 「効果を増強」 | rutin は evidence=limited。過大表現の可能性 | C |
| E-3 | lipoicAcid → vitC (synergy) | 「維持」 | lipoicAcid は evidence=limited。エビデンスとの整合性 | C |
| E-4 | lipoicAcid → vitE (synergy) | 「を再生」 | 同上 | C |
| E-5 | b → vitD (absorption) | 「変換を促進」 | b は evidence=limited。エビデンスとの整合性 | C |
| E-6 | vitC → cr (absorption) | 「吸収を促進」 | cr は evidence=probable。エビデンス強度の確認要 | C |

---

## 4. エビデンスレベル別エッジ分布

limited / probable ノードが関与するエッジ：

| ノード | evidence | 関与エッジ数 | 主な関係 |
|---|---|---|---|
| rutin | limited | 1 | rutin→vitC (synergy) |
| lipoicAcid | limited | 2 | lipoicAcid→vitC, lipoicAcid→vitE (synergy) |
| b（ホウ素） | limited | 1 | b→vitD (absorption) |
| inositol | limited | 0 | エッジなし |
| paba | limited | 0 | エッジなし |
| f | limited | 0 | エッジなし |
| si | limited | 0 | エッジなし |
| v | limited | 0 | エッジなし |
| cr | probable | 1 | vitC→cr (absorption) |
| co | probable | 1 | co→vitB12 (synergy) |

---

## 5. 全体評価

- エッジの大多数は確立した栄養科学的知見に基づいており、問題なし
- **最優先修正**: `vitA→fe` のdescription「貧血を予防」→「貧血への関与が研究されています」等への表現変更
- limited エビデンスノードが関与する4エッジは、description自体は過大でないが、表示上エビデンスレベルの注記が必要か専門職に確認

---

*このファイルは Phase 2 レビュー資料として作成したものです。コードへの変更は行っていません。*
