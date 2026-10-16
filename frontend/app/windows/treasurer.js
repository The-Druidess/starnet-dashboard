/* The treasury adviser never owns or overrides the independent financial gate. */
'use strict';
const TreasurerPortal = (() => {
  const avatarId = 'portal-treasurer';
  const capKeys = ['perRun', 'perAgent', 'perDay', 'global'];
  const crewEntry = { id: avatarId, name: 'TREASURER', color: '#d9b65c', open: () => openFor(avatarId) };
  let unsubscribe = null;
  let monitorTimer = null, liveStatus = null, liveAt = 0, liveError = null, reading = false;

  function isPortal(id) { return id === avatarId; }
  function adviser() {
    return typeof App !== 'undefined' && App.agents ? App.agents().find(a => a.id === avatarId) : null;
  }
  function hasDesk(station) {
    return station.props().some(p => p.agentId === avatarId && station.capForProp(p.t) === 'computer');
  }
  function sync(station) {
    const available = hasDesk(station);
    const agent = adviser();
    StationUI.setCrewPortals(available && !agent ? [crewEntry] : []);
    if (agent) {
      World.spawnAgent(agent, { atWorkstation: true });
    } else if (available) {
      World.spawnAgent({ id: avatarId, name: 'TREASURER', color: '#d9b65c', skin: DATA.DEFAULT_SKIN }, { atWorkstation: true });
    } else {
      World.despawnAgent(avatarId);
    }
  }
  function init(station) {
    if (unsubscribe) unsubscribe();
    sync(station);
    unsubscribe = station.onChange(() => sync(station));
    if (monitorTimer) clearInterval(monitorTimer);
    refreshStatus();
    monitorTimer = setInterval(refreshStatus, 5000);
  }
  function openFor(id) {
    if (!isPortal(id)) return false;
    const i = typeof App !== 'undefined' ? App.agents().findIndex(a => a.id === id) : -1;
    if (i >= 0) StationUI.openAgent(i);
    else StationUI.openTerm('treasurer');
    return true;
  }
  function officerStatus(id) {
    if (!isPortal(id)) return null;
    if (liveError || (liveAt && Date.now() - liveAt > 15000)) return 'UNAVAILABLE';
    if (!liveStatus) return 'CHECKING';
    return liveStatus.enforcement?.state || 'UNKNOWN';
  }
  function crewOrder(roster) {
    const ordered = roster.map((a, i) => ({ a, i }));
    const index = ordered.findIndex(entry => isPortal(entry.a.id));
    const station = typeof App !== 'undefined' && App.station ? App.station() : null;
    if (index < 0 || !station?.props || !station.roomAt || !station.capForProp) return ordered;
    const props = station.props();
    // agentRoomId is a bay-capability seam; this officer needs no workflow bay.
    const roomOf = id => {
      const desk = props.find(p => p.agentId === id && station.capForProp(p.t) === 'computer');
      return desk ? station.roomAt(desk.x, desk.y) : station.agentRoomId?.(id);
    };
    const room = roomOf(avatarId);
    if (!room) return ordered;
    const [treasurer] = ordered.splice(index, 1);
    let after = -1;
    ordered.forEach((entry, i) => { if (roomOf(entry.a.id) === room) after = i; });
    ordered.splice(after < 0 ? index : after + 1, 0, treasurer);
    return ordered;
  }
  async function activateAdviser() {
    if (adviser()) return adviser();
    await refreshStatus();
    if (!liveStatus?.enabled || liveStatus.error || !liveStatus.localModels?.includes('qwen3.5:4b')) {
      throw new Error('Treasurer adviser requires the verified local qwen3.5:4b finance policy.');
    }
    const a = App.summonAgent({
      id: avatarId, agentName: 'TREASURER', name: 'Treasurer',
      persona: 'professional', skin: DATA.DEFAULT_SKIN,
      modelPin: { model: 'qwen3.5:4b', provider: 'ollama', effort: 'low' },
      purpose: 'Advise on treasury matters, explain live financial gate decisions and shared station budgets, and help the Bridge diagnose financial refusals. Deterministic server enforcement is independent of this adviser.',
      manual: [
        'You are TREASURER, the treasury adviser. Respond only to treasury, budgets, financial controls, and related operational questions. Redirect unrelated tasks to NUMBER TWO.',
        'Use the server-supplied TREASURY SNAPSHOT or treasury.status for current facts. Never invent activity, income, records, or reservations. Never claim to poll, watch, or work between requests.',
        'The deterministic gate filters execution before dispatch even while you are idle. You cannot authorize payments, change protected limits, bypass refusals, retry denied paid calls, or control external invoices.',
        'Shared USD ceilings: $50/calendar day, $500/Monday-Sunday week, $1000/calendar month in America/Phoenix, all apply together. These are not independent allowances for each agent or workstation.',
        'Current admission is stricter: paid/unknown-cost operations including Claude CLI remain blocked because guaranteed billed-charge adapters and paid reservations are unavailable. Only approved local operations are admitted.',
        'Existing subscriptions, manual purchases, taxes/adjustments and other applications are outside this runtime gate. Etsy/Shopify income, fulfillment expenses, and fees are not connected. Missing data is UNKNOWN, not zero.',
        'Keep treasury notes in the normal memory system when approved. Tone and appearance never change financial authority. Never initiate purchases, publishing, background loops or delegation. Give concise, factual answers.'
      ].join('\n'),
    }, { activate: false });
    if (!a || a.id !== avatarId) throw new Error('Could not create the Treasurer adviser with the reserved identity.');
    StationUI.setCrewPortals([]);
    World.setSkin(a.id, a.skin);
    if (await App.configSynced() === false) throw new Error('Treasurer exists locally but the server roster sync failed. Retry saving before using COMMS.');
    return a;
  }
  function enforcementText() {
    if (!liveStatus || liveError) return 'Financial gate status unavailable: ' + (liveError || 'checking the server');
    const audit = liveStatus.enforcement?.audit;
    return 'Gate: ' + officerStatus(avatarId) + '\n' +
      'Independent deterministic pre-dispatch filter. The AI adviser cannot bypass it.\n' +
      (liveStatus.enabled ? 'Paid/unknown-cost actions remain BLOCKED. No positive-cost reservation adapter is enabled.\n'
        : 'WARNING: strict finance is DISABLED; the legacy governor is not a guaranteed precharge limit.\n') +
      'Policy: $50/calendar day, $500/Monday-Sunday week, $1000/calendar month; America/Phoenix.\n' +
      'Last server read: ' + new Date(liveAt).toLocaleString() + '\n' +
      (audit?.durable ? 'Durable decisions: ' + audit.counts.allowed + ' allowed / ' + audit.counts.blocked + ' blocked.\n' +
        'Counts are gate checks, not transactions or AI work/XP.' : 'Audit: UNAVAILABLE - ' + (audit?.error || 'not reported')) +
      (audit?.recent?.length ? '\nLatest check: ' + (() => {
        const r = audit.recent[audit.recent.length - 1];
        return new Date(r.at).toLocaleString() + ' | ' + r.decision.toUpperCase() + ' | ' + r.surface + ' | ' + r.operation;
      })() : '') +
      (liveStatus.error ? '\nPolicy error: ' + liveStatus.error : '') +
      (liveStatus.accountingKnown ? '\nRecorded calendar spend: ' + ['day', 'week', 'month'].map(k =>
        k + ' $' + liveStatus.periods[k].spent.toFixed(2) + ' / $' + liveStatus.periods[k].cap.toFixed(2)).join('; ')
        : '\nCalendar accounting: UNKNOWN - ' + (liveStatus.accountingError || 'not verified'));
  }
  function paintStatus() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('[data-treasury-live]').forEach(el => { el.textContent = enforcementText(); });
    document.querySelectorAll('[data-treasury-record]').forEach(el => {
      const audit = liveStatus?.enforcement?.audit;
      el.textContent = audit?.durable
        ? (audit.recent.slice().reverse().map(r => new Date(r.at).toLocaleString() + ' | ' + r.decision.toUpperCase() + ' | ' + r.surface + ' | ' + r.operation).join('\n') || 'No gate decisions recorded yet.')
        : 'Audit unavailable; no financial history can be certified.';
    });
    StationUI.refreshCrew();
  }
  async function refreshStatus() {
    if (reading) { paintStatus(); return; }
    reading = true;
    try {
      const value = await Harness.api.get('/api/finance/strict');
      const audit = value?.enforcement?.audit;
      if (!value || typeof value.enabled !== 'boolean' || !value.enforcement
          || !['GUARDING', 'LOCKED', 'DEGRADED', 'DISABLED'].includes(value.enforcement.state)
          || (!value.enabled && value.enforcement.state !== 'DISABLED')
          || typeof value.accountingKnown !== 'boolean'
          || !audit || typeof audit.durable !== 'boolean' || !Array.isArray(audit.recent)
          || (audit.durable && (!['allowed', 'blocked'].every(k => Number.isSafeInteger(audit.counts?.[k]) && audit.counts[k] >= 0)
            || audit.recent.some(r => !r || !Number.isFinite(r.at) || !['allowed', 'blocked'].includes(r.decision)
              || typeof r.surface !== 'string' || typeof r.operation !== 'string')))
          || (value.accountingKnown && !['day', 'week', 'month'].every(k => amount(value.periods?.[k]?.spent) && amount(value.periods[k].cap)))) {
        throw new Error('Invalid treasury telemetry response');
      }
      liveStatus = value; liveAt = Date.now(); liveError = null;
    } catch (error) {
      liveStatus = null; liveError = error.message;
    } finally { reading = false; paintStatus(); }
  }
  function dossierHTML(a, record = false) {
    if (!a || !isPortal(a.id)) return '';
    return '<div class="cf-card"><h4>LIVE TREASURY ENFORCEMENT</h4>' +
      '<p>The local AI adviser answers treasury COMMS. Financial filtering runs in the server even when the adviser is idle, offline, or removed.</p>' +
      '<pre class="set-about" data-treasury-live style="white-space:pre-wrap"></pre>' +
      '<button type="button" class="bb xs" data-treasury-controls>FINANCE CONTROLS</button>' +
      (record ? '<h4>RECENT FINANCIAL GATE DECISIONS</h4><p>Latest 100 interception events. Earlier counters persist; this is not a complete business ledger.</p><pre class="set-about" data-treasury-record style="white-space:pre-wrap"></pre>' : '') + '</div>';
  }
  function wireDossier(body, a) {
    if (!a || !isPortal(a.id)) return;
    body.querySelectorAll('[data-treasury-controls]').forEach(el => { el.onclick = () => StationUI.openTerm('treasurer'); });
    paintStatus();
  }
  function amount(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  }
  function dollars(value) { return '$' + value.toFixed(2); }
  function summary(status) {
    if (!status || !status.caps || !capKeys.every(k => amount(status.caps[k]))
        || !status.accounting || typeof status.accounting.complete !== 'boolean'
        || typeof status.accounting.durable !== 'boolean' || !Array.isArray(status.unsettled)) {
      throw new Error('Invalid finance status response; spending cannot be verified.');
    }
    const known = status.accounting.complete && status.accounting.durable;
    for (const key of ['spentToday', 'lifetime', 'live']) {
      if (known && !amount(status[key])) throw new Error('Missing ' + key + '; spending cannot be verified.');
    }
    const money = key => known ? dollars(status[key]) : 'UNKNOWN';
    const lines = [
      'Recorded model/API spending only - not a complete business ledger.',
      'Recorded spend, trailing 24 hours: ' + money('spentToday'),
      'Recorded lifetime spend: ' + money('lifetime'),
      'In-flight reported spend (not a reservation): ' + money('live'),
      'Unsettled run receipts: ' + status.unsettled.length,
      'Accounting: ' + (known ? 'complete and durable for tracked records' : 'INCOMPLETE / UNAVAILABLE - cannot certify compliance'),
      '',
      'CURRENT GOVERNOR SETTINGS (not strict pre-charge ceilings)',
    ];
    for (const [key, label] of [['perRun', 'Per run'], ['perAgent', 'Per agent'], ['perDay', 'Trailing 24 hours'], ['global', 'Lifetime pool']]) {
      lines.push(label + ': ' + (status.caps[key] === 0 ? 'UNLIMITED' : dollars(status.caps[key])));
    }
    const strict = status.strictFinance;
    if (strict && strict.enabled === true) {
      if (strict.mode !== 'local-only' || !Array.isArray(strict.localModels) || strict.positiveCostAdapters !== 0) {
        throw new Error('Invalid strict finance enforcement response.');
      }
      lines.push('', 'STRICT FINANCE ACTIVE - LOCAL ONLY',
        'Paid/unknown-cost operations: BLOCKED before dispatch.',
        'Approved local models: ' + (strict.localModels.join(', ') || 'NONE - policy needs repair'),
        'Positive-cost adapters: NONE. No paid reservation path is enabled.',
        'External/manual charges and existing subscriptions are outside this gate.');
      if (strict.error) lines.push('POLICY ERROR: ' + strict.error);
      if (strict.accountingKnown === true) {
        for (const scope of ['day', 'week', 'month']) {
          const period = strict.periods && strict.periods[scope];
          if (!period || !amount(period.spent) || !amount(period.cap) || !amount(period.remaining)) {
            throw new Error('Missing calendar accounting; spending cannot be verified.');
          }
          lines.push(scope.toUpperCase() + ' ' + period.period + ': recorded ' + dollars(period.spent) +
            ' / cap ' + dollars(period.cap) + ' / remaining ' + dollars(period.remaining));
        }
      } else {
        lines.push('Calendar accounting: UNKNOWN - ' + (strict.accountingError || 'records unavailable'));
      }
    } else {
      lines.push('', 'Calendar-day / week / month compliance: UNKNOWN - strict enforcement is not active.');
    }
    return lines.join('\n');
  }
  function build(body) {
    body.innerHTML =
      '<p class="set-about"><b>TREASURER - FINANCE PORTAL</b><br>' +
      'Independent deterministic controls. The Treasurer AI adviser has a separate dossier and COMMS; this panel makes no model calls.</p>' +
      '<h4 data-finance-policy>FINANCE POLICY - CHECKING ENFORCEMENT</h4>' +
      '<p>Combined station totals in USD: <b>$50 per calendar day</b>, <b>$500 per Monday-Sunday week</b>, ' +
      '<b>$1,000 per calendar month</b>. Timezone: <b>America/Phoenix</b>. All three periods apply together.</p>' +
      '<p class="set-about">Strict local-only mode refuses all paid or unknown-cost operations before dispatch. ' +
      'No positive-cost adapter or paid reservation path is enabled. The legacy governor below separately checks ' +
      'recorded costs between calls; its settings do not bypass strict mode. This portal never raises limits automatically.</p>' +
      '<div class="mc-acts"><button class="bb xs" data-finance-refresh>REFRESH SPENDING</button>' +
      '<button class="bb xs" data-finance-controls>OPEN EXISTING BUDGET CONTROLS</button></div>' +
      '<p class="msg" data-finance-message role="status" aria-live="polite"></p>' +
      '<pre class="set-about" data-finance-summary style="white-space:pre-wrap"></pre>' +
      '<h4>BUSINESS FINANCE - NOT CONNECTED</h4>' +
      '<p>Income, Etsy/Shopify sales, fulfillment, advertising, subscriptions, fees and refunds are not ' +
      'collected by this panel. Missing records are unknown, not zero income or zero expense.</p>' +
      '<h4>FUTURE REPORTS AND CATEGORIES</h4>' +
      '<p>Reconciled income/expense reports and category budgets (such as listings and marketing) are planned, ' +
      'not active. Categories do not create additional spending allowances.</p>';
    const refresh = body.querySelector('[data-finance-refresh]');
    const message = body.querySelector('[data-finance-message]');
    const output = body.querySelector('[data-finance-summary]');
    const policy = body.querySelector('[data-finance-policy]');
    body.querySelector('[data-finance-controls]').onclick = () => StationUI.openTerm('settings', 'budget');
    async function load() {
      refresh.disabled = true;
      message.className = 'msg';
      message.textContent = 'Reading recorded spending...';
      policy.textContent = 'FINANCE POLICY - CHECKING ENFORCEMENT';
      output.textContent = '';
      try {
        const status = await Harness.api.get('/api/budget/status');
        if (!body.isConnected) return;
        output.textContent = summary(status);
        policy.textContent = status.strictFinance?.enabled === true
          ? 'STRICT FINANCE ACTIVE - LOCAL ONLY' : 'REQUESTED POLICY - NOT YET ENFORCED';
        message.className = 'msg ok';
        message.textContent = 'Read at ' + new Date().toLocaleString() + '. No settings changed.';
      } catch (error) {
        if (!body.isConnected) return;
        policy.textContent = 'FINANCE ENFORCEMENT STATUS UNKNOWN';
        message.textContent = 'Finance data unavailable: ' + error.message;
      } finally {
        refresh.disabled = false;
      }
    }
    refresh.onclick = load;
    load();
  }

  if (typeof StationUI !== 'undefined') StationUI.registerWindow('treasurer', 'TREASURER - FINANCE PORTAL', build, {});
  return { avatarId, isPortal, init, openFor, summary, officerStatus, dossierHTML, wireDossier, refreshStatus, activateAdviser, crewOrder };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = TreasurerPortal;
