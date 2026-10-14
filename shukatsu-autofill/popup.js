import { fillTab, diagnoseTab, CONTINUE_ORIGINS } from './runner.js';

const status = document.getElementById('status');
const onlyEmpty = document.getElementById('onlyEmpty');

const show = (msg, err = false) => {
  status.textContent = msg;
  status.className = err ? 'err' : '';
};

const { options = {} } = await chrome.storage.local.get('options');
onlyEmpty.checked = options.onlyEmpty !== false;
onlyEmpty.addEventListener('change', () => {
  options.onlyEmpty = onlyEmpty.checked;
  chrome.storage.local.set({ options });
});

// 「次へ」で画面が切り替わっても・別ウィンドウが開いても続ける（初期設定はオン。採用サイト4つだけで動く）
const continueAcross = document.getElementById('continueAcross');
const manifestReady = CONTINUE_ORIGINS.every((o) => (chrome.runtime.getManifest().host_permissions || []).includes(o));
continueAcross.checked = options.continueAcross !== false;
if (!manifestReady) show('拡張機能が更新されていません。chrome://extensions でこの拡張機能の更新ボタン（↻）を押してから、もう一度開いてください', true);
continueAcross.addEventListener('change', () => {
  options.continueAcross = continueAcross.checked;
  chrome.storage.local.set({ options });
});

document.getElementById('settings').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

document.getElementById('diagnose').addEventListener('click', async (e) => {
  e.preventDefault();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const text = await diagnoseTab(tab.id);
    await navigator.clipboard.writeText(text);
    show('診断情報をコピーしました（入力した値は含まれていません）');
  } catch (err) {
    show('診断できませんでした: ' + err.message, true);
  }
});

document.getElementById('fill').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  show('入力中…（学校の検索結果などを待っています）');
  try {
    const n = await fillTab(tab.id, tab.url);
    show((n ? `${n} 項目を入力しました（緑枠の項目）。` : '今の画面には入力できる項目がありませんでした。')
      + (continueAcross.checked
        ? '「次へ」を押して次の画面に移っても、30分間は続けて自動で入力・選択します。'
        : '同じ画面の中で次の選択肢が出てきたら、約1分半のあいだ続けて選びます。'));
  } catch (e) {
    if (e.message === 'NO_PROFILE') show('先に「プロフィールを編集」から情報を登録してください', true);
    else show('このページでは実行できません: ' + e.message, true);
  }
});
