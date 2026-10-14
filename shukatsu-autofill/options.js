const PREFS = ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'];
const THIS_YEAR = new Date().getFullYear();

// 各行の定義。マイページの登録フォームと同じ並び・同じ入れ方にしている
//   text: [[キー, 小見出し, 例], ...]（複数なら横並び）
//   split: 郵便番号・電話番号のように分かれた欄（保存時はハイフンでつなぐ）
//   pref / radio / ymd / ym / check
const address = (p, title) => [
  { label: '郵便番号', split: p('zip'), sizes: [3, 4], ph: ['100', '0005'] },
  { label: '都道府県', pref: p('pref') },
  { label: '市区郡町村', text: [[p('city'), '', '千代田区']] },
  { label: '町域・番地', text: [[p('street'), '', '丸の内3-3-3']] },
  { label: '建物名・部屋番号', text: [[p('building'), '', '〇〇〇マンション123号室']] },
  { label: '住所（カナ）', note: '求められるサイトのみ使用', text: [[p('addressKana'), '', 'チヨダクマルノウチ']] },
].filter((r) => title !== 'univ' || r.label !== '住所（カナ）');

const SECTIONS = [
  { title: '基本情報', rows: [
    { label: '漢字氏名', text: [['lastName', '姓', '山田'], ['firstName', '名', '太郎']] },
    { label: 'カナ氏名', note: '全角カタカナ（「ふりがな」欄にはひらがなに変換して入力します）', text: [['lastNameKana', 'セイ', 'ヤマダ'], ['firstNameKana', 'メイ', 'タロウ']] },
    { label: 'ローマ字氏名', text: [['lastNameRoma', '姓', 'Yamada'], ['firstNameRoma', '名', 'Taro']] },
    { label: '性別', radio: 'gender', choices: ['男性', '女性', 'その他', '回答しない'] },
    { label: '生年月日', ymd: 'birth', from: THIS_YEAR - 35, to: THIS_YEAR - 15 },
  ] },
  { title: '現住所', rows: address((k) => k) },
  { title: '電話番号', rows: [
    { label: '自宅電話番号', split: 'phone', sizes: [5, 4, 4], ph: ['03', '1234', '5678'] },
    { label: '携帯電話番号', split: 'mobile', sizes: [5, 4, 4], ph: ['090', '1234', '5678'] },
  ] },
  { title: '休暇中の連絡先', rows: [
    { label: '', check: 'vacSame', text: '現在の連絡先と同じ（サイトの「同じ」チェックも自動でオンにします）' },
    ...address((k) => 'vac' + k[0].toUpperCase() + k.slice(1)),
    { label: '電話番号', note: '空欄の場合は現住所の電話番号を使います（「同じ」をオンにした時）', split: 'vacPhone', sizes: [5, 4, 4], ph: ['06', '1234', '5678'] },
  ] },
  { title: 'メールアドレス', rows: [
    { label: 'メールアドレス', note: '確認用の欄にも同じものを入力します', text: [['email', '', 'taro@example.com']] },
    { label: 'メールアドレス2', note: '任意（2つ目を求められるサイト用）', text: [['email2', '', '']] },
  ] },
  { title: '学校情報', rows: [
    { label: '学校区分', radio: 'schoolType', choices: ['大学院', '大学', '高等専門学校'] },
    { label: '設置区分', radio: 'schoolEst', choices: ['国立', '公立', '私立'] },
    { label: '学校名', text: [['school', '', '〇〇大学']] },
    { label: '学校名（カナ）', note: 'カタカナ1文字（学校名の頭文字）。「学校名の頭文字」欄に入れて学校を検索します', text: [['schoolKana', '', 'ド']], maxLength: 1 },
    { label: '学部', text: [['faculty', '', '経済学部']] },
    { label: '学科・専攻', text: [['department', '', '経済学科']] },
    { label: '文理区分', radio: 'bunri', choices: ['文系', '理系', '文理融合'] },
    { label: '系統区分（任意）', note: '「人文科学／その他」のような選択肢から、この言葉を含むものを選びます', text: [['keitou', '', '人文科学']] },
    { label: '入学年月', ym: 'entry', from: THIS_YEAR - 10, to: THIS_YEAR + 1 },
    { label: '卒業（予定）年月', ym: 'grad', from: THIS_YEAR - 2, to: THIS_YEAR + 6 },
    { label: 'ゼミ・研究室', text: [['seminar', '', '']] },
    { label: 'クラブ・サークル', text: [['club', '', '']] },
  ] },
  { title: '学校所在地', rows: address((k) => 'school' + k[0].toUpperCase() + k.slice(1), 'univ') },
  { title: '卒業高校', rows: [
    { label: '都道府県', pref: 'hsPref' },
    { label: '高校名', note: '正式名称。検索結果の一覧から高校を選ぶ時に使います', text: [['hsName', '', '〇〇高等学校']] },
    { label: '高校名（カナ）', note: 'カタカナ1文字（高校名の頭文字）。「高校名の頭文字」「高校名の一部」欄に入れて高校を検索します', text: [['hsKana', '', 'ナ']], maxLength: 1 },
    { label: '学科', select: 'hsDept', choices: ['普通科', '理数科', '国際科', '英語科', '商業科', '工業科', '農業科', '総合学科', 'その他'], other: 'hsDeptOther', defaultValue: '普通科' },
    { label: '高校入学年月', ym: 'hsEntry', from: THIS_YEAR - 14, to: THIS_YEAR },
    { label: '高校卒業年月', ym: 'hsGrad', from: THIS_YEAR - 11, to: THIS_YEAR },
  ] },
];

