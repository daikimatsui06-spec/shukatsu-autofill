import { fillTab, CONTINUE_MS, CONTINUE_SITES } from './runner.js';

// アイコンに件数を少しの間表示する（その間にタブが閉じられても、エラーにしない）
const badge = (tabId, text) => {
  chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {}), 4000);
};

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== 'fill-form' || !tab?.id) return;
  fillTab(tab.id, tab.url)
    .then((n) => badge(tab.id, String(n)))
    .catch((e) => {
      if (e?.message === 'NO_PROFILE') chrome.runtime.openOptionsPage().catch(() => {});
      badge(tab.id, '!');
    });
});

// 採用サイト（i-web・snar・e2r・axol）のどれか。そのサイト名を返す
const siteOf = (url) => {
  try { const h = new URL(url).hostname; return CONTINUE_SITES.find((s) => h === s || h.endsWith('.' + s)) || null; } catch { return null; }
};

// 「次へ」でページごと切り替わる・学校検索が別ウィンドウで開くサイト用：
// 直前に自動入力した（30分以内）のと同じ採用サイトの画面が開いたら、続けて入力する。
// 自動入力したタブ・そこから開いたウィンドウだけが対象（別の時に自分で開いたタブには入れない）
chrome.tabs.onUpdated.addListener((tabId, info, tab) => { continueFill(tabId, info, tab).catch(() => {}); });
async function continueFill(tabId, info, tab) {
  if (info.status !== 'complete') return;
  const site = siteOf(tab.url);
  if (!site) return;
  const { options = {} } = await chrome.storage.local.get('options');
  if (options.continueAcross === false) return; // 初期設定はオン（ポップアップでオフにできる）
  const all = await chrome.storage.session.get(null);
  const now = Date.now();
  const mine = all[`cont_${tabId}`];
  // このタブの記録がなくても、同じサイトで30分以内に自動入力していて、このタブがそこから開かれたものなら引き継ぐ
  const fromOpener = tab.openerTabId && all[`cont_${tab.openerTabId}`];
  const rec = [mine, fromOpener].find((r) => r && r.until > now && r.site === site);
  if (!rec) return;
  try {
    const n = await fillTab(tabId, tab.url);
    badge(tabId, String(n));
  } catch {
    // 入力できないページ
  }
}

// 学校検索などの別ウィンドウ：自動入力したタブから開かれたら、その記録を引き継ぐ
chrome.tabs.onCreated.addListener((tab) => {
  (async () => {
    if (!tab.openerTabId || !tab.id) return;
    const key = `cont_${tab.openerTabId}`;
    const { [key]: rec } = await chrome.storage.session.get(key);
    if (rec && rec.until > Date.now()) await chrome.storage.session.set({ [`cont_${tab.id}`]: { ...rec, until: Date.now() + CONTINUE_MS } });
  })().catch(() => {});
});

chrome.tabs.onRemoved.addListener((tabId) => { chrome.storage.session.remove(`cont_${tabId}`).catch(() => {}); });

// 入力処理（content.js）からの依頼で、「javascript:〜」のリンク（i-web の「次へ」など）をページ自身の中で押す。
// 拡張機能の中から押すと Chrome の安全ルール（CSP）で止められるため、ページ側（MAIN world）で押す
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== 'mainClick' || !sender.tab?.id || typeof msg.id !== 'string') return;
  chrome.scripting.executeScript({
    target: { tabId: sender.tab.id, frameIds: [sender.frameId ?? 0] },
    world: 'MAIN',
    func: (id) => {
      const el = document.querySelector(`[data-shukatsu-click="${CSS.escape(id)}"]`);
      if (!el) return;
      el.removeAttribute('data-shukatsu-click');
      el.click();
    },
    args: [msg.id],
  }).catch(() => {});
});
