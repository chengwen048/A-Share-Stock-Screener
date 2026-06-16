const refreshButton = document.querySelector('#refreshButton');
const applyButton = document.querySelector('#applyButton');
const dataState = document.querySelector('#dataState');
const stockDataDate = document.querySelector('#stockDataDate');
const updatedAt = document.querySelector('#updatedAt');
const expiresAt = document.querySelector('#expiresAt');
const scannedCount = document.querySelector('#scannedCount');
const matchedCount = document.querySelector('#matchedCount');
const activeConditionCount = document.querySelector('#activeConditionCount');
const apiKeyStatus = document.querySelector('#apiKeyStatus');
const sourceText = document.querySelector('#sourceText');
const tushareHttpUrl = document.querySelector('#tushareHttpUrl');
const universeStatus = document.querySelector('#universeStatus');
const localCacheStatus = document.querySelector('#localCacheStatus');
const resultNote = document.querySelector('#resultNote');
const warningBox = document.querySelector('#warningBox');
const resultsBody = document.querySelector('#resultsBody');
const nearMissBody = document.querySelector('#nearMissBody');
const incompleteBody = document.querySelector('#incompleteBody');
const conditionList = document.querySelector('#conditionList');

let conditionDefinitions = [];

function formatNumber(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return number.toLocaleString('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
}

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  const abs = Math.abs(number);
  if (abs >= 100000000) return `${formatNumber(number / 100000000, 2)} 亿`;
  if (abs >= 10000) return `${formatNumber(number / 10000, 2)} 万`;
  return formatNumber(number, 0);
}

function formatPercentRatio(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return `${formatNumber(number * 100, 1)}%`;
}