const form = document.getElementById('form');
const h = (tag, props = {}, children = []) => {
  const el = Object.assign(document.createElement(tag), props);
  for (const c of [].concat(children)) el.append(c);
  return el;
};
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const select = (name, values, suffix = '') => h('select', { name }, [
  h('option', { value: '', textContent: '--' }),
  ...values.map((v) => h('option', { value: String(v).padStart(suffix === '年' ? 4 : 2, '0'), textContent: String(v).padStart(suffix === '年' ? 4 : 2, '0') })),
]);
const withSuffix = (el, suffix) => h('label', {}, [el, suffix]);
const toHalfDigits = (s) => s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
const splitters = []; // 分かれた欄に保存値を配る処理
function phoneParts(d) {
  if (!d) return ['', '', ''];
  if (d.length === 11) return [d.slice(0, 3), d.slice(3, 7), d.slice(7)];
  if (d.length === 10) return /^0[36]/.test(d) ? [d.slice(0, 2), d.slice(2, 6), d.slice(6)] : [d.slice(0, 3), d.slice(3, 6), d.slice(6)];
  return [d, '', ''];
}

function cell(row) {
  const td = h('td');
  if (row.note) td.append(h('div', { className: 'note', textContent: row.note }));
  const box = h('div', { className: 'inline' });
  if (row.text && row.check) {
    box.append(h('label', {}, [h('input', { type: 'checkbox', name: row.check }), row.text]));
  } else if (row.text) {
    for (const [name, sub, ph] of row.text) {
      const type = /mail/i.test(name) ? 'email' : /phone|mobile/i.test(name) ? 'tel' : 'text';
      const input = h('input', { type, name, placeholder: ph ? `例）${ph}` : '' });
      if (row.maxLength) Object.assign(input, { maxLength: row.maxLength, style: 'width:60px' });
      box.append(sub ? h('label', {}, [sub, input]) : input);
    }
    if (row.text.length === 1) box.style.display = 'block';
  } else if (row.split) {
    // 「100」-「0005」のように分けて入力。保存用の値（ハイフンつなぎ）は隠し欄に持つ
    const hidden = h('input', { type: 'hidden', name: row.split });
    const parts = row.sizes.map((n, i) => h('input', {
      type: 'text', name: `${row.split}__${i}`, inputMode: 'numeric',
      placeholder: row.ph?.[i] ?? '', style: `width:${n * 12 + 30}px`,
    }));
    const isZip = row.sizes.length === 2;
    const update = () => { hidden.value = parts.every((x) => !x.value) ? '' : parts.map((x) => x.value).join('-'); };
    parts.forEach((p, i) => {
      if (i) box.append(h('span', { textContent: '-' }));
      box.append(p);
      p.addEventListener('input', () => {
        const raw = toHalfDigits(p.value);
        const d = raw.replace(/\D/g, '');
        const n = row.sizes[i];
        if (i === 0 && (raw.includes('-') || raw.includes('－') || d.length > n)) {
          // 「100-0005」「09012345678」のようにまとめて貼り付けた場合は、各欄に振り分ける
          const vals = isZip ? [d.slice(0, 3), d.slice(3, 7)]
            : /[-－]/.test(raw) ? raw.split(/[-－]/).map((x) => x.replace(/\D/g, '')) : phoneParts(d);
          parts.forEach((x, k) => { x.value = vals[k] || ''; });
          (parts.findLast((x) => x.value) || p).focus();
        } else if (d.length > n) {
          // 欄の桁を超えた分は次の欄へ送る
          p.value = d.slice(0, n);
          if (parts[i + 1]) { parts[i + 1].value = (d.slice(n) + parts[i + 1].value).slice(0, row.sizes[i + 1]); parts[i + 1].focus(); }
        } else {
          p.value = d;
          // 桁がそろったら次の欄へ（携帯の「090」なども3桁で次へ）
          const full = d.length >= n || (i === 0 && !isZip && /^0[5789]0$/.test(d));
          if (full && parts[i + 1]) parts[i + 1].focus();
        }
        update();
      });
    });
    box.append(hidden);
    box.style.flexWrap = 'nowrap';
    splitters.push(() => {
      const v = toHalfDigits(hidden.value || '');
      let vals;
      if (isZip) { const d = v.replace(/\D/g, ''); vals = d ? [d.slice(0, 3), d.slice(3, 7)] : ['', '']; }
      else vals = v.includes('-') ? v.split('-') : phoneParts(v.replace(/\D/g, ''));
      parts.forEach((p, i) => { p.value = vals[i] || ''; });
    });
  } else if (row.pref) {
    box.append(h('select', { name: row.pref }, [h('option', { value: '', textContent: '（選択してください）' }), ...PREFS.map((p) => h('option', { value: p, textContent: p }))]));
  } else if (row.select) {
    const sel = h('select', { name: row.select }, row.choices.map((c) => h('option', { value: c, textContent: c })));
    const other = h('input', { type: 'text', name: row.other, placeholder: 'その他の場合（例：〇〇科）' });
    const sync = () => { other.style.display = sel.value === 'その他' ? '' : 'none'; };
    sel.addEventListener('change', sync);
    sel.dataset.default = row.defaultValue || '';
    box.append(sel, other);
    queueMicrotask(sync);
  } else if (row.radio) {
    for (const c of row.choices) box.append(h('label', {}, [h('input', { type: 'radio', name: row.radio, value: c }), c]));
    box.append(h('label', {}, [h('input', { type: 'radio', name: row.radio, value: '' }), '未設定']));
  } else if (row.ymd) {
    box.append(
      withSuffix(select(row.ymd + 'Year', range(row.from, row.to).reverse(), '年'), '年'),
      withSuffix(select(row.ymd + 'Month', range(1, 12)), '月'),
      withSuffix(select(row.ymd + 'Day', range(1, 31)), '日'),
    );
  } else if (row.ym) {
    box.append(
      withSuffix(select(row.ym + 'Year', range(row.from, row.to), '年'), '年'),
      withSuffix(select(row.ym + 'Month', range(1, 12)), '月'),
    );
  }
  td.append(box);
  return td;
}

