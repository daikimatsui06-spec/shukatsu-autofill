// フォーム項目を推定して入力する本体。
// ページに注入され（ページ側の JavaScript からは見えない隔離環境で動く）、
// window.__shukatsuFill(profile, options) として呼ばれる。
(() => {
  if (window.__shukatsuFill) return;

  const PREFS = ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'];

  // 隠し項目（type=hidden）は入力欄として数えない（見出しのセルに隠し項目が入っているサイトがある）
  const CONTROLS = 'input:not([type=hidden]), select, textarea';
  const SKIP_INPUT_TYPES = new Set(['hidden', 'password', 'file', 'submit', 'button', 'reset', 'image', 'checkbox', 'radio', 'color', 'range']);
  const ADDRESS_TYPES = new Set(['address', 'city', 'street', 'building', 'citystreet', 'streetbldg']);
  const SEPARATOR_RE = /^[-－ー‐−―~〜～]?$/;

  // どのブロック（現住所 / 休暇中 / 高校 / 大学 / 対象外）に属する項目か
  const SECTION_RULES = [
    // 「※現住所以外に連絡先を希望する場合」「現住所と異なる連絡先」なども休暇中の連絡先として扱う（e2r など）
    ['vac', /休暇|帰省|長期休|現住所以外|現住所と(異な|違)|現住所とは別|別の連絡先|vacation|holiday|kyuu?ka|kisei/i],
    ['skip', /保護者|緊急連絡|勤務先|中学|guardian|parent|emergency/i],
    ['hs', /高校|高等学校|high_?school/i],
    ['univ', /学校|大学|在籍校|学歴|所在地|school|univ|campus|gakko|daigaku/i],
    ['cur', /現住所|現在の?住所|自宅|本人|基本情報|個人情報|current|genju/i],
  ];

  // 項目の種類。上にあるものほど優先
  const TYPE_RULES = [
    ['ignore', /学位|障害|アンケート|設問/],
    ['email', /メール|e-?mail|mail|(携帯|PC|ＰＣ|パソコン|スマホ|サブ|メイン|その他|予備).{0,3}アドレス/i],
    ['gender', /性別|gender|(^|[_\s])sex/i],
    ['schoolType', /学校区分|学校種別|学校の種類|school_?type/i],
    ['course', /課程|degree/i],
    ['bunri', /文理|文系.{0,4}理系/],
    ['keitou', /系統/],
    ['gradStatus', /卒業区分|卒業見込|既卒/],
    ['schoolEst', /設置区分|設置者|国公私|establish/i],
    ['initial', /頭文字|イニシャル|initial/i],
    ['zip', /郵便|〒|zip|postal|post_?code|yuu?bin/i],
    ['mobile', /携帯|mobile|keitai|cell/i],
    ['tel', /電話|tel|phone|denwa/i],
    ['birthday', /生年月日|誕生|birth|bday|tanjo/i],
    ['admission', /入学|admission|entrance|nyuu?gaku/i],
    ['grad', /卒業|graduat|sotsu(gyo)?/i],
    ['hsname', /高校名|高等学校名|出身高校|high_?school_?name/i],
    ['seminar', /ゼミ|研究室|seminar|zemi/i],
    ['club', /クラブ|サークル|部活|club|circle/i],
    ['facdept', /学部.{0,3}学科|faculty.{0,3}depart/i],
    ['faculty', /学部|faculty|gakubu/i],
    ['department', /学科|専攻|department|gakka|major/i],
    ['pref', /都道府県|pref|todou?fuken/i],
    ['citystreet', /(市区町村|市区郡|市町村).{0,8}(番地|以下)|市区町村以降/],
    ['streetbldg', /番地.{0,4}(建物|マンション)/],
    ['building', /建物|マンション|アパート|building|bldg|部屋番号|号室/i],
    ['street', /番地|丁目|町名|町域|street|banchi/i],
    ['city', /市区町村|市区郡|市町村|city|shiku/i],
    ['address', /住所|所在地|address|addr|juu?sho/i],
    ['school', /大学|学校|在籍校|school|univ|daigaku|gakko/i],
    // 「名」だけで判定すると「コース名」「学校名」なども拾うので、「名」は単独の時だけ
    ['name', /氏名|名前|姓|^名\s*[:：]?$|name|shimei|フリガナ|ふりがな|カナ|セイ|メイ|ローマ字|kana|furigana/i],
  ];

  const AUTOCOMPLETE = {
    'family-name': ['name', 'last'], 'given-name': ['name', 'first'], name: ['name'],
    'postal-code': ['zip'], 'address-level1': ['pref'], 'address-level2': ['city'],
    'address-line1': ['street'], 'address-line2': ['building'], 'street-address': ['address'],
    tel: ['tel'], 'tel-national': ['tel'], email: ['email'], sex: ['gender'],
    bday: ['birthday'], 'bday-year': ['birthday', 'y'], 'bday-month': ['birthday', 'm'], 'bday-day': ['birthday', 'd'],
  };

  const OTHER_PERSON_RE = /内定者|紹介者|推薦者|推薦人|リクルーター|先輩|社員|教官|教員|教授|指導|担当者|保護者|家族|父親|母親|配偶者|友人|知人/;

  const GENERIC_TYPES = new Set(['address', 'name', 'tel', 'school']);

  // 学校区分・学校種別の言い換え（「4年制大学」「四年制大学」など）
  const SCHOOL_TYPE_ALIASES = {
    大学: ['大学', '4年制大学', '四年制大学', '四・六年制大学', '4・6年制大学', '大学（4年制）', '大学(4年制)', '大学（学部）', '学部'],
    大学院: ['大学院', '大学院（修士）', '修士', '大学院（博士）', '博士'],
    高等専門学校: ['高等専門学校', '高専'],
  };

  const BUNRI_ALIASES = {
    文系: ['文系', '文科系', '文系学部'], 理系: ['理系', '理科系', '理系学部'], 文理融合: ['文理融合', '文理複合', '文理複合学部', 'その他'],
  };

  // ラジオボタンで選ぶ項目
  const RADIO_TYPES = new Set(['gender', 'schoolType', 'schoolEst', 'school', 'hsname', 'course', 'bunri', 'initial', 'faculty', 'department', 'keitou']);

  const KANA_RE = /カナ|かな|がな|ヨミ|よみ|kana|furigana|yomi|セイ|メイ|せい|めい/i;
  const ROMA_RE = /ローマ|英字|英語|アルファベット|roma|alpha|english/i;

  const toHalf = (s) => String(s ?? '').replace(/[０-９Ａ-Ｚａ-ｚ－]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const clean = (s) => String(s ?? '').replace(/必須|任意|[*＊※]/g, ' ').replace(/[\s　]+/g, ' ').trim();
  const norm = (s) => toHalf(s).replace(/[\s　]/g, '').toLowerCase();
  const nums = (s) => (toHalf(s).match(/\d+/g) || []).map(Number);
  const toHira = (s) => String(s ?? '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const toKata = (s) => String(s ?? '').replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
  const digits = (s) => toHalf(s).replace(/\D/g, '');

  const classify = (text) => {
    if (!text) return null;
    for (const [type, re] of TYPE_RULES) if (re.test(text)) return type;
    return null;
  };

  // 実際に見えている欄だけを対象にする。
  // 極小・透明・画面外に隠した欄に個人情報を入れさせる手口を防ぐため、サイズと位置も確認する
  function isVisible(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    if (r.right + window.scrollX <= 0 || r.bottom + window.scrollY <= 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.opacity !== '0';
  }
  // プルダウンは、見た目を整えるために本物の <select> を透明・極小にして、上に飾りの箱を重ねているサイトが多い。
  // その場合は囲んでいる箱が見えていれば対象にする（選択肢から選ぶだけなので、隠し欄による抜き取りの心配はない）
  const isControlVisible = (el) => isVisible(el) || (el.tagName === 'SELECT' && !!el.parentElement && isVisible(el.parentElement));
  const hasControl = (n) => n.nodeType === 1 && (n.matches(CONTROLS) || !!n.querySelector(CONTROLS));

  // 入力欄・選択肢を除いたテキスト
  function ownText(node) {
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType !== 1 || node.matches('script, style, select, textarea, option')) return '';
    const c = node.cloneNode(true);
    c.querySelectorAll('script, style, select, textarea').forEach((n) => n.remove());
    return c.textContent;
  }

  // <span><input></span> のような入れ子を外して、周辺テキストを探す基準要素を決める
  function anchorOf(el) {
    let a = el;
    for (let i = 0; i < 3; i++) {
      const p = a.parentElement;
      if (!p || p.matches('td, th, tr, li, dd, dt, form, fieldset, label, body')) break;
      if (p.querySelectorAll(CONTROLS).length !== 1 || clean(ownText(p))) break;
      a = p;
    }
    return a;
  }

  // 直前（dir=-1）／直後（dir=1）にあるテキスト。隣の入力欄や改行で止める
  function adjacentText(node, dir) {
    let out = '';
    for (let n = dir < 0 ? node.previousSibling : node.nextSibling; n && out.length < 30; n = dir < 0 ? n.previousSibling : n.nextSibling) {
      if (n.nodeType === 1 && (n.matches('br, hr, button') || hasControl(n))) break;
      const t = ownText(n);
      out = dir < 0 ? t + out : out + t;
    }
    return clean(out);
  }

  function labelText(el) {
    const parts = [];
    for (const l of el.labels || []) parts.push(ownText(l));
    for (const id of (el.getAttribute('aria-labelledby') || '').split(/\s+/)) {
      const n = id && document.getElementById(id);
      if (n) parts.push(ownText(n));
    }
    return clean(parts.join(' '));
  }

  // 「年」「月」「-」のような単位・区切りだけの文字（見出しとしては使わない）
  const UNIT_ONLY_RE = /^[年月日時分\s\-~〜～/／()（）・]*$/;

  // 入力例・注意書き（「例（03-1111-1111）」「※…」「誤入力を防止する為に…」など）は見出しとして使わない
  const NOTE_RE = /^(▲?例|※|＊|\*)|入力してください|ください。$/;

  // 表の見出し（th）や、左側のラベル用 div など。近いものから順に最大3つ
  function rowHeaders(anchor) {
    const out = [];
    let a = anchor.parentElement;
    for (let lv = 0; lv < 6 && a && !a.matches('form, body') && out.length < 3; lv++, a = a.parentElement) {
      for (let s = a.previousElementSibling, k = 0; s && k < 3; s = s.previousElementSibling, k++) {
        if (hasControl(s)) break;
        const t = clean(ownText(s));
        if (t.length > 40) break;
        if (t && !UNIT_ONLY_RE.test(t) && !NOTE_RE.test(t)) { out.push(t); break; }
      }
    }
    const g = groupHeader(anchor);
    if (g && !out.includes(g)) out.push(g);
    return out;
  }
  const rowHeader = (anchor) => rowHeaders(anchor)[0] || '';

  // <div role="group" aria-labelledby="…"> のように、項目のまとまりに見出しが付いている場合（axol 等）
  function groupHeader(el) {
    const g = el.closest('[role=group][aria-labelledby], [role=radiogroup][aria-labelledby]');
    if (!g) return '';
    return clean(g.getAttribute('aria-labelledby').split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean).map(ownText).join(' '));
  }

  // 見出し（「休暇中の連絡先」など）を探すため、祖先をさかのぼって手前の見出しっぽいテキストを集める
  function sectionTexts(anchor) {
    const out = [];
    let a = anchor;
    for (let lv = 0; lv < 12 && a && !a.matches('body'); lv++, a = a.parentElement) {
      if (a.matches('fieldset')) {
        const lg = a.querySelector(':scope > legend');
        if (lg) out.push(clean(ownText(lg)));
      }
      if (a.matches('table') && a.caption) out.push(clean(ownText(a.caption)));
      for (let s = a.previousElementSibling, k = 0; s && k < 8; s = s.previousElementSibling, k++) {
        if (hasControl(s)) continue;
        const t = clean(ownText(s));
        if (t) out.push(t.slice(0, 60));
      }
    }
    return out;
  }

  function detectSection(info) {
    const texts = [info.label, info.prev, info.attrs, info.header, ...sectionTexts(info.anchor)];
    for (const t of texts) {
      if (!t) continue;
      if (/同じ|同上/.test(t)) { if (SECTION_RULES[0][1].test(t)) return 'vac'; continue; }
      for (const [sec, re] of SECTION_RULES) if (re.test(t)) return sec;
    }
    return 'cur';
  }

  function isPrefSelect(el) {
    let n = 0;
    for (const o of el.options) {
      const t = norm(o.text);
      if (t.length >= 2 && PREFS.some((p) => p.startsWith(t))) n++;
    }
    return n >= 40;
  }

  function detectPart(type, info) {
    const { prev, next, label, attrs, el } = info;
    if (type === 'name') {
      const LAST = /姓|苗字|名字|セイ|せい|last|family|myoji|sei(?![a-z])/i, FIRST = /(?<!氏)名(?!前|字)|メイ|めい|first|given|mei(?![a-z])/i;
      const header = LAST.test(info.header) && FIRST.test(info.header) ? '' : info.header; // 「氏名（姓・名）」は手がかりにしない
      for (const t of [prev, label, attrs, header]) {
        if (!t || /姓名/.test(t)) continue;
        if (/姓|苗字|名字|セイ|せい|last|family|myoji|sei(?![a-z])/i.test(t)) return 'last';
        if (/(?<!氏)名(?!前|字)|メイ|めい|first|given|mei(?![a-z])/i.test(t)) return 'first';
      }
    }
    if (type === 'birthday' || type === 'grad' || type === 'admission') {
      const m = /^[年月日]/.exec(next);
      if (m) return { 年: 'y', 月: 'm', 日: 'd' }[m[0]];
      const lb = label.replace(/生年月日|年月日|年月|卒業予定|卒業|入学/g, ' ');
      const at = attrs.replace(/birthday|bday|birth/gi, ' ');
      for (const t of [lb, at]) {
        if (/年|year|yyyy|(^|[_\-\s])y($|[_\-\s\d])/i.test(t)) return 'y';
        if (/月|month|(^|[_\-\s])mm?($|[_\-\s\d])/i.test(t)) return 'm';
        if (/日|day|(^|[_\-\s])dd?($|[_\-\s\d])/i.test(t)) return 'd';
      }
      if (el.tagName === 'SELECT') {
        const opts = [...el.options].map((o) => nums(o.text));
        if (opts.every((n) => n.length <= 1)) {
          const max = Math.max(0, ...opts.flat());
          if (max > 31) return 'y';
          if (max > 12) return 'd';
          if (max > 0) return 'm';
        }
      } else if (el.maxLength === 4) return 'y';
    }
    return null;
  }

  function rowOf(el) {
    const r = el.closest('tr, li, dd');
    if (r) return r;
    for (let a = el.parentElement, i = 0; a && i < 4; a = a.parentElement, i++) if (clean(ownText(a))) return a;
    return el.parentElement;
  }

  // 欄のまわりの手がかり（直前の文字、ラベル、属性、行見出し）を集める
  function baseInfo(el) {
    const anchor = anchorOf(el);
    const info = {
      el, anchor,
      prev: adjacentText(anchor, -1),
      next: adjacentText(anchor, 1),
      label: labelText(el),
      attrs: clean(['name', 'id', 'placeholder', 'aria-label', 'title'].map((a) => el.getAttribute(a) || '').join(' ')),
      headers: rowHeaders(anchor),
    };
    info.header = info.headers[0] || '';
    return info;
  }

  function analyze(el) {
    const info = baseInfo(el);
    const tiers = [info.prev, info.label, info.attrs, info.header];
    info.ctx = [...tiers, info.next].join(' ');

    let type = null, part = null, tier = -1;
    const ac = (el.getAttribute('autocomplete') || '').trim().toLowerCase().split(/\s+/).pop();
    if (AUTOCOMPLETE[ac]) [type, part = null] = AUTOCOMPLETE[ac];
    if (el.tagName === 'SELECT' && isPrefSelect(el)) type = 'pref';
    for (let i = 0; i < tiers.length && !type; i++) {
      type = classify(tiers[i]);
      tier = i;
    }
    // 「addr1」「tel2」「（全角カタカナ…）」のような大まかな判定は、後ろの手がかり（行見出しなど）が具体的ならそちらを優先
    for (const h of info.headers.slice(1)) {
      if (type) break;
      type = classify(h);
      tier = 3;
    }
    if (GENERIC_TYPES.has(type)) {
      for (const t of [...tiers.slice(tier + 1), ...info.headers.slice(1)].map(classify)) {
        if (t && !GENERIC_TYPES.has(t) && t !== 'ignore') { type = t; tier = 3; break; }
      }
    }
    // 行見出しからしか判定できなかった欄は「弱い判定」。直前の欄と「-」でつながっていればそちらに合わせる
    info.weak = !type || tier === 3;

    // カナ・ローマ字の判定。近いテキストを優先し、行見出しは近くに「姓」「名」等の明示がない時だけ使う
    // 「カナ使用可」は「カナでもよい」という意味なので、カナ欄の判定には使わない
    const close = [info.prev, info.label, info.attrs].join(' ').replace(/(カナ|かな)(使用|入力)?(可|も可|でも可)/g, '');
    const explicitKanji = /漢字/.test(info.prev + info.label) && !KANA_RE.test(close);
    const kanaText = KANA_RE.test(close) ? close : (!explicitKanji && KANA_RE.test(info.header) ? info.header : '');
    info.kana = !!kanaText;
    info.hira = info.kana && (/ふりがな|ひらがな|よみがな|せい|めい/.test(kanaText) || (/かな/.test(kanaText) && !/カナ/.test(kanaText)));
    info.roma = !info.kana && (ROMA_RE.test(close) || (!explicitKanji && ROMA_RE.test(info.header)));

    // 卒業見込み／既卒を選ぶプルダウン（見出しが「卒業年月」だけのこともある）
    if (el.tagName === 'SELECT' && [...el.options].some((o) => /見込|予定/.test(o.text)) && [...el.options].some((o) => /既卒|卒業(?!.*(見込|予定))|修了(?!.*(見込|予定))/.test(o.text))) type = 'gradStatus';
    info.type = type;
    info.part = type && (part || detectPart(type, info));
    if (type === 'email') {
      if (/^[＠@]/.test(info.next)) info.part = 'local';
      else if (/[＠@]$/.test(info.prev)) info.part = 'domain';
    }
    info.section = detectSection(info);
    info.row = rowOf(el);
    return info;
  }

  // 「〒[   ]-[    ]」「[   ]-[    ]-[    ]」のように区切り文字だけで並んだ欄か
  function joinedToPrev(x, pv) {
    if (!SEPARATOR_RE.test(x.prev) || x.row !== pv.row) return false;
    let s = x.anchor.previousElementSibling;
    for (let k = 0; s && k < 2 && !hasControl(s); k++) {
      if (s.matches('br, div, p')) return false; // 改行をはさんだ欄は別項目
      s = s.previousElementSibling;
    }
    return !!s && (s === pv.anchor || s.contains(pv.el));
  }

  function addrOf(p, section) {
    if (section === 'univ') {
      return { zip: p.schoolZip, pref: p.schoolPref, city: p.schoolCity, street: p.schoolStreet, building: p.schoolBuilding, kana: '', tel: '' };
    }
    if (section === 'hs') return { pref: p.hsPref };
    const cur = { zip: p.zip, pref: p.pref, city: p.city, street: p.street, building: p.building, kana: p.addressKana, tel: p.phone || p.mobile };
    if (section === 'vac') {
      const vac = p.vacSame ? { ...cur } : { zip: p.vacZip, pref: p.vacPref, city: p.vacCity, street: p.vacStreet, building: p.vacBuilding, kana: p.vacAddressKana };
      vac.tel = p.vacPhone || (p.vacSame ? cur.tel : '');
      return vac;
    }
    return cur;
  }

  // ハイフンを入れるか。注意書き > placeholder > maxlength > 登録時の書式 の順で判断
  function wantsHyphen(info, nDigits, stored) {
    const ph = toHalf(info.el.getAttribute('placeholder') || '');
    if (/ハイフン(なし|無し|不要)|ハイフンを?(入れ|含め|つけ|付け)ない|半角数字のみ/.test(info.ctx)) return false;
    if (/\d-\d/.test(ph) || /ハイフン(あり|有り|必要)|ハイフンを?(入れ|含め|つけ|付け)て/.test(info.ctx)) return true;
    if (/\d{5,}/.test(ph)) return false;
    const ml = info.el.maxLength;
    if (ml > 0 && ml <= nDigits) return false;
    return String(stored).includes('-');
  }

  function phoneParts(s) {
    const h = toHalf(s).replace(/[^\d-]/g, '');
    if (h.includes('-')) return h.split('-').filter(Boolean);
    if (h.length === 11) return [h.slice(0, 3), h.slice(3, 7), h.slice(7)];
    if (h.length === 10) return /^0[36]/.test(h) ? [h.slice(0, 2), h.slice(2, 6), h.slice(6)] : [h.slice(0, 3), h.slice(3, 6), h.slice(6)];
    return [h];
  }

  const padIfWanted = (info, v) => (/0\d|mm|dd/i.test(info.el.getAttribute('placeholder') || '') ? String(v).padStart(2, '0') : String(+v));

  // 年月（入学・卒業）の年と月
  function yearMonth(p, type, section) {
    if (section === 'hs') return type === 'grad' ? [p.hsGradYear, p.hsGradMonth] : [p.hsEntryYear, p.hsEntryMonth];
    return type === 'grad' ? [p.gradYear, p.gradMonth] : [p.entryYear, p.entryMonth];
  }

  // 「高校名の一部」欄に入れる検索語。設定の高校名（カナ）＝頭文字1文字を使う
  function hsSearchWord(p) {
    return toKata(p.hsKana || '').trim().charAt(0) || null;
  }

  // 「メールアドレス2」「サブアドレス」などの2つ目の欄か
  // 「メールアドレス2」「サブ」「携帯アドレス」などの2つ目の欄（携帯のメールアドレスは設定の「メールアドレス2」を使う）
  const isSecondEmail = (info) => /メール(アドレス)?\s*[2２②]|サブ|予備|secondary|携帯用?(メール|アドレス)|その他(の)?アドレス/i.test([info.prev, info.label, ...info.headers].join(' '));

  function valueOf(info, p, seen, gsize) {
    const { type, part, section, kana, roma, hira, el } = info;
    const A = addrOf(p, section);
    const S = seen[section];

    if (kana && ADDRESS_TYPES.has(type)) return A.kana;

    switch (type) {
      case 'email': {
        // 「再入力」「確認用」だけの欄は、直前のメール欄（1つ目／2つ目）に合わせる
        const confirmOnly = /再入力|確認|もう一度/.test(info.header + info.label) && !/メール|mail/i.test(info.header + info.label);
        const second = confirmOnly ? !!seen.lastEmail2 : isSecondEmail(info);
        if (!confirmOnly && part !== 'domain') seen.lastEmail2 = second;
        const addr = second ? p.email2 : p.email;
        if (!addr) return null;
        if (part === 'local') return addr.split('@')[0];
        if (part === 'domain') return addr.split('@')[1] || null;
        return addr;
      }
      case 'course': {
        const map = { 大学: ['学部', '学士', '大学'], 大学院: ['修士', '博士前期', '大学院'], 高等専門学校: ['高専', '高等専門学校'] };
        return map[p.schoolType] || null;
      }
      case 'bunri':
        return BUNRI_ALIASES[p.bunri] || p.bunri;
      case 'gradStatus': {
        if (!p.gradYear) return null;
        const future = new Date(+p.gradYear, +(p.gradMonth || 3), 0) >= new Date();
        return future ? ['見込', '予定'] : ['既卒', '卒業（修了）', '卒業'];
      }
      case 'gender':
        return p.gender;
      case 'schoolType':
        return schoolTypeCands(p);
      case 'schoolEst':
        return p.schoolEst;
      case 'initial': {
        // 入力欄にはそのまま（「ド」）、選択肢なら「ど」「と」なども候補にする
        const c = initialCands(section === 'hs' ? p.hsKana : p.schoolKana);
        return c && el.tagName !== 'SELECT' ? c[0] : c;
      }
      case 'keitou':
        return p.keitou;
      case 'seminar':
        return p.seminar;
      case 'club':
        return p.club;
      case 'hsname':
        if (roma) return null;
        // 「高校名の一部」など検索用の欄には、正式名称ではなくカタカナの検索語を入れる
        if (/一部|キーワード|検索語/.test([info.prev, info.label, info.attrs, info.header].join(' '))) return hsSearchWord(p);
        if (kana) return null; // カナは頭文字1文字だけ登録しているので、高校名カナの欄には入れない
        return p.hsName;
      case 'zip': {
        const z = digits(A.zip);
        if (!z) return null;
        if (part === 0) return z.slice(0, 3);
        if (part === 1) return z.slice(3);
        return wantsHyphen(info, 7, A.zip) ? `${z.slice(0, 3)}-${z.slice(3)}` : z;
      }
      case 'pref': S.pref = true; return A.pref;
      case 'city': S.city = true; return A.city;
      case 'street': S.street = true; return A.street;
      case 'building': S.building = true; return A.building;
      case 'citystreet': S.city = S.street = true; return (A.city || '') + (A.street || '');
      case 'streetbldg': S.street = S.building = true; return [A.street, A.building].filter(Boolean).join(' ');
      case 'tel':
      case 'mobile': {
        // 自宅・携帯の欄が別々にあるフォームでは、自宅電話が未登録なら自宅欄は空けておく
        const primary = p.phone || p.mobile;
        const isOther = /その他|予備|サブ|第[2２二]|[2２]つ目/.test(info.header + info.label);
        const num = section === 'cur' && isOther ? (primary === p.phone ? p.mobile : p.phone)
          : section !== 'cur' ? A.tel
          : type === 'mobile' ? p.mobile || p.phone
          : p.phone || (seen.hasMobileField ? '' : p.mobile);
        if (!num) return null;
        const pp = phoneParts(num);
        if (typeof part === 'number') return gsize === 2 && part === 1 ? pp.slice(1).join('') : pp[part];
        const d = digits(num);
        return wantsHyphen(info, d.length, num) ? pp.join('-') : d;
      }
      case 'birthday': {
        const [y, m, d] = p.birthYear ? [p.birthYear, p.birthMonth, p.birthDay] : (p.birthday || '').split('-');
        if (!y || !m || !d) return null;
        const mm = String(m).padStart(2, '0'), dd = String(d).padStart(2, '0');
        if (part === 'y') return y;
        if (part === 'm') return padIfWanted(info, m);
        if (part === 'd') return padIfWanted(info, d);
        if (el.type === 'date') return `${y}-${mm}-${dd}`;
        const ph = el.getAttribute('placeholder') || '';
        if (el.maxLength === 8) return y + mm + dd;
        if (/年/.test(ph)) return `${y}年${+m}月${+d}日`;
        return /\d-\d/.test(ph) ? `${y}-${mm}-${dd}` : `${y}/${mm}/${dd}`;
      }
      case 'admission':
      case 'grad': {
        const [y, m] = yearMonth(p, type, section);
        if (!y) return null;
        if (part === 'y') return y;
        if (part === 'm') return m ? padIfWanted(info, m) : null;
        if (part === 'd') return null;
        if (!m) return y;
        if (el.tagName === 'SELECT') return [`${y}年${+m}月`, `${y}/${m}`];
        return el.maxLength === 6 ? y + String(m).padStart(2, '0') : `${y}年${+m}月`;
      }
      case 'school':
        if (roma) return null;
        if (kana) {
          const k = (section === 'hs' ? p.hsKana : p.schoolKana) || '';
          if (k.trim().length <= 1) return null; // 頭文字1文字だけなら学校名カナの欄には入れない
          return hira ? toHira(k) : toKata(k);
        }
        return section === 'hs' ? p.hsName : p.school;
      case 'faculty':
        return kana || roma || section === 'hs' ? null : p.faculty;
      case 'department':
        if (kana || roma) return null;
        if (section === 'hs') return p.hsDept === 'その他' ? p.hsDeptOther : p.hsDept;
        return p.department;
      case 'facdept':
        if (kana || roma) return null;
        if (part === 'faculty') return p.faculty;
        if (part === 'department') return p.department;
        return [p.faculty, p.department].filter(Boolean).join(' ');
      case 'name': {
        if (section === 'univ' || section === 'hs') return null; // 学校情報の中の「ふりがな」は学校名の読み（自分の名前ではない）
        let l = p.lastName, f = p.firstName, sep = '　';
        if (kana) {
          l = p.lastNameKana; f = p.firstNameKana;
          if (hira) { l = toHira(l); f = toHira(f); }
        } else if (roma) {
          l = p.lastNameRoma; f = p.firstNameRoma; sep = ' ';
        }
        if (part === 'last') return l;
        if (part === 'first') return f;
        return [l, f].filter(Boolean).join(sep);
      }
    }
    return null;
  }

  // 「住所」とだけ書かれた欄。手前で都道府県・市区町村を入れていればそこは除く
  function addressGroupValues(g, p, seen) {
    const A = addrOf(p, g[0].section);
    const S = seen[g[0].section];
    if (g[0].kana) return [A.kana];
    const head = (S.pref ? '' : A.pref || '') + (S.city ? '' : A.city || '');
    const street = S.street ? '' : A.street || '';
    const bldg = S.building ? '' : A.building || '';
    S.pref = S.city = S.street = S.building = true;
    if (g.length === 1) return [[head + street, bldg].filter(Boolean).join(' ')];
    if (g.length === 2) return [head + street, bldg];
    return [head, street, bldg];
  }

  const DEFAULT_PARTS = {
    name: ['last', 'first'], zip: [0, 1], tel: [0, 1, 2], mobile: [0, 1, 2],
    birthday: ['y', 'm', 'd'], grad: ['y', 'm'], admission: ['y', 'm'], facdept: ['faculty', 'department'],
  };

  // 選択肢の中から一致するものを探す。候補が複数あるときは、まず全候補で完全一致を探し、次に数字、最後に部分一致
  function bestMatch(items, textOf, cands) {
    cands = cands.filter((c) => c != null && c !== '');
    const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    for (const c of cands) {
      const cn = norm(c);
      const hit = items.find((o) => textOf(o).some((t) => norm(t) === cn));
      if (hit) return hit;
    }
    for (const c of cands) {
      if (!/^[\d年月日/\-.\s]+$/.test(toHalf(c))) continue;
      const cnums = nums(c);
      const hit = items.find((o) => textOf(o).some((t) => same(nums(t), cnums)))
        || (cnums.length === 1 && items.find((o) => nums(textOf(o)[0])[0] === cnums[0]));
      if (hit) return hit;
    }
    for (const c of cands) {
      if (/^[\d年月日/\-.\s]+$/.test(toHalf(c))) continue;
      const cn = norm(c);
      const hit = items.find((o) => {
        const t = norm(textOf(o)[0]);
        if (t.includes(cn + '院') || t.includes(cn + '校')) return false; // 「大学」で「大学院」、「高等学」で「高等学校」を選ばない
        if (/国立|公立|私立/.test(t) && !/国立|公立|私立/.test(cn)) return false; // 設置区分が分からないのに「国立大学」などを選ばない
        return t.length >= 1 && (t.includes(cn) || (t.length >= 2 && cn.includes(t)));
      });
      if (hit) return hit;
    }
    return null;
  }

  function setValue(el, value) {
    const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
    if (desc?.set) desc.set.call(el, value); // React などの管理下でも変更を検知させる
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new FocusEvent('blur'));
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  }

  // 本物のプルダウンを隠して、見た目用の部品を表示しているサイト（i-web の jqTransform など）では、その表示も更新する
  function syncCustomSelect(el, beforeText) {
    const w = el.closest('.jqTransformSelectWrapper');
    if (w) {
      const a = w.querySelector(`ul a[index="${el.selectedIndex}"]`);
      if (a) { safeClick(a); return; }
      const span = w.querySelector('span');
      if (span) span.textContent = el.selectedOptions[0]?.text ?? '';
      return;
    }
    if (isVisible(el) || !el.parentElement) return;
    // それ以外の部品：前に表示されていた文字（「-▼-」「選択してください」など）の部分を、選んだ選択肢の文字に書き換える
    const shown = [...el.parentElement.querySelectorAll('span, div, button, p')].find((n) =>
      !n.contains(el) && n.children.length === 0 && isVisible(n) && norm(n.textContent) === norm(beforeText));
    if (shown) shown.textContent = el.selectedOptions[0]?.text ?? '';
  }

  // 頭文字の候補。50音表は濁点なしで並ぶことが多いので「ド」→「ド」「ど」「ト」「と」のように濁点を外した文字も入れる
  const initialCands = (k) => {
    const c = toKata(k || '').trim().charAt(0);
    if (!c) return null;
    const base = c.normalize('NFD').replace(/[\u3099\u309a]/g, '').normalize('NFC');
    return [...new Set([c, toHira(c), base, toHira(base)])];
  };

  // 「あ い う え お …」の50音表（ボタンやリンク）で学校名の頭文字を選ぶサイト用（i-web の学校検索など）
  function clickInitialButton(p, state) {
    if (state.kanaClicked) return 0;
    const cands = initialCands(p.schoolKana);
    if (!cands) return 0;
    // すでに学校が選ばれていれば押さない（選択が消えないように）
    if (p.school && [...document.querySelectorAll('select')].some((s) => s.value && sameSchoolName(s.selectedOptions[0]?.text || '', norm(p.school)))) return 0;
    const label = (b) => ((b.tagName === 'INPUT' ? b.value : b.textContent) || '').trim();
    const btns = [...document.querySelectorAll('a, button, input[type=button], input[type=submit], li, td, span, label')]
      .filter((b) => /^[ぁ-んァ-ヶ]$/.test(label(b)) && !b.querySelector('a, button, input') && isVisible(b));
    if (btns.length < 20) return 0; // 50音表があるときだけ
    const hit = btns.find((b) => cands.includes(label(b)));
    if (!hit) return 0;
    state.kanaClicked = true;
    state.searched.add('univ');
    safeClick(hit);
    highlight(hit);
    return 1;
  }

  // ラジオボタン・チェックボックスを選ぶ。見た目用の部品（jqTransform の <a> など）があればそちらを押して表示も合わせる
  function clickChoice(input) {
    const fake = [...(input.parentElement?.children || [])].find((n) => n !== input && n.matches('a.jqTransformRadio, a.jqTransformCheckbox, [class*="radio"] a, a[class*="Radio"], a[class*="Checkbox"]'));
    if (fake) safeClick(fake);
    if (!input.checked) input.click();
    if (!input.checked) { input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); }
  }

  // ページの要素を押す。「javascript:〜」のリンクは、拡張機能の中から押すと Chrome の安全ルールで止められるので
  // （「Running the JavaScript URL violates the following Content Security Policy…」のエラー）、
  // 拡張機能の裏方（background.js）に頼んで、ページ自身の中で押してもらう
  let clickSeq = 0;
  function safeClick(el) {
    const link = el.closest?.('a[href]');
    if (link && /^\s*javascript:/i.test(link.getAttribute('href')) && globalThis.chrome?.runtime?.sendMessage) {
      const id = `${Date.now()}-${++clickSeq}`;
      link.setAttribute('data-shukatsu-click', id);
      chrome.runtime.sendMessage({ type: 'mainClick', id }).catch(() => {});
      return;
    }
    el.click();
  }

  function highlight(el) {
    const prev = el.style.outline;
    el.style.outline = '2px solid #34a853';
    const reset = () => { el.style.outline = prev; };
    el.addEventListener('input', reset, { once: true });
    el.addEventListener('change', reset, { once: true });
  }

  // 「（全角）」「全角入力のみ」の欄は英数字・記号を全角に、「半角大文字」の欄は大文字にする
  const toFull = (s) => s.replace(/[!-~]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0)).replace(/ /g, '　');
  const FULL_TYPES = new Set([...ADDRESS_TYPES, 'name', 'school', 'faculty', 'department', 'facdept', 'seminar', 'club', 'hsname']);
  function adjustWidth(info, v) {
    const ctx = [info.label, info.header, info.next, info.prev].join(' ');
    if (FULL_TYPES.has(info.type) && /全角/.test(ctx) && !/半角/.test(ctx)) return toFull(v);
    if (info.roma && /大文字|capital/i.test(ctx)) return v.toUpperCase();
    return v;
  }

  function apply(info, v, options, done) {
    const cands = (Array.isArray(v) ? v : [v]).filter((c) => c != null && c !== '');
    if (!cands.length) return false;
    const el = info.el;
    if (el.tagName === 'SELECT') {
      // 一度選んだプルダウンは、選択肢が入れ替わった・空に戻された時だけ選び直す（自分で選び直した内容を上書きしない）
      const sig = `${el.options.length}|${el.options[el.options.length - 1]?.text}`;
      if (done.get(el) === sig && el.value !== '') return false;
      const opt = bestMatch([...el.options].filter((o) => !o.disabled && o.value !== ''), (o) => [o.text, o.value], cands);
      if (!opt) return false;
      if (el.value === opt.value) { done.set(el, sig); return false; }
      const before = el.selectedOptions[0]?.text ?? '';
      setValue(el, opt.value);
      syncCustomSelect(el, before);
      done.set(el, sig);
      info.selectedNow = true;
      highlight(el);
      return true;
    } else {
      if (done.has(el)) return false;
      if (options.onlyEmpty !== false && el.value.trim() !== '') return false;
      let val = adjustWidth(info, String(cands[0]));
      if (el.type === 'number') val = digits(val);
      setValue(el, val);
    }
    done.set(el, el.value);
    highlight(el);
    return true;
  }

  // 性別・学校区分・頭文字・学校・学部・文理区分などのラジオボタン（「ポッチ」を選ぶ形式）
  function fillRadios(p, state) {
    const groups = new Map();
    for (const r of document.querySelectorAll('input[type=radio]')) {
      if (r.disabled || !r.name) continue;
      if (!groups.has(r.name)) groups.set(r.name, []);
      groups.get(r.name).push(r);
    }
    const choiceText = (r) => [labelText(r) || adjacentText(r, 1) || adjacentText(anchorOf(r), 1), r.value];
    // 本物のラジオボタンを隠して見た目用の部品を表示しているサイトもあるので、囲みやラベルが見えていればよい
    const seenVisible = (r) => isVisible(r) || [...(r.labels || [])].some(isVisible) || (!!r.parentElement && isVisible(r.parentElement));
    let n = 0;
    for (const g of groups.values()) {
      // この実行中に一度選んだ組は、もう触らない（あとから自分で選び直した内容を上書きしないため）
      if (g.some((r) => state.radioDone.has(r)) || !g.some(seenVisible)) continue;
      const info = baseInfo(g[0]);
      if (OTHER_PERSON_RE.test(info.label + ' ' + info.header)) continue;
      const legend = g[0].closest('fieldset')?.querySelector(':scope > legend');
      // 表のセル内に注意書きがある場合に備えて、セルの見出し（th / dt）も見る
      const cell = g[0].closest('td, dd');
      const cellHead = cell?.previousElementSibling && !hasControl(cell.previousElementSibling) ? clean(ownText(cell.previousElementSibling)) : '';
      let type = null;
      for (const t of [info.header, ...info.headers.slice(1), cellHead, legend && clean(ownText(legend)), info.attrs]) {
        const c = classify(t);
        if (RADIO_TYPES.has(c)) { type = c; break; }
      }
      const section = detectSection(info);
      // 見出しで分からない時は、選択肢の中身から判断する
      type = choiceType(g.map((r) => choiceText(r)[0]), p, section) || type;
      if (!type) {
        // 「現在の居住地」「学校所在地」などの「日本国内／海外」は、まだ選ばれていなければ日本国内にする
        const dom = g.find((r) => /日本国内|^国内/.test(choiceText(r)[0]));
        if (dom && !g.some((r) => r.checked) && g.some((r) => /海外|国外/.test(choiceText(r)[0]))) {
          clickChoice(dom);
          highlight(dom.labels?.[0] || dom);
          g.forEach((r) => state.radioDone.add(r));
          n++;
        }
        continue;
      }
      const want = wantFor(type, p, section);
      if (!want) continue;
      const hit = bestMatch(g, choiceText, [].concat(want));
      if (!hit) continue;
      g.forEach((r) => state.radioDone.add(r));
      if (hit.checked) continue;
      clickChoice(hit);
      highlight(hit.labels?.[0] || hit.parentElement || hit);
      n++;
    }
    state.selectedOnPage = (state.selectedOnPage || 0) + n;
    return n;
  }

  // 選択肢の並びから、何を選ぶ組かを判断する（見出しのない検索画面など）
  function choiceType(texts, p, section) {
    const t = texts.map((x) => clean(x));
    const kana1 = t.filter((x) => /^[ぁ-んァ-ヶ]$/.test(x)).length;
    if (kana1 >= 10 && kana1 >= t.length * 0.7) return 'initial';
    const name = section === 'hs' ? p.hsName : p.school;
    if (name && t.some((x) => sameSchoolName(x, norm(name)))) return section === 'hs' ? 'hsname' : 'school';
    if (p.faculty && t.some((x) => norm(x) === norm(p.faculty))) return 'faculty';
    if (p.department && t.some((x) => norm(x) === norm(p.department))) return 'department';
    if (t.some((x) => /文系/.test(x)) && t.some((x) => /理系/.test(x))) return 'bunri';
    if (t.some((x) => /(国立|公立|私立).*(大学|短大)/.test(x))) return 'schoolType';
    if (t.some((x) => /^大学$|四年制大学|4年制大学/.test(x)) && t.some((x) => /大学院|短期大学|短大|高等専門学校|高専/.test(x))) return 'schoolType';
    if (t.filter((x) => PREFS.some((pf) => norm(x).startsWith(norm(pf).replace(/[都府県]$/, '')))).length >= 5) return 'pref';
    if (t.filter((x) => REGIONS.some(([r]) => x.includes(r))).length >= 4) return 'pref'; // 「関東」「近畿」などの地方名
    if (t.some((x) => /人文|社会科学|自然科学/.test(x))) return 'keitou';
    return null;
  }

  // 地方名で並んでいる場合用
  const REGIONS = [
    ['北海道', '北海道'], ['東北', '青森県岩手県宮城県秋田県山形県福島県'], ['関東', '茨城県栃木県群馬県埼玉県千葉県東京都神奈川県'],
    ['甲信越', '新潟県山梨県長野県'], ['北陸', '富山県石川県福井県'], ['東海', '岐阜県静岡県愛知県三重県'],
    ['中部', '新潟県富山県石川県福井県山梨県長野県岐阜県静岡県愛知県'], ['近畿', '滋賀県京都府大阪府兵庫県奈良県和歌山県三重県'],
    ['関西', '滋賀県京都府大阪府兵庫県奈良県和歌山県'], ['中国', '鳥取県島根県岡山県広島県山口県'], ['四国', '徳島県香川県愛媛県高知県'],
    ['九州', '福岡県佐賀県長崎県熊本県大分県宮崎県鹿児島県沖縄県'], ['沖縄', '沖縄県'],
  ];
  const prefCands = (pref) => pref ? [pref, pref.replace(/[都府県]$/, ''), ...REGIONS.filter(([, ps]) => ps.includes(pref)).map(([r]) => r)] : null;

  // 設置区分＋学校区分（「私立大学」「国立大学院」など）の候補
  function schoolTypeCands(p) {
    const base = SCHOOL_TYPE_ALIASES[p.schoolType] || (p.schoolType ? [p.schoolType] : []);
    const est = p.schoolEst || '';
    const combo = est && p.schoolType ? [est + p.schoolType, est + (p.schoolType === '大学' ? '大学（4年制）' : p.schoolType)] : [];
    return [...combo, ...base];
  }

  function wantFor(type, p, section) {
    const GENDER_ALIASES = { 男性: ['男性', '男'], 女性: ['女性', '女'], 回答しない: ['回答しない', '無回答', '未回答', '答えたくない', '回答を控える'], その他: ['その他', 'Other'] };
    const COURSE = { 大学: ['学部', '学士', '大学'], 大学院: ['修士', '博士前期', '大学院'], 高等専門学校: ['高専', '高等専門学校'] };
    switch (type) {
      case 'gender': return GENDER_ALIASES[p.gender] || p.gender;
      case 'schoolType': return schoolTypeCands(p);
      case 'schoolEst': return p.schoolEst;
      case 'school': return section === 'hs' ? p.hsName : p.school;
      case 'hsname': return p.hsName;
      case 'course': return COURSE[p.schoolType];
      case 'bunri': return BUNRI_ALIASES[p.bunri] || p.bunri;
      case 'initial': return initialCands(section === 'hs' ? p.hsKana : p.schoolKana);
      case 'faculty': return section === 'hs' ? null : p.faculty;
      case 'department': return section === 'hs' ? (p.hsDept === 'その他' ? p.hsDeptOther : p.hsDept) : p.department;
      case 'keitou': return p.keitou;
      // 学校の所在地（都道府県・地方）
      case 'pref': return prefCands(section === 'hs' ? p.hsPref : (p.schoolPref || null));
    }
    return null;
  }

  // 休暇中連絡先の「現住所と同じ」チェックボックス
  function checkSameAsCurrent(p, state) {
    if (!p.vacSame || state.sameDone) return 0;
    for (const c of document.querySelectorAll('input[type=checkbox]')) {
      if (c.checked || c.disabled) continue;
      const a = anchorOf(c);
      const t = clean(`${labelText(c)} ${adjacentText(c, 1)} ${adjacentText(c, -1)} ${adjacentText(a, 1)} ${adjacentText(a, -1)}`);
      if (!/(現住所|現在の(連絡先|住所)|上記|本人).{0,6}(同じ|同一)|同上/.test(t)) continue;
      if (detectSection(baseInfo(c)) !== 'vac') continue;
      clickChoice(c);
      highlight(c.labels?.[0] || c);
      state.sameDone = true;
      return 1;
    }
    return 0;
  }

  // 検索ボタン（学校名の頭文字・高校名の一部の横にあるもの）。フォーム送信になるボタンは押さない
  const SEARCH_RE = /検索|search|探す|さがす|kensaku|srch/i;
  const searchText = (b) => [b.value, b.textContent, b.alt, b.title, b.getAttribute('aria-label'), b.getAttribute('src'),
    b.id, b.className, ...[...b.querySelectorAll('img')].map((i) => `${i.alt} ${i.getAttribute('src')}`)].join(' ');

  // 検索ボタン（学校名の頭文字・高校名の一部の横にあるもの）。
  // 文字のボタンのほか、画像ボタンや「検索」と書かれたリンクも探す。フォームを送信してしまうボタン・別ページへのリンクは押さない
  function findSearchButton(el) {
    // 入力欄から外側へ順に広げて探す。項目のまとまり（表の行・role=group など）より外には出ない
    const scopes = [];
    for (let a = el.parentElement, i = 0; a && i < 6 && !a.matches('form, body'); a = a.parentElement, i++) {
      scopes.push(a);
      if (a.matches('tr, li, dd, fieldset, [role=group], [role=radiogroup]')) break;
    }
    for (const scope of scopes) {
      const hit = [...scope.querySelectorAll('button, input[type=button], input[type=image], input[type=submit], a, img, [role=button], [onclick]')].find((b) => {
        if (b === el || !SEARCH_RE.test(searchText(b)) || !isVisible(b)) return false;
        if (b.tagName === 'BUTTON' && b.type === 'submit' && b.form && !b.hasAttribute('onclick')) return false;
        if (b.tagName === 'INPUT' && (b.type === 'submit' || b.type === 'image') && !b.hasAttribute('onclick')) return false;
        if (b.tagName === 'A' && b.getAttribute('href') && !/^(#|javascript:)/i.test(b.getAttribute('href'))) return false;
        if (b.tagName === 'IMG' && !b.closest('a, [onclick], [role=button]') && getComputedStyle(b).cursor !== 'pointer') return false;
        return true;
      });
      if (hit) return hit;
    }
    return null;
  }

  // 「同志社大学」「同志社大学（京都府）」のように、名前そのもの＋かっこ書き・都道府県だけのものを一致とみなす
  function sameSchoolName(text, want) {
    const t = norm(text);
    if (!t.startsWith(want)) return false;
    const rest = t.slice(want.length);
    return rest === '' || /^[（(【[<＜]/.test(rest) || PREFS.some((p) => rest.startsWith(p));
  }

  // 検索結果がリンクやリスト（ボタン状）で出るサイト用。名前が一致するものだけ押す
  // 学校検索用の小さいウィンドウ（i-web・e2r など）の中か。ここでは学校・学部・学科を選ぶ画面しか出ない
  const inSearchPopup = () => {
    try { return !!window.opener && window.opener !== window && /学校|学部|学科/.test(document.body.innerText.slice(0, 300)); } catch { return false; }
  };

  function clickResultItem(name, clicked) {
    if (!name) return false;
    const popup = inSearchPopup();
    const want = norm(name);
    for (const n of document.querySelectorAll('a, li, td, span, div, p, button, [role=option], [role=button]')) {
      if (clicked.has(n) || n.querySelector('a, li, td, div, p, button, input, select') || !sameSchoolName(n.textContent, want)) continue;
      const clickable = n.matches('a, button, [role=option], [role=button], [onclick]') || n.closest('a, [onclick], [role=option]') || getComputedStyle(n).cursor === 'pointer';
      if (!clickable || !isVisible(n)) continue;
      const a = n.closest('a');
      // 別ページへ移動するリンクは押さない（学校検索ウィンドウの中で、同じサイト内の次の画面へ進むリンクだけは押す）
      if (a?.getAttribute('href') && !/^(#|javascript:)/i.test(a.getAttribute('href')) && !(popup && a.origin === location.origin)) continue;
      clicked.add(n);
      safeClick(n);
      highlight(n);
      return true;
    }
    return false;
  }

  // 学校の所在地をまだ設定していない時は、「所在地を検索対象にする」のチェックを外す（頭文字だけで検索する）
  function uncheckLocationFilter(p, state) {
    if (p.schoolPref) return 0;
    for (const c of document.querySelectorAll('input[type=checkbox]')) {
      const a = anchorOf(c);
      const t = clean(`${labelText(c)} ${adjacentText(c, 1)} ${adjacentText(a, 1)}`);
      if (!(/所在地/.test(t) && /検索/.test(t))) continue;
      state.noLocation = true; // 所在地の選択肢は空のままでよい
      if (!c.checked || c.disabled) return 0;
      const fake = [...(c.parentElement?.children || [])].find((n) => n !== c && n.matches('a[class*="Checkbox"], a.jqTransformCheckbox'));
      if (fake) safeClick(fake);
      if (c.checked) c.click();
      return 1;
    }
    return 0;
  }

  // 採用サイト（i-web・snar・e2r・axol）の学校選択の画面で、全部選び終わったら「次へ」を押す。
  // 名前・住所・パスワードなどを入れる画面や、まだ選ばれていない項目がある画面では押さない
  const RECRUIT_SITE = /(^|\.)(i-webs|snar|e2r|axol)\.jp(\.localhost)?$/; // .localhost はこのパソコン内でのテスト用
  function autoNext(infos, state, options) {
    if (options.autoNext === false || !RECRUIT_SITE.test(location.hostname)) return 0;
    if (!state.selectedOnPage) return 0;
    const head = document.body.innerText.slice(0, 1500);
    if (!/学校|学部|学科|文理/.test(head)) return 0;
    if (document.querySelector('input[type=password]')) return 0;
    const PERSONAL = new Set(['name', 'email', 'tel', 'mobile', 'zip', 'pref', 'city', 'street', 'building', 'address', 'citystreet', 'streetbldg', 'birthday']);
    if (infos.some((x) => PERSONAL.has(x.type) && x.el.tagName !== 'SELECT' && x.el.type !== 'radio')) return 0;
    // 見えているラジオの組・プルダウンが全部選ばれているか（自分で選ぶ項目が残っていれば押さない）
    const check = () => {
      const groups = new Map();
      for (const r of document.querySelectorAll('input[type=radio]')) {
        if (r.disabled || !r.name || !(isVisible(r) || (r.parentElement && isVisible(r.parentElement)))) continue;
        const txt = clean(labelText(r) || adjacentText(r, 1) || adjacentText(anchorOf(r), 1));
        // 所在地を検索対象にしない時は、都道府県の選択肢は空でよい
        if (state.noLocation && (PREFS.includes(txt) || txt === 'その他')) continue;
        const g = groups.get(r.name) || { checked: false, first: txt };
        g.checked ||= r.checked;
        groups.set(r.name, g);
      }
      if ([...groups.values()].some((g) => !g.checked)) return null;
      if ([...document.querySelectorAll('select')].some((s) => isControlVisible(s) && !s.disabled && s.value === '')) return null;
      // 画面の見分け方：ラジオの組の名前と最初の選択肢（中身だけ入れ替わる snar でも別の画面と分かる）
      return [...groups.entries()].map(([n, g]) => `${n}:${g.first}`).join('|');
    };
    const key = check();
    if (!key || state.nextKey === key || state.nextPending) return 0;
    const btn = [...document.querySelectorAll('a, button, input[type=submit], input[type=button], input[type=image]')]
      .find((b) => /^次へ(進む)?[>＞》]?$/.test(clean(b.value || b.alt || b.textContent)) && isVisible(b));
    if (!btn) return 0;
    state.nextKey = key;
    state.nextPending = true;
    highlight(btn);
    // 選んだ内容が見えるよう少し待ってから押す。押す直前にもう一度、全部選ばれたままか確かめる
    setTimeout(() => {
      state.nextPending = false;
      try { if (btn.isConnected && check() === key) safeClick(btn); } catch { /* 画面が切り替わった */ }
    }, 1200);
    return 1;
  }

  // 1回分の入力処理。done: この実行中に入力した欄（同じ欄をくり返し書き換えないため）
  function runPass(profile, options, state) {
    let filled = checkSameAsCurrent(profile, state);

    const all = [...document.querySelectorAll(CONTROLS)]
      .filter((el) => !el.disabled && !el.readOnly && !(el.tagName === 'INPUT' && SKIP_INPUT_TYPES.has((el.type || 'text').toLowerCase())) && isControlVisible(el))
      .map(analyze);
    for (let i = 1; i < all.length; i++) {
      const x = all[i], pv = all[i - 1];
      if (pv.type && x.weak && joinedToPrev(x, pv)) {
        // 自分でも同じ種類と分かっていて「名」などの部分も判定できていれば、それは残す
        Object.assign(x, { type: pv.type, section: pv.section, kana: pv.kana, roma: pv.roma, hira: pv.hira, part: x.type === pv.type ? x.part : null });
      }
    }
    const infos = all.filter((x) => x.type && x.type !== 'ignore' && x.section !== 'skip'
      // 「内定者氏名」「紹介者」「指導教官メールアドレス」「保護者」など、自分以外の人についての欄には入れない
      && !OTHER_PERSON_RE.test(x.label + ' ' + x.header)
      // 「連絡先電話番号（海外）」「海外住所」など海外在住者向けの欄には入れない（「日本国外の場合は空欄」のような注意書きは対象外）
      && !/[（(](海外|国外)[）)]|海外(の)?(住所|電話|連絡先)|overseas/i.test(x.header + ' ' + x.label)
      // 自由記述欄（「大学で力を入れたこと」など）には住所以外入れない
      && (x.el.tagName !== 'TEXTAREA' || ADDRESS_TYPES.has(x.type)));

    const seen = { cur: {}, vac: {}, univ: {}, hs: {}, hasMobileField: infos.some((x) => x.type === 'mobile' && x.section === 'cur') };
    const key = (x) => `${x.section}|${x.type}|${x.kana}|${x.roma}`;

    for (let i = 0; i < infos.length;) {
      // 同じ行に並んだ同種の欄（郵便番号 3桁+4桁、電話番号 3分割、姓+名 など）をまとめる
      const g = [infos[i]];
      if (!infos[i].part) {
        while (i + g.length < infos.length) {
          const nx = infos[i + g.length];
          if (nx.part || key(nx) !== key(infos[i]) || nx.row !== infos[i].row) break;
          g.push(nx);
        }
      }
      i += g.length;

      let values;
      if (g[0].type === 'address') {
        values = addressGroupValues(g, profile, seen);
      } else {
        const split = g.length > 1 && DEFAULT_PARTS[g[0].type];
        if (split) g.forEach((x, k) => { x.part = split[k] ?? null; });
        values = g.map((x) => (split && x.part === null ? null : valueOf(x, profile, seen, g.length)));
      }
      g.forEach((x, k) => {
        if (!apply(x, values[k], options, state.done)) return;
        filled++;
        if (x.selectedNow) state.selectedOnPage = (state.selectedOnPage || 0) + 1;
      });
    }
    filled += uncheckLocationFilter(profile, state);
    filled += fillRadios(profile, state);
    filled += clickInitialButton(profile, state);

    // 学校名の頭文字・高校名の一部が入っていれば、その横の検索ボタンを押す（大学・高校それぞれ1回だけ）。
    // 前回の自動入力で頭文字だけ入っている場合も検索する。学校がすでに選ばれていれば押さない（選択が消えないように）
    for (const group of ['univ', 'hs']) {
      if (state.searched.has(group)) continue;
      const name = group === 'hs' ? profile.hsName : profile.school;
      const chosen = infos.some((x) => (x.section === 'hs') === (group === 'hs') && (x.type === 'school' || x.type === 'hsname')
        && x.el.tagName === 'SELECT' && x.el.value !== '' && name && sameSchoolName(x.el.selectedOptions[0]?.text || '', norm(name)));
      if (chosen) continue;
      const inputs = infos.filter((x) => (x.section === 'hs') === (group === 'hs') && (x.type === 'initial' || x.type === 'hsname')
        && x.el.tagName === 'INPUT' && x.el.value.trim() !== '');
      // 「高校名の一部」があればそちらで検索（頭文字より絞り込める）
      inputs.sort((a, b) => (b.type === 'hsname') - (a.type === 'hsname'));
      for (const x of inputs) {
        const btn = findSearchButton(x.el);
        if (!btn) continue;
        state.searched.add(group);
        safeClick(btn);
        break;
      }
    }
    // 検索結果がリストで出た場合
    const popup = inSearchPopup();
    if (state.searched.size || popup) {
      for (const [group, name] of [['univ', profile.school], ['hs', profile.hsName]]) {
        if ((state.searched.has(group) || popup) && !state.picked.has(group) && clickResultItem(name, state.clicked)) {
          state.picked.add(group);
          filled++;
        }
      }
    }
    // 学校検索ウィンドウで学部・学科などを選んだら、その画面の「選択」「決定」ボタンを押して次へ進む（1画面1回）
    if (popup && !state.confirmed) {
      const picked = infos.some((x) => ['school', 'faculty', 'department', 'facdept', 'hsname'].includes(x.type) && x.el.tagName === 'SELECT' && state.done.has(x.el) && x.el.value);
      const btn = picked && [...document.querySelectorAll('input[type=submit], input[type=button], button')]
        .find((b) => /^(選\s*択|決\s*定|確\s*定)$/.test(clean(b.value || b.textContent)) && isVisible(b));
      if (btn) {
        state.confirmed = true;
        setTimeout(() => { try { if (btn.isConnected) safeClick(btn); } catch { /* 画面が切り替わった */ } }, 600); // 選んだ内容が見えるよう、少し待ってから押す
        filled++;
      }
    }
    filled += autoNext(infos, state, options);
    return filled;
  }

  // 学校検索の結果や、年を選ぶと選べるようになる月・学校を選ぶと出てくる学部など、
  // 後から現れる欄に対応するため、ページの変化が落ち着くまで少しずつ繰り返す
  function withDefaults(p) {
    p = { ...p };
    if (!p.schoolType && p.school) {
      p.schoolType = /大学院|研究科/.test(p.school) ? '大学院' : /高等専門学校|高専/.test(p.school) ? '高等専門学校' : /大学/.test(p.school) ? '大学' : '';
    }
    if (!p.bunri && p.faculty) {
      // 「心理」「経理」「管理」「地理」の「理」で理系と判断しないよう、文系の言葉を先に見る
      if (/文|法|経済|経営|商|社会|国際|教育|外国語|人間|心理|政策|観光|神学|福祉|芸術|コミュニケーション/.test(p.faculty)) p.bunri = '文系';
      else if (/理学|理工|工学|医|歯|薬|農|看護|情報|保健|獣医|生命|環境|数理|物理|化学|生物|建築/.test(p.faculty)) p.bunri = '理系';
    }
    return p;
  }

  // 学校検索の結果や、年を選ぶと選べるようになる月・学校を選ぶと出てくる学部など、
  // 後から現れる欄に対応するため、ページの変化が落ち着くまで少しずつ繰り返す。
  // さらにその後も約90秒間は画面の変化を見守り、「次へ」で次の選択肢（学部・文理区分など）が出たらそれも選ぶ
  const WATCH_MS = 90000;
  window.__shukatsuFill = async (profile, options = {}) => {
    profile = withDefaults(profile);
    window.__shukatsuStop?.(); // 前回の見守りは終了
    let stopped = false;
    window.__shukatsuStop = () => { stopped = true; };
    const state = { done: new Map(), searched: new Set(), picked: new Set(), clicked: new WeakSet(), radioDone: new WeakSet() };
    let changed = false;
    const obs = new MutationObserver(() => { changed = true; });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'style', 'class', 'hidden'] });
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    let filled = runPass(profile, options, state);
    for (let round = 0, idle = 0; round < 24 && idle < 4 && !stopped; round++) {
      changed = false;
      await sleep(500);
      const n = runPass(profile, options, state);
      filled += n;
      idle = n || changed ? 0 : idle + 1;
    }

    // 見守り（結果は先に返す）。ページを移動したらこのスクリプトごと終わる
    (async () => {
      const until = Date.now() + WATCH_MS;
      while (!stopped && Date.now() < until) {
        await sleep(700);
        if (!changed) continue;
        changed = false;
        try { runPass(profile, options, state); } catch { /* 画面の切り替え中は次の回でやり直す */ }
      }
      obs.disconnect();
    })();
    return { filled };
  };
  // 診断用：ページ内の欄・ボタンの作りと判定結果を文字にする。入力済みの値（value）は含めない
  window.__shukatsuFill.diagnose = () => {
    const short = (s, n = 40) => clean(s).slice(0, n);
    const path = (el) => {
      const out = [];
      for (let a = el.parentElement, i = 0; a && i < 3 && a !== document.body; a = a.parentElement, i++) {
        out.push(a.tagName.toLowerCase() + (a.classList.length ? '.' + [...a.classList].slice(0, 2).join('.') : ''));
      }
      return out.join('<');
    };
    const lines = [`URL: ${location.origin}${location.pathname}${window === top ? '' : ' (iframe)'}`];
    const els = document.querySelectorAll('input, select, textarea, button, a, img, [onclick], [role=button]');
    for (const el of els) {
      const isCtl = el.matches(CONTROLS);
      if (isCtl && el.type === 'hidden') continue;
      if (!isCtl && !el.matches('button, input') && !SEARCH_RE.test(searchText(el))) continue;
      if (lines.length > 400) { lines.push('…（多いため省略）'); break; }
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      let line = `${el.tagName.toLowerCase()}${el.type ? '[' + el.type + ']' : ''} name=${el.getAttribute('name') || ''} id=${el.id || ''}`
        + `${el.disabled ? ' 無効' : ''}${el.readOnly ? ' 読取専用' : ''}`
        + ` 表示=${isControlVisible(el) ? 'o' : 'x'}(${Math.round(r.width)}x${Math.round(r.height)} op${cs.opacity} ${cs.display})`
        + ` 親=${path(el)}`;
      if (isCtl) {
        const x = analyze(el);
        line += ` | 判定=${x.type || '-'}/${x.section}/${x.part ?? '-'}${x.kana ? '/カナ' : ''}`
          + ` 前="${short(x.prev)}" 後="${short(x.next)}" ラベル="${short(x.label)}" 見出し="${short(x.header)}" ph="${short(el.getAttribute('placeholder'))}"`;
        if (el.tagName === 'SELECT') {
          const o = [...el.options].map((op) => short(op.text, 20));
          line += ` 選択肢${o.length}件: ${o.length > 6 ? [...o.slice(0, 5), '…', o[o.length - 1]].join(' / ') : o.join(' / ')}`;
        }
        if (el.type === 'radio' || el.type === 'checkbox') line += ` 選択肢名="${short(labelText(el) || adjacentText(el, 1))}"`;
      } else {
        line += ` | 文字="${short(searchText(el), 60)}" onclick=${el.hasAttribute('onclick') ? 'あり' : 'なし'} href=${short(el.getAttribute('href') || '', 30)}`;
      }
      lines.push(line);
    }
    return lines.join('\n');
  };
  // デバッグ用: 開発者ツールで __shukatsuFill.analyze($0) とすると項目の判定結果を確認できる
  window.__shukatsuFill.analyze = analyze;
})();
