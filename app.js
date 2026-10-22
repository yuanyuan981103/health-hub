/* ===== 健康集 · 应用主逻辑与界面 ===== */
(function () {
  const TYPE_META = {
    exam:       { label: '体检', icon: '🩺', color: '#e0f2fe' },
    lab:        { label: '化验', icon: '🧪', color: '#fef3c7' },
    medication: { label: '用药', icon: '💊', color: '#fce7f3' },
    vitals:     { label: '体征', icon: '📏', color: '#dcfce7' },
    symptom:    { label: '症状', icon: '🗒️', color: '#ede9fe' },
    imaging:    { label: '影像', icon: '🩻', color: '#e0e7ff' },
    other:      { label: '其他', icon: '📁', color: '#f1f5f9' }
  };
  const TYPE_KEYS = Object.keys(TYPE_META);

  const state = {
    view: 'home',
    prevView: 'home',
    records: [],
    filter: 'all',
    search: '',
    detailId: null,
    detailBusy: false,
    editingDate: false,
    // 添加页草稿
    draftDate: localDateStr(),
    draftDateTouched: false,
    draftText: '',
    draftType: 'auto',
    draftVitals: { weight: '', sbp: '', dbp: '', hr: '', temp: '', glucose: '' },
    draftFiles: [],
    // 助手
    chat: [],
    chatInput: '',
    busy: false
  };

  /* ---------- 工具 ---------- */
  function $(sel) { return document.querySelector(sel); }
  function h(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function localDateStr(d) {
    d = d || new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function fmtDateShort(s) {
    if (!s) return '';
    const [y, m, d] = s.split('-');
    const now = new Date();
    if (Number(y) === now.getFullYear()) return `${Number(m)}月${Number(d)}日`;
    return `${y}年${Number(m)}月${Number(d)}日`;
  }
  function fmtDateFull(s) {
    if (!s) return '';
    const [y, m, d] = s.split('-');
    return `${y}年${Number(m)}月${Number(d)}日`;
  }
  function groupKey(s) {
    if (!s) return '未标注日期';
    const [y, m] = s.split('-');
    return `${y}年${Number(m)}月`;
  }
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }
  function fmtSize(bytes) {
    if (bytes == null) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  /* ---------- 统计 ---------- */
  function computeStats() {
    let abnormal = 0, lastWeight = null;
    for (const r of state.records) {
      for (const i of r.indicators || []) {
        if (i.abnormal && i.abnormal !== '正常') abnormal++;
        if (i.key === 'weight' && i.value && !lastWeight) lastWeight = i;
      }
    }
    return { total: state.records.length, abnormal, lastWeight };
  }

  /* ---------- 渲染 ---------- */
  function render() {
    const app = $('#app');
    switch (state.view) {
      case 'home': app.innerHTML = renderHome(); break;
      case 'archive': app.innerHTML = renderArchive(); break;
      case 'add': app.innerHTML = renderAdd(); break;
      case 'detail': app.innerHTML = renderDetail(); break;
      case 'assistant': app.innerHTML = renderAssistant(); break;
      case 'settings': app.innerHTML = renderSettings(); break;
    }
    if (state.view === 'archive') updateArchiveList();
    if (state.view === 'add') bindAdd();
    window.scrollTo(0, 0);
  }

  function topbar(title, opts = {}) {
    const back = opts.back ? `<button class="icon-btn" onclick="App.go('${opts.back}')">‹</button>` : '';
    return `<header class="topbar">${back}<div><div class="title">${title}</div>${opts.sub ? `<div class="sub">${opts.sub}</div>` : ''}</div></header>`;
  }

  function tabbarHTML(active) {
    const items = [
      { k: 'home', icon: '🏠', label: '首页' },
      { k: 'archive', icon: '🗂️', label: '档案' },
      { k: 'add', fab: true },
      { k: 'assistant', icon: '🤖', label: '助手' },
      { k: 'settings', icon: '⚙️', label: '我的' }
    ];
    return `<nav class="tabbar">${items.map((it) => {
      if (it.fab) return `<button class="tab-fab" onclick="App.go('add')" aria-label="添加">＋</button>`;
      return `<button class="tab ${active === it.k ? 'active' : ''}" onclick="App.go('${it.k}')"><span class="ico">${it.icon}</span><span>${it.label}</span></button>`;
    }).join('')}</nav>`;
  }

  function recItemHTML(r) {
    const meta = TYPE_META[r.type] || TYPE_META.other;
    const abn = (r.indicators || []).filter((i) => i.abnormal && i.abnormal !== '正常').length;
    const thumb = (r.attachments || []).find((a) => a.thumb);
    return `<div class="rec-item" onclick="App.openDetail('${r.id}')">
      <div class="rec-icon" style="background:${meta.color}">${meta.icon}</div>
      <div class="rec-main">
        <div class="rec-title">${h(r.title || meta.label + '记录')}</div>
        <div class="rec-meta">
          <span class="badge" style="background:${meta.color};color:#334155">${meta.label}</span>
          ${(r.indicators || []).length ? `<span>${r.indicators.length} 项指标</span>` : ''}
          ${abn ? `<span class="badge abnormal">${abn} 项异常</span>` : ''}
        </div>
      </div>
      <div class="rec-side">
        <div class="rec-date">${fmtDateShort(r.recordDate)}</div>
      </div>
      ${thumb ? `<img class="thumb" src="${thumb.thumb}" alt="">` : ''}
    </div>`;
  }

  /* ---------- 首页 ---------- */
  function renderHome() {
    const s = computeStats();
    const recs = state.records.slice(0, 5);
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][new Date().getDay()];
    const todayCN = `${new Date().getMonth() + 1}月${new Date().getDate()}日 星期${weekday}`;

    let statCards = `
      <div class="stat-card">
        <div class="label">📚 健康档案</div>
        <div class="value">${s.total}<small> 条</small></div>
        <div class="hint">已安全保存在本地</div>
      </div>
      <div class="stat-card alt">
        <div class="label">⚠️ 异常指标</div>
        <div class="value" style="color:${s.abnormal ? 'var(--danger)' : 'var(--ok)'}">${s.abnormal}<small> 项</small></div>
        <div class="hint">${s.abnormal ? '建议重点关注' : '目前未见异常'}</div>
      </div>`;

    const weightCard = s.lastWeight
      ? `<div class="stat-card alt">
          <div class="label">⚖️ 最近体重</div>
          <div class="value">${s.lastWeight.value}<small> ${s.lastWeight.unit || 'kg'}</small></div>
          <div class="hint">${fmtDateShort(s.lastWeight.date || '')}</div>
        </div>`
      : `<div class="stat-card alt">
          <div class="label">⚖️ 最近体重</div>
          <div class="value">--<small></small></div>
          <div class="hint">还没有记录</div>
        </div>`;

    const quick = `
      <div class="card">
        <div class="card-title">快捷操作</div>
        <div class="quick-grid">
          <div class="quick-item" onclick="App.go('add')"><div class="ico">📤</div><span>上传报告</span></div>
          <div class="quick-item" onclick="App.recordFeeling()"><div class="ico">💬</div><span>记录感受</span></div>
          <div class="quick-item" onclick="App.go('assistant')"><div class="ico">🤖</div><span>健康助手</span></div>
          <div class="quick-item" onclick="App.go('archive')"><div class="ico">🗂️</div><span>我的档案</span></div>
        </div>
      </div>`;

    const recent = `
      <div class="card" style="padding-bottom:12px">
        <div class="card-title">最近记录 <span class="more" onclick="App.go('archive')">查看全部 ›</span></div>
        ${recs.length ? recs.map(recItemHTML).join('') : `
          <div class="empty" style="padding:20px 10px">
            <div class="big">🩺</div>
            <h3>开始建立你的健康档案</h3>
            <p>上传体检报告、化验单，或简单记录身体感受，一切都会自动归档。</p>
            <button class="btn" onclick="App.go('add')">＋ 添加第一条记录</button>
          </div>`}
      </div>`;

    return `
      <div class="content view">
        <div class="greeting">
          <h1>你好 👋</h1>
          <p>${todayCN} · 关注身体，从记录开始</p>
        </div>
        <div class="stats-row">${statCards}</div>
        <div class="stats-row" style="grid-template-columns:1fr">${weightCard}</div>
        ${quick}
        ${recent}
      </div>${tabbarHTML('home')}`;
  }

  /* ---------- 档案 ---------- */
  function renderArchive() {
    const counts = { all: state.records.length };
    for (const k of TYPE_KEYS) counts[k] = state.records.filter((r) => r.type === k).length;

    const chips = ['all', ...TYPE_KEYS].map((k) => {
      const label = k === 'all' ? '全部' : TYPE_META[k].label;
      return `<button class="chip ${state.filter === k ? 'active' : ''}" onclick="App.setFilter('${k}')">${label} ${counts[k] || 0}</button>`;
    }).join('');

    return `
      <div class="content view">
        ${topbar('健康档案', { sub: '全部记录 · 本地存储' })}
        <div class="search">
          <span>🔍</span>
          <input id="archive-search" type="text" placeholder="搜索标题、指标、内容…" value="${h(state.search)}" oninput="App.onSearchInput(this.value)">
        </div>
        <div class="chips">${chips}</div>
        <div id="archive-list"></div>
      </div>${tabbarHTML('archive')}`;
  }

  function filteredRecords() {
    let list = state.records;
    if (state.filter !== 'all') list = list.filter((r) => r.type === state.filter);
    if (state.search) {
      const q = state.search.toLowerCase();
      list = list.filter((r) => {
        const indText = (r.indicators || []).map((i) => i.name + i.value).join(' ');
        return (r.title + ' ' + (r.content || '') + ' ' + indText).toLowerCase().includes(q);
      });
    }
    return list;
  }

  function updateArchiveList() {
    const box = $('#archive-list');
    if (!box) return;
    const list = filteredRecords();
    if (!list.length) {
      box.innerHTML = `<div class="empty"><div class="big">🔍</div><h3>没有找到记录</h3><p>换个关键词，或添加新的健康记录。</p></div>`;
      return;
    }
    const groups = {};
    for (const r of list) {
      const k = groupKey(r.recordDate);
      (groups[k] = groups[k] || []).push(r);
    }
    let html = '';
    for (const [g, arr] of Object.entries(groups)) {
      html += `<div style="font-size:12px;color:var(--text-3);font-weight:700;margin:14px 4px 8px">${g}</div>`;
      html += arr.map(recItemHTML).join('');
    }
    box.innerHTML = html;
  }

  /* ---------- 添加 ---------- */
  function renderAdd() {
    const typeChips = ['auto', ...TYPE_KEYS].map((k) => {
      const label = k === 'auto' ? '🤖 自动识别' : `${TYPE_META[k].icon} ${TYPE_META[k].label}`;
      return `<button class="chip ${state.draftType === k ? 'active' : ''}" onclick="App.setDraftType('${k}')">${label}</button>`;
    }).join('');

    const files = state.draftFiles.map((f, idx) => {
      const ico = f.previewURL
        ? `<img src="${f.previewURL}" alt="">`
        : `<div class="file-ico">${f.file.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf') ? '📄' : '📎'}</div>`;
      const statusCls = f.status === 'done' ? 'ok' : f.status === 'error' ? 'err' : '';
      const statusText = f.status === 'parsing' ? '解析中…' : f.status === 'done' ? (f.text ? `已解析 ${f.text.length} 字` : '已保存') : '解析失败，保留原文件';
      return `<div class="file-row">
        ${ico}
        <div class="file-info">
          <div class="file-name">${h(f.name)}</div>
          <div class="file-status ${statusCls}">${fmtSize(f.size)} · ${statusText}</div>
        </div>
        <button class="file-del" onclick="App.removeDraftFile(${idx})">✕</button>
      </div>`;
    }).join('');

    return `
      <div class="content view">
        ${topbar('添加记录', { back: 'home', sub: '支持 PDF、图片、文字描述' })}

        <div class="field">
          <label>📅 记录日期 <span style="font-weight:400;color:var(--text-3)">（改成报告上的实际检测日期）</span></label>
          <input type="date" value="${state.draftDate}" onchange="App.setDraft('draftDate', this.value)">
        </div>

        <div class="upload-zone" id="upload-zone" onclick="App.chooseFiles()">
          <div class="ico">📤</div>
          <h3>点击上传报告 / 图片</h3>
          <p>体检报告 PDF、化验单照片等，自动识别内容</p>
        </div>
        <input type="file" id="file-input" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp,.txt,.md,image/*" style="display:none" onchange="App.onFilesSelected(this)">
        ${files ? `<div class="file-list">${files}</div>` : ''}

        <div class="field">
          <label>💬 口述你的身体感受（可选）</label>
          <textarea id="draft-text" placeholder="例如：最近一周总觉得累，晚上入睡困难，白天没精神…" oninput="App.setDraft('draftText', this.value)">${h(state.draftText)}</textarea>
        </div>

        <div class="field">
          <label>🏷️ 记录类型</label>
          <div class="chips" style="padding-bottom:2px">${typeChips}</div>
        </div>

        <div class="card" style="padding:16px">
          <div class="card-title">📏 快速记体征（可选）</div>
          <div class="vitals-row">
            <input id="v-weight" type="text" inputmode="decimal" placeholder="体重kg" value="${h(state.draftVitals.weight)}" oninput="App.setVital('weight', this.value)">
            <input id="v-sbp" type="text" inputmode="numeric" placeholder="收缩压" value="${h(state.draftVitals.sbp)}" oninput="App.setVital('sbp', this.value)">
            <input id="v-dbp" type="text" inputmode="numeric" placeholder="舒张压" value="${h(state.draftVitals.dbp)}" oninput="App.setVital('dbp', this.value)">
          </div>
          <div class="vitals-row" style="margin-top:10px">
            <input id="v-hr" type="text" inputmode="numeric" placeholder="心率" value="${h(state.draftVitals.hr)}" oninput="App.setVital('hr', this.value)">
            <input id="v-temp" type="text" inputmode="decimal" placeholder="体温℃" value="${h(state.draftVitals.temp)}" oninput="App.setVital('temp', this.value)">
            <input id="v-glucose" type="text" inputmode="decimal" placeholder="血糖" value="${h(state.draftVitals.glucose)}" oninput="App.setVital('glucose', this.value)">
          </div>
        </div>

        <button class="btn block" onclick="App.submitRecord()">保存并自动归档</button>
      </div>${tabbarHTML('add')}`;
  }

  function bindAdd() {
    const zone = $('#upload-zone');
    if (zone) {
      zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
      zone.addEventListener('drop', (e) => {
        e.preventDefault(); zone.classList.remove('drag');
        if (e.dataTransfer.files.length) addFiles(Array.from(e.dataTransfer.files));
      });
    }
  }

  /* ---------- 详情 ---------- */
  function renderDetail() {
    const r = state.records.find((x) => x.id === state.detailId);
    if (!r) { state.view = 'archive'; render(); return ''; }
    const meta = TYPE_META[r.type] || TYPE_META.other;
    const abn = (r.indicators || []).filter((i) => i.abnormal && i.abnormal !== '正常').length;

    let indicatorsHtml = '';
    if ((r.indicators || []).length) {
      indicatorsHtml = `<div class="card">
        <div class="card-title">📊 结构化指标 ${abn ? `<span class="badge abnormal">${abn} 项异常</span>` : ''}</div>
        <table class="kv-table">
          <tr><th>项目</th><th>结果</th><th>参考范围</th><th>状态</th></tr>
          ${r.indicators.map((i) => `<tr>
            <td>${h(i.name)}</td>
            <td class="val">${i.value != null ? h(i.value) : '-'}${i.unit ? ` <span style="font-size:11px;color:var(--text-3)">${h(i.unit)}</span>` : ''}</td>
            <td style="color:var(--text-2)">${i.refRange ? h(i.refRange) : '-'}</td>
            <td>${i.abnormal ? (i.abnormal === '正常' ? '<span class="ok">正常</span>' : `<span class="abn">${h(i.abnormal)}</span>`) : '<span style="color:var(--text-3)">-</span>'}</td>
          </tr>`).join('')}
        </table>
        <div class="hint-text" style="margin:10px 0 0">* 指标由系统自动识别，仅供参考，请以原始报告为准。</div>
      </div>`;
    }

    let attachHtml = '';
    if ((r.attachments || []).length) {
      attachHtml = `<div class="card">
        <div class="card-title">📎 附件（${r.attachments.length}）</div>
        <div class="attach-grid">
          ${r.attachments.map((a) => a.thumb
            ? `<div class="attach" onclick="App.viewFile('${r.id}','${a.id}')"><img src="${a.thumb}" alt=""></div>`
            : `<div class="attach" onclick="App.viewFile('${r.id}','${a.id}')"><div class="file-tag"><span style="font-size:22px">📄</span><span>${h((a.name || '').slice(-12))}</span></div></div>`
          ).join('')}
        </div>
      </div>`;
    }

    let contentHtml = '';
    if (r.content) {
      contentHtml = `<div class="card">
        <div class="card-title">📝 原始内容 / 描述</div>
        <div class="prose">${h(r.content)}</div>
      </div>`;
    }

    let summaryHtml = '';
    if (r.summary) {
      summaryHtml = `<div class="card"><div class="ai-summary"><span class="tag">✨ AI 智能解读</span>${h(r.summary)}</div></div>`;
    } else if (state.detailBusy) {
      summaryHtml = `<div class="card"><div class="spinner"></div><div style="text-align:center;color:var(--text-2);font-size:13px">正在结合你的档案分析…</div></div>`;
    } else {
      summaryHtml = `<button class="btn block ghost" onclick="App.aiExplain()">✨ AI 智能解读这条记录</button>`;
    }

    return `
      <div class="content view">
        ${topbar('记录详情', { back: state.prevView || 'archive' })}
        <div class="detail-head">
          <span class="type-badge" style="background:${meta.color};color:#334155">${meta.icon} ${meta.label}</span>
          <h2>${h(r.title || meta.label + '记录')}</h2>
          <div class="meta-line">
            ${state.editingDate
              ? `<input type="date" id="edit-date" value="${h(r.recordDate)}" style="padding:7px 10px;border-radius:10px;border:1.5px solid var(--line);font-size:13px;background:var(--card)">
                 <button class="btn sm" onclick="App.saveRecordDate()">保存</button>
                 <button class="btn sm ghost" onclick="App.cancelEditDate()">取消</button>`
              : `<span>📅 ${fmtDateFull(r.recordDate)}</span>
                 <button class="icon-btn" style="width:26px;height:26px;font-size:13px;margin-left:2px" onclick="App.editDate()" title="修改日期">✏️</button>
                 <span>·</span>
                 <span>来源：${r.source === 'upload' ? '上传' : '手动'}</span>`}
          </div>
        </div>
        ${indicatorsHtml}
        ${attachHtml}
        ${contentHtml}
        ${summaryHtml}
        <button class="btn block danger" style="margin-top:6px" onclick="App.deleteRecord('${r.id}')">删除这条记录</button>
      </div>${tabbarHTML('archive')}`;
  }

  /* ---------- 助手 ---------- */
  function renderAssistant() {
    const suggest = [
      '根据我的档案，有什么健康建议？',
      '我最近有哪些指标异常？',
      '帮我解读最近的化验报告',
      '我的体重和血压需要注意什么？',
      '怎么改善睡眠和精力？'
    ];
    return `
      <div class="content view" style="display:flex;flex-direction:column;min-height:calc(100vh - 90px)">
        ${topbar('健康助手', { sub: '结合你的档案给出建议' })}
        <div class="suggest-chips">${suggest.map((s) => `<button class="suggest" onclick="App.suggest(this.innerText)">${s}</button>`).join('')}</div>
        <div class="chat-wrap" style="flex:1;display:flex;flex-direction:column">
          <div class="chat-list" id="chat-list">
            ${state.chat.map(chatBubbleHTML).join('')}
          </div>
        </div>
        <div class="chat-input">
          <textarea id="chat-text" placeholder="说说你的问题…" rows="1" oninput="App.onChatInput(this.value);autoGrow(this)">${h(state.chatInput)}</textarea>
          <button class="send-btn" onclick="App.sendChat()" ${state.busy ? 'disabled' : ''}>➤</button>
        </div>
      </div>${tabbarHTML('assistant')}`;
  }

  function chatBubbleHTML(m) {
    if (m.typing) return `<div class="msg ai typing"></div>`;
    return `<div class="msg ${m.role}">${h(m.content)}</div>`;
  }

  function appendTyping() {
    const list = $('#chat-list');
    if (!list) return;
    const d = document.createElement('div');
    d.className = 'msg ai typing';
    d.id = 'typing-bubble';
    list.appendChild(d);
    list.scrollTop = list.scrollHeight;
  }
  function removeTyping() {
    const t = $('#typing-bubble');
    if (t) t.remove();
  }

  /* ---------- 设置 ---------- */
  function renderSettings() {
    const s = state.settings;
    return `
      <div class="content view">
        ${topbar('我的', { sub: '设置与数据管理' })}

        <div class="setting-group">
          <div class="label">AI 配置</div>
          <div class="card" style="margin-bottom:9px">
            <div class="field" style="margin-bottom:10px">
              <label>接口地址（OpenAI 兼容）</label>
              <input type="text" id="set-endpoint" value="${h(s.endpoint)}" placeholder="https://api.deepseek.com/chat/completions">
            </div>
            <div class="field" style="margin-bottom:10px">
              <label>模型名称</label>
              <input type="text" id="set-model" value="${h(s.model)}" placeholder="deepseek-chat">
            </div>
            <div class="field" style="margin-bottom:14px">
              <label>API Key</label>
              <input type="password" id="set-apikey" value="${h(s.apiKey)}" placeholder="sk-…">
            </div>
            <div style="display:flex;gap:10px">
              <button class="btn" style="flex:1" onclick="App.saveSettings()">保存</button>
              <button class="btn ghost" onclick="App.testConnection()">测试连接</button>
            </div>
            <div class="hint-text">Key 只保存在你本地浏览器，不会上传。<br>
            DeepSeek 已实测支持浏览器直连，手机访问时可直接使用；本地运行时也可通过 python server.py 代理转发。</div>
          </div>
        </div>

        <div class="setting-group">
          <div class="label">数据管理</div>
          <div class="setting-row" onclick="App.exportData()"><span class="ico">⬇️</span>导出全部数据（JSON）<span class="arrow">›</span></div>
          <div class="setting-row" onclick="document.getElementById('import-input').click()"><span class="ico">⬆️</span>导入备份<span class="arrow">›</span></div>
          <input type="file" id="import-input" accept=".json,application/json" style="display:none" onchange="App.importData(this)">
          <div class="setting-row" onclick="App.clearAll()" style="color:var(--danger)"><span class="ico">🗑️</span>清空所有数据<span class="arrow">›</span></div>
        </div>

        <div class="setting-group">
          <div class="label">关于</div>
          <div class="card" style="margin-bottom:0">
            <div style="font-size:15px;font-weight:700">健康集 · 我的健康档案</div>
            <div class="hint-text" style="margin:8px 0 0">
              数据全部保存在本地浏览器（IndexedDB），不会上传到任何服务器。AI 解读仅在你主动点击时，把相关记录发送给你配置的 AI 接口。
              <br><br>⚠️ 本工具仅用于个人健康记录整理，AI 建议不能替代专业医疗诊断，如有异常或不适请及时就医。
            </div>
          </div>
        </div>
      </div>${tabbarHTML('settings')}`;
  }

  /* ---------- 动作 ---------- */
  function go(view) {
    state.prevView = state.view === 'detail' ? state.prevView : state.view;
    state.view = view;
    if (view === 'add') {
      state.draftDate = localDateStr();
      state.draftDateTouched = false;
      state.draftText = '';
      state.draftType = 'auto';
      state.draftVitals = { weight: '', sbp: '', dbp: '', hr: '', temp: '', glucose: '' };
      state.draftFiles = [];
    }
    render();
  }

  function openDetail(id) {
    state.detailId = id;
    state.prevView = state.view;
    state.view = 'detail';
    render();
  }

  function setFilter(k) { state.filter = k; render(); }
  function onSearchInput(v) { state.search = v; updateArchiveList(); }
  function setDraft(key, val) {
    state[key] = val;
    if (key === 'draftDate') state.draftDateTouched = true;
  }
  function setVital(key, val) { state.draftVitals[key] = val; }
  function setDraftType(k) { state.draftType = k; render(); }
  function removeDraftFile(idx) {
    const f = state.draftFiles[idx];
    if (f && f.previewURL) URL.revokeObjectURL(f.previewURL);
    state.draftFiles.splice(idx, 1);
    render();
  }

  function chooseFiles() { $('#file-input').click(); }
  function onFilesSelected(input) {
    if (input.files.length) addFiles(Array.from(input.files));
    input.value = '';
  }

  function addFiles(files) {
    for (const f of files) {
      const entry = {
        file: f, name: f.name, size: f.size,
        previewURL: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
        status: 'parsing', text: ''
      };
      state.draftFiles.push(entry);
    }
    render();
    for (const e of state.draftFiles) {
      if (e.status === 'parsing') processFile(e);
    }
  }

  async function processFile(entry) {
    try {
      let text = '';
      if (entry.file.type.startsWith('image/')) {
        text = await Parser.ocrImage(entry.file);
      } else if (entry.file.type === 'application/pdf' || entry.name.toLowerCase().endsWith('.pdf')) {
        text = await Parser.extractPdfText(entry.file);
      } else if (/text\/|\/json|\.(txt|md|csv)$/i.test(entry.name)) {
        text = await entry.file.text();
      }
      entry.text = (text || '').replace(/\s+/g, ' ').trim();
      entry.status = 'done';
      // 尝试从报告文本中自动识别实际检测日期
      if (!state.draftDateTouched) {
        const detected = Parser.detectDate(entry.text);
        if (detected && state.draftDate === localDateStr()) {
          state.draftDate = detected;
          toast('已自动识别检测日期：' + detected + '，可手动修改');
        }
      }
    } catch (e) {
      entry.status = 'error';
    }
    if (state.view === 'add') render();
  }

  function recordFeeling() {
    state.view = 'add';
    state.draftDate = localDateStr();
    state.draftDateTouched = false;
    state.draftText = '';
    state.draftType = 'auto';
    state.draftVitals = { weight: '', sbp: '', dbp: '', hr: '', temp: '', glucose: '' };
    state.draftFiles = [];
    render();
    const ta = $('#draft-text');
    if (ta) ta.focus();
  }

  function createThumb(blob) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const max = 220;
        let w = img.width, ht = img.height;
        const scale = Math.min(max / w, max / ht, 1);
        w = Math.round(w * scale); ht = Math.round(ht * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = ht;
        c.getContext('2d').drawImage(img, 0, 0, w, ht);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
      img.src = url;
    });
  }

  async function submitRecord() {
    if (!state.draftFiles.length && !state.draftText.trim() && !Object.values(state.draftVitals).some((v) => v.trim())) {
      toast('请先上传文件、填写描述或记录体征');
      return;
    }
    const filesText = state.draftFiles.map((f) => f.text || '').join('\n');
    const names = state.draftFiles.map((f) => f.name).join(' ');
    const combined = (state.draftText + '\n' + filesText).trim();

    // 自动识别类型
    let type = state.draftType === 'auto' ? Parser.detectType(combined, names) : state.draftType;

    // 指标：先自动识别，再叠加手动体征
    const indicators = Parser.parseIndicators(combined);
    const vitalMap = {
      weight: ['体重', 'kg'], sbp: ['收缩压', 'mmHg'], dbp: ['舒张压', 'mmHg'],
      hr: ['心率', '次/分'], temp: ['体温', '℃'], glucose: ['空腹血糖', 'mmol/L']
    };
    for (const [key, [label, unit]] of Object.entries(vitalMap)) {
      const v = state.draftVitals[key].trim();
      if (v) {
        const existing = indicators.find((i) => i.key === key);
        if (existing) { existing.value = v; existing.name = label; existing.unit = unit; }
        else indicators.push({ key, name: label, value: v, unit, refRange: '', abnormal: '' });
      }
    }
    if (Object.values(state.draftVitals).some((v) => v.trim())) type = type === 'other' ? 'vitals' : type;

    // 附件入库
    const attachments = [];
    for (const f of state.draftFiles) {
      const id = await Store.saveFile(f.file, f.name);
      const att = { id, name: f.name, mime: f.file.type, size: f.size, thumb: '' };
      if (f.file.type.startsWith('image/')) att.thumb = await createThumb(f.file);
      attachments.push(att);
    }

    // 标题
    let title = '';
    if (type === 'vitals' && indicators.length) {
      title = '体征记录：' + indicators.map((i) => `${i.name} ${i.value}${i.unit}`).join(' · ');
    } else if (state.draftFiles.length) {
      title = state.draftFiles[0].name.replace(/\.(pdf|png|jpe?g|webp|bmp|txt|md)$/i, '');
    } else if (state.draftText.trim()) {
      title = state.draftText.trim().replace(/\s+/g, ' ').slice(0, 22);
    } else {
      title = TYPE_META[type].label + '记录';
    }

    const record = {
      id: '',
      createdAt: Date.now(),
      recordDate: state.draftDate || localDateStr(),
      type, title,
      source: state.draftFiles.length ? 'upload' : 'manual',
      content: combined,
      indicators,
      attachments,
      summary: ''
    };

    await Store.put(record);
    state.records = await Store.getAll();
    toast('已自动归档 ✓');
    state.view = 'home';
    render();
  }

  async function deleteRecord(id) {
    if (!confirm('确定删除这条记录吗？删除后不可恢复。')) return;
    await Store.remove(id);
    state.records = await Store.getAll();
    state.view = 'archive';
    render();
    toast('已删除');
  }

  function editDate() { state.editingDate = true; render(); }
  function cancelEditDate() { state.editingDate = false; render(); }
  async function saveRecordDate() {
    const el = $('#edit-date');
    const r = state.records.find((x) => x.id === state.detailId);
    if (!el || !r) return;
    r.recordDate = el.value || r.recordDate;
    await Store.put(r);
    state.records = await Store.getAll();
    state.editingDate = false;
    render();
    toast('已更新记录日期');
  }

  async function aiExplain() {
    const r = state.records.find((x) => x.id === state.detailId);
    if (!r) return;
    state.detailBusy = true;
    render();
    try {
      const summary = await AI.summarizeRecord(r);
      r.summary = summary;
      await Store.put(r);
      state.records = await Store.getAll();
      toast('解读完成');
    } catch (e) {
      toast(e.message || '解读失败');
    } finally {
      state.detailBusy = false;
      render();
    }
  }

  async function viewFile(recordId, attId) {
    try {
      const f = await Store.getFile(attId);
      if (!f) { toast('文件不存在'); return; }
      const url = URL.createObjectURL(f.blob);
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.download = f.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      toast('打开失败');
    }
  }

  function buildHealthContext() {
    return state.records.slice(0, 25).map((r) => {
      const meta = TYPE_META[r.type] || TYPE_META.other;
      const inds = (r.indicators || []).map((i) => `${i.name} ${i.value != null ? i.value : '-'}${i.unit || ''}${i.refRange ? '(参考' + i.refRange + ')' : ''}${i.abnormal ? '[' + i.abnormal + ']' : ''}`).join('；');
      return `[${r.recordDate}] ${meta.label} ${r.title || ''}${inds ? ' | ' + inds : ''}${r.content ? ' | ' + r.content.slice(0, 160).replace(/\n/g, ' ') : ''}`;
    }).join('\n');
  }

  function onChatInput(v) { state.chatInput = v; }
  function suggest(text) { sendChat(text); }

  async function sendChat(text) {
    text = (text == null ? state.chatInput : text).trim();
    if (!text || state.busy) return;
    state.chatInput = '';
    state.chat.push({ role: 'user', content: text });
    render();
    appendTyping();
    state.busy = true;
    try {
      const reply = await AI.chatWithContext(text, buildHealthContext());
      removeTyping();
      state.chat.push({ role: 'assistant', content: reply });
    } catch (e) {
      removeTyping();
      state.chat.push({ role: 'assistant', content: '⚠️ ' + (e.message || '请求失败，请检查 AI 配置和网络') });
    } finally {
      state.busy = false;
      render();
    }
  }

  /* ---------- 设置动作 ---------- */
  function saveSettings() {
    state.settings = {
      endpoint: $('#set-endpoint').value.trim(),
      model: $('#set-model').value.trim(),
      apiKey: $('#set-apikey').value.trim()
    };
    Settings.save(state.settings);
    toast('设置已保存');
  }

  async function testConnection() {
    const endpoint = $('#set-endpoint').value.trim();
    const model = $('#set-model').value.trim();
    const apiKey = $('#set-apikey').value.trim();
    if (!endpoint || !apiKey) { toast('请先填写接口地址和 API Key'); return; }
    toast('正在测试…');
    try {
      const reply = await AI.chat(
        [{ role: 'user', content: '你好，请回复“连接成功”四个字。' }],
        { endpoint, model, apiKey }
      );
      toast('连接成功 ✓ 回复：' + reply.slice(0, 30));
    } catch (e) {
      toast('连接失败：' + e.message);
    }
  }

  async function exportData() {
    try {
      const json = await Store.exportJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `健康集备份_${localDateStr()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast('已导出');
    } catch (e) {
      toast('导出失败');
    }
  }

  async function importData(input) {
    const file = input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const n = await Store.importJSON(text);
      state.records = await Store.getAll();
      toast(`已导入 ${n} 条记录`);
      render();
    } catch (e) {
      toast('导入失败：' + (e.message || '文件格式不正确'));
    } finally {
      input.value = '';
    }
  }

  async function clearAll() {
    if (!confirm('确定清空所有健康数据吗？此操作不可恢复，建议先导出备份。')) return;
    await Store.clear();
    state.records = [];
    state.chat = [];
    render();
    toast('已清空');
  }

  /* ---------- 初始化 ---------- */
  async function init() {
    try {
      await Store.init();
      state.records = await Store.getAll();
    } catch (e) {
      console.error(e);
      toast('本地数据库初始化失败，请检查浏览器是否支持 IndexedDB');
    }
    state.settings = Settings.load();
    state.chat = [{
      role: 'assistant',
      content: '你好，我是你的健康助手 👋\n我可以结合你已归档的体检报告、化验单、用药和身体感受，给你一些参考建议。\n\n（温馨提示：我的建议不能替代医生面诊，异常指标请及时就医。）'
    }];
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    render();
  }

  window.autoGrow = function (el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 110) + 'px';
  };

  window.App = {
    go, openDetail, setFilter, onSearchInput, setDraft, setVital, setDraftType,
    removeDraftFile, chooseFiles, onFilesSelected, submitRecord, deleteRecord,
    editDate, saveRecordDate, cancelEditDate,
    aiExplain, viewFile, suggest, sendChat, onChatInput,
    saveSettings, testConnection, exportData, importData, clearAll, recordFeeling
  };

  document.addEventListener('DOMContentLoaded', init);
})();
