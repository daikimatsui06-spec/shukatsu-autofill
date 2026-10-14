// ポップアップとショートカット（background）の両方から使う入力処理
export async function fillTab(tabId, url) {
  const { profile, options = {} } = await chrome.storage.local.get(['profile', 'options']);
  if (!profile) throw new Error('NO_PROFILE');

  // このタブでは30分間、ページが切り替わっても続けて入力してよい（background.js が使う）。
  // 入力が終わる前にポップアップが閉じても記録が残るよう、入力より先に保存する
  if (!url) url = (await chrome.tabs.get(tabId).catch(() => null))?.url;
  const site = siteOf(url);
  if (site) await chrome.storage.session.set({ [`cont_${tabId}`]: { until: Date.now() + CONTINUE_MS, site } }).catch(() => {});

  const run = async (target) => {
    await chrome.scripting.executeScript({ target, files: ['content.js'] });
    return chrome.scripting.executeScript({
      target,
      func: (p, o) => window.__shukatsuFill(p, o),
      args: [profile, options],
    });
  };

  let results;
  try {
    results = await run({ tabId, allFrames: true });
  } catch {
    // 別ドメインの iframe などで失敗した場合はメインフレームだけで再試行
    results = await run({ tabId });
  }
  return results.reduce((n, r) => n + (r.result?.filled || 0), 0);
}

// 最初の画面で内容を確認してから「次へ」を押すまで時間がかかってもよいよう、30分（画面が進むたびに延長）
export const CONTINUE_MS = 30 * 60 * 1000;
// 「次へ」でページごと切り替わる採用サイト。ここだけは、許可をもらえば次の画面でも続けて入力する
export const CONTINUE_ORIGINS = ['https://*.i-webs.jp/*', 'https://*.snar.jp/*', 'https://*.e2r.jp/*', 'https://*.axol.jp/*'];
export const CONTINUE_SITES = ['i-webs.jp', 'snar.jp', 'e2r.jp', 'axol.jp'];
const siteOf = (u) => {
  try { const h = new URL(u).hostname; return CONTINUE_SITES.find((x) => h === x || h.endsWith('.' + x)) || null; } catch { return null; }
};

// うまく入らない時の調査用。欄の作りだけを集める（入力値・プロフィールは含めない）
export async function diagnoseTab(tabId) {
  const run = async (target) => {
    await chrome.scripting.executeScript({ target, files: ['content.js'] });
    return chrome.scripting.executeScript({ target, func: () => window.__shukatsuFill.diagnose() });
  };
  let results;
  try {
    results = await run({ tabId, allFrames: true });
  } catch {
    results = await run({ tabId });
  }
  return results.map((r) => r.result).filter(Boolean).join('\n\n');
}