for (const sec of SECTIONS) {
  form.append(h('h2', { textContent: sec.title }));
  if (sec.note) form.append(h('p', { className: 'note', textContent: sec.note, style: 'font-size:12px;color:#666;margin:0 0 6px' }));
  form.append(h('table', {}, sec.rows.map((row) => h('tr', {}, [h('th', { textContent: row.label }), cell(row)]))));
}

// 郵便番号を7桁入れると、都道府県・市区郡町村・町域（とカナ）を自動入力する。
// 住所データ（日本郵便の郵便番号データ）は拡張機能の中にあり、インターネットには問い合わせない
let zipData;
const loadZipData = () => (zipData ??= fetch(chrome.runtime.getURL('zipdata.json')).then((r) => r.json()));

for (const [zipKey, prefKey, cityKey, streetKey, kanaKey] of [
  ['zip', 'pref', 'city', 'street', 'addressKana'],
  ['vacZip', 'vacPref', 'vacCity', 'vacStreet', 'vacAddressKana'],
  ['schoolZip', 'schoolPref', 'schoolCity', 'schoolStreet', null],
]) {
  const zipEl = form.elements[zipKey]; // 3桁・4桁の欄をつないだ値を持つ隠し欄
  const btn = h('button', { type: 'button', textContent: '住所を自動入力', className: 'zipbtn' });
  const msg = h('div', { className: 'note' });
  zipEl.after(btn);
  zipEl.parentElement.after(msg);

  const fillAddress = async () => {
    const z = toHalfDigits(zipEl.value).replace(/\D/g, '');
    msg.style.color = '#c5221f';
    if (z.length !== 7) { msg.textContent = '郵便番号を7桁で入力してください'; return; }
    const d = await loadZipData();
    const hit = d.z[z];
    if (!hit) { msg.textContent = '該当する住所が見つかりません。手で入力してください'; return; }
    const [pi, city, cityKana] = d.c[hit[0]];
    const town = hit[1] || '', townKana = hit[2] || '';
    form.elements[prefKey].value = d.p[pi];
    form.elements[cityKey].value = city;
    // すでに「丸の内3-3-3」のように番地まで入っていて町域が同じなら、そのまま残す
    const street = form.elements[streetKey];
    if (!town || !street.value.startsWith(town)) street.value = town;
    if (kanaKey) form.elements[kanaKey].value = cityKana + townKana;
    msg.style.color = '#188038';
    msg.textContent = `${d.p[pi]}${city}${town} を入力しました。町域・番地の欄に番地を続けて入力してください`;
    street.focus();
    street.setSelectionRange(street.value.length, street.value.length);
  };
  btn.addEventListener('click', fillAddress);
  // 郵便番号の欄で Enter を押しても同じ動き（フォームの保存はしない）
  for (const part of [form.elements[zipKey + '__0'], form.elements[zipKey + '__1']]) {
    part.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fillAddress(); } });
  }
}