function formatTradeDateChina(value) {
  const text = String(value ?? '');
  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}年${text.slice(4, 6)}月${text.slice(6, 8)}日`;
  }
  return '-';
}

function stockCode(stock) {
  return stock.ts_code ?? `${stock.code}.${stock.exchange}`;
}

function emptyRow(colspan, text) {
  return `<tr><td colspan="${colspan}" class="empty">${text}</td></tr>`;
}

function paramsToHtml(condition) {
  if (!condition.params?.length) return '';
  return `<div class="param-grid">
    ${condition.params
      .map((param) => {
        if (param.type === 'select') {
          return `<label>${param.label}<select data-param="${param.key}">
            ${(param.options ?? [])
              .map((option) => `<option value="${option.value}"${param.value === option.value ? ' selected' : ''}>${option.label}</option>`)
              .join('')}
          </select></label>`;
        }
        if (param.type === 'money') {
          return `<label>${param.label}<select data-param="${param.key}">
            <option value="50000000"${param.value === 50000000 ? ' selected' : ''}>5000 万</option>
            <option value="100000000"${param.value === 100000000 ? ' selected' : ''}>1 亿</option>
            <option value="300000000"${param.value === 300000000 ? ' selected' : ''}>3 亿</option>
            <option value="1000000000"${param.value === 1000000000 ? ' selected' : ''}>10 亿</option>
            <option value="30000000000"${param.value === 30000000000 ? ' selected' : ''}>300 亿</option>
          </select></label>`;
        }
        return `<label>${param.label}<input data-param="${param.key}" type="number" value="${param.value}" step="${param.step ?? 1}" /></label>`;
      })
      .join('')}
  </div>`;
}

function renderConditions() {
  const groups = [...new Set(conditionDefinitions.map((condition) => condition.group ?? '其他'))];
  conditionList.innerHTML = groups
    .map((group) => {
      const cards = conditionDefinitions
        .filter((condition) => (condition.group ?? '其他') === group)
        .map(
          (condition) => `<article class="condition-card" data-condition="${condition.key}">
        <label class="condition-toggle">
          <input type="checkbox" ${condition.defaultEnabled ? 'checked' : ''} />
          <span>
            <strong>${condition.label}</strong>
            <small>${condition.description}</small>
          </span>
        </label>
        ${paramsToHtml(condition)}
      </article>`
        )
        .join('');
      return `<section class="condition-group"><h3>${group}</h3><div class="condition-grid-inner">${cards}</div></section>`;
    })
    .join('');
}

function selectedConditions() {
  return conditionDefinitions.map((definition) => {
    const card = conditionList.querySelector(`[data-condition="${definition.key}"]`);
    const params = {};
    card?.querySelectorAll('[data-param]').forEach((input) => {
      const rawValue = input.value;
      params[input.dataset.param] = Number.isFinite(Number(rawValue)) && rawValue.trim() !== '' ? Number(rawValue) : rawValue;
    });
    return {
      key: definition.key,
      enabled: Boolean(card?.querySelector('input[type="checkbox"]')?.checked),
      params
    };
  });
}

function failedLabels(row) {
  return (row.failedKeys ?? [])
    .map((key) => conditionDefinitions.find((condition) => condition.key === key)?.label ?? key)
    .join('、');
}

function renderResults(rows) {
  if (!rows.length) {
    resultsBody.innerHTML = emptyRow(8, '当前条件下没有命中的股票。');
    return;
  }

  resultsBody.innerHTML = rows
    .map(({ stock, metrics }) => {
      return `<tr>
        <td><span class="code">${stockCode(stock)}</span></td>
        <td>
          <div class="stack">
            <strong>${stock.name}</strong>
            <span class="muted">${metrics.tradeDate}</span>
          </div>
        </td>
        <td>
          <div class="stack">
            <strong>${formatNumber(metrics.close)}</strong>
            <span class="${metrics.pctChange >= 0 ? 'positive' : 'negative'}">${formatNumber(metrics.pctChange)}%</span>
          </div>
        </td>
        <td>
          <div class="stack">
            <span>MA5 ${formatNumber(metrics.ma5)}</span>
            <span>MA10 ${formatNumber(metrics.ma10)} / MA20 ${formatNumber(metrics.ma20)}</span>
            <span>MA60 ${formatNumber(metrics.ma60)} / MA250 ${formatNumber(metrics.ma250)}</span>
          </div>
        </td>
        <td>
          <div class="stack">
            <span>今 ${formatNumber(metrics.todayVolumeRatio)} 倍</span>
            <span>昨 ${formatNumber(metrics.yesterdayVolumeRatio)} 倍</span>
            <span>CV ${formatNumber(metrics.volumeCv20BeforeBreakout, 3)}</span>
          </div>
        </td>
        <td>
          <div class="stack">
            <span>今 ${formatPercentRatio(metrics.todayUpperShadowRatio)}</span>
            <span>昨 ${formatPercentRatio(metrics.yesterdayUpperShadowRatio)}</span>
          </div>
        </td>
        <td>
          <div class="stack">
            <span class="${metrics.todayMainNetInflow >= 0 ? 'positive' : 'negative'}">今 ${formatMoney(metrics.todayMainNetInflow)}</span>
            <span class="${metrics.yesterdayMainNetInflow >= 0 ? 'positive' : 'negative'}">昨 ${formatMoney(metrics.yesterdayMainNetInflow)}</span>
            <span>占比 ${formatNumber(metrics.todayMainMoneyRatio)}%</span>
          </div>
        </td>
        <td>
          <div class="stack">
            <span>成交额 ${formatMoney(metrics.amount)}</span>
            <span>换手 ${formatNumber(metrics.turnover)}%</span>
            <span>流通市值 ${formatMoney(metrics.floatMarketCap)}</span>
          </div>
        </td>
      </tr>`;
    })
    .join('');
}

function renderNearMisses(rows) {
  if (!rows.length) {
    nearMissBody.innerHTML = emptyRow(5, '暂无接近命中数据。');
    return;
  }

  nearMissBody.innerHTML = rows
    .map(({ stock, passCount, metrics, activeConditionCount: rowConditionCount, failedKeys, ...row }) => {
      const total = Object.keys(row.checks ?? {}).length || rowConditionCount || 0;
      return `<tr>
        <td><span class="code">${stockCode(stock)}</span></td>
        <td>${stock.name}</td>
        <td>${passCount}/${total}</td>
        <td class="danger">${failedLabels({ failedKeys }) || '-'}</td>
        <td>
          <div class="stack">
            <span>收盘 ${formatNumber(metrics.close)}，MA250 ${formatNumber(metrics.ma250)}</span>
            <span>量比 今 ${formatNumber(metrics.todayVolumeRatio)} / 昨 ${formatNumber(metrics.yesterdayVolumeRatio)}</span>
            <span>主力 今 ${formatMoney(metrics.todayMainNetInflow)} / 昨 ${formatMoney(metrics.yesterdayMainNetInflow)}</span>
          </div>
        </td>
      </tr>`;
    })
    .join('');
}

function renderIncomplete(rows) {
  if (!rows.length) {
    incompleteBody.innerHTML = emptyRow(6, '没有缺少历史数据的股票。');
    return;
  }

  incompleteBody.innerHTML = rows
    .map(({ stock, historyBars, latestTradeDate, missingBars, reason }) => `<tr>
      <td><span class="code">${stockCode(stock)}</span></td>
      <td>${stock.name}</td>
      <td>${historyBars}</td>
      <td>${latestTradeDate ?? '-'}</td>
      <td>${missingBars}</td>
      <td class="danger">${reason}</td>
    </tr>`)
    .join('');
}

function renderPayload(payload) {
  const cache = payload.localCache;
  const status = payload.dataStatus ?? {};
  dataState.textContent = status.label ?? (cache ? '快照已加载' : '等待数据');
  stockDataDate.textContent = cache?.latestTradeDateChina ?? formatTradeDateChina(cache?.latestTradeDate) ?? '等待数据';
  updatedAt.textContent = payload.updatedAtChina ?? '正在更新';
  expiresAt.textContent = payload.expiresAtChina ?? '-';
  scannedCount.textContent = `${payload.evaluatedCount ?? 0} / ${payload.incompleteCount ?? 0} / ${payload.stockCount ?? payload.candidateCount ?? 0}`;
  matchedCount.textContent = String(payload.matchedCount ?? 0);
  activeConditionCount.textContent = `${payload.activeConditionCount ?? 0} 个`;
  apiKeyStatus.textContent = payload.tushareTokenConfigured ? '已配置' : '未配置';
  apiKeyStatus.className = payload.tushareTokenConfigured ? '' : 'danger';
  sourceText.textContent = payload.source ?? '-';
  tushareHttpUrl.textContent = payload.tushareHttpUrl ?? 'http://8.148.76.181:8686/';
  universeStatus.textContent = payload.universeComplete
    ? `完整全市场：${payload.totalAshareCount ?? payload.stockCount ?? 0} 只`
    : `兜底样本：${payload.stockCount ?? payload.candidateCount ?? 0} / ${payload.totalAshareCount ?? '-'} 只`;
  universeStatus.className = payload.universeComplete ? 'positive' : 'danger';
  localCacheStatus.textContent = cache
    ? `更新至 ${cache.latestTradeDateChina ?? formatTradeDateChina(cache.latestTradeDate)}，${cache.historyDays} 日历史`
    : '正在建立';
  resultNote.textContent = payload.refreshJob?.running
    ? `${status.label ?? '后台更新中'}，启动于 ${payload.refreshJob.startedAtChina}`
    : `${status.detail ?? '缓存内筛选，历史数据持续保留'}`;
  if (status.lastError) {
    warningBox.hidden = false;
    warningBox.textContent = `${status.label ?? '数据更新异常'}：${status.lastError}`;
  }

  const errors = payload.errors?.length ? `部分股票评估失败：${payload.errors.join('；')}` : '';
  const warningText = [payload.warning, errors].filter(Boolean).join('。');
  warningBox.hidden = !warningText;
  warningBox.textContent = warningText;
  renderResults(payload.results ?? []);
  renderNearMisses(payload.nearMisses ?? []);
  renderIncomplete(payload.incompleteRows ?? []);
}

async function applyScreen() {
  applyButton.disabled = true;
  applyButton.textContent = '筛选中...';
  const params = new URLSearchParams({ conditions: JSON.stringify(selectedConditions()) });
  try {
    const response = await fetch(`/api/screen?${params}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || '筛选失败');
    renderPayload(payload);
  } catch (error) {
    warningBox.hidden = false;
    warningBox.textContent = error.message;
  } finally {
    applyButton.disabled = false;
    applyButton.textContent = '应用筛选';
  }
}

async function refreshData() {
  refreshButton.disabled = true;
  refreshButton.textContent = '更新中...';
  warningBox.hidden = false;
  warningBox.textContent = '后台正在补充 Tushare 最新数据，已有快照会继续保留。';
  try {
    await fetch('/api/refresh', { method: 'POST' });
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await applyScreen();
      if (!resultNote.textContent.includes('增量更新中') && !resultNote.textContent.includes('首次加载中')) break;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = '增量更新';
  }
}

async function init() {
  const response = await fetch('/api/conditions');
  const payload = await response.json();
  conditionDefinitions = payload.conditions ?? [];
  renderConditions();
  await applyScreen();
}

applyButton.addEventListener('click', applyScreen);
refreshButton.addEventListener('click', refreshData);
conditionList.addEventListener('change', () => {
  activeConditionCount.textContent = `${selectedConditions().filter((condition) => condition.enabled).length} 个`;
});

init();