// 「現在の連絡先と同じ」のときは休暇中の住所欄を無効化（電話番号は入力可のまま）
function syncSame() {
  const same = form.elements.vacSame.checked;
  for (const el of form.querySelectorAll('[name^="vac"]')) {
    if (el.name !== 'vacSame' && !el.name.startsWith('vacPhone')) el.disabled = same;
  }
  form.elements.vacZip.nextElementSibling.disabled = same; // 「住所を自動入力」ボタン
}
form.elements.vacSame.addEventListener('change', syncSame);

function load(profile) {
  for (const el of form.elements) {
    if (!el.name || el.name.includes('__')) continue;
    const v = profile[el.name];
    if (el.type === 'checkbox') el.checked = !!v;
    else if (el.type === 'radio') el.checked = el.value === (v ?? '');
    else el.value = v || el.dataset.default || '';
    el.dispatchEvent(new Event('change'));
  }
  splitters.forEach((f) => f());
  syncSame();
}

chrome.storage.local.get('profile').then(({ profile = {} }) => {
  // 旧バージョン（生年月日・卒業月を1つの欄で保存）からの引き継ぎ
  if (profile.birthday && !profile.birthYear) [profile.birthYear, profile.birthMonth, profile.birthDay] = profile.birthday.split('-');
  for (const k of ['gradMonth', 'entryMonth']) if (/^\d$/.test(profile[k] || '')) profile[k] = profile[k].padStart(2, '0');
  // 学校名（カナ）・高校名（カナ）は頭文字1文字だけにした
  for (const k of ['schoolKana', 'hsKana']) if (profile[k]) profile[k] = profile[k].trim().charAt(0);
  load(profile);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const profile = {};
  for (const el of form.elements) {
    if (!el.name || el.name.includes('__')) continue;
    if (el.type === 'checkbox') profile[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) profile[el.name] = el.value; }
    else profile[el.name] = el.value.trim();
  }
  await chrome.storage.local.set({ profile });
  const s = document.getElementById('saved');
  s.textContent = '保存しました';
  setTimeout(() => (s.textContent = ''), 2500);
});

document.getElementById('clear').addEventListener('click', async () => {
  if (!confirm('登録したプロフィールをすべて削除します。よろしいですか？')) return;
  await chrome.storage.local.clear();
  load({});
  document.getElementById('saved').textContent = '削除しました';
});
