/* ===== 健康集 · 文档解析：OCR / PDF 文本提取 / 指标与类型自动识别 ===== */
(function () {
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('加载解析库失败，请检查网络'));
      document.head.appendChild(s);
    });
  }

  /* 图片 OCR（Tesseract.js，中文+英文） */
  async function ocrImage(blob) {
    await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
    const T = window.Tesseract;
    if (!T || !T.createWorker) throw new Error('OCR 库不可用');
    const worker = await T.createWorker('chi_sim+eng', 1, {
      logger: () => {}
    });
    try {
      const { data } = await worker.recognize(blob);
      return (data && data.text) || '';
    } finally {
      try { await worker.terminate(); } catch (e) {}
    }
  }

  /* PDF 文本提取（pdf.js） */
  async function extractPdfText(blob) {
    await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');
    const lib = window.pdfjsLib;
    if (!lib) throw new Error('PDF 库不可用');
    lib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    const buf = await blob.arrayBuffer();
    const pdf = await lib.getDocument({ data: buf }).promise;
    let text = '';
    const maxPage = Math.min(pdf.numPages, 50);
    for (let i = 1; i <= maxPage; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => it.str).join(' ') + '\n';
    }
    return text;
  }

  /* 常见健康指标（名称、单位、参考范围、类型） */
  const METRICS = [
    { key: 'weight', names: ['体重'], unit: 'kg', range: [45, 90] },
    { key: 'bmi', names: ['BMI', '体质指数'], unit: '', range: [18.5, 23.9] },
    { key: 'sbp', names: ['收缩压', '高压', 'SBP'], unit: 'mmHg', range: [90, 139] },
    { key: 'dbp', names: ['舒张压', '低压', 'DBP'], unit: 'mmHg', range: [60, 89] },
    { key: 'heartRate', names: ['心率', '脉搏'], unit: '次/分', range: [60, 100] },
    { key: 'temperature', names: ['体温'], unit: '℃', range: [36, 37.3] },
    { key: 'glucose', names: ['空腹血糖', '血糖', '葡萄糖', 'GLU'], unit: 'mmol/L', range: [3.9, 6.1] },
    { key: 'totalCholesterol', names: ['总胆固醇', 'TC', 'CHOL'], unit: 'mmol/L', range: [2.8, 5.2] },
    { key: 'triglyceride', names: ['甘油三酯', 'TG'], unit: 'mmol/L', range: [0.4, 1.7] },
    { key: 'hdl', names: ['高密度脂蛋白', 'HDL'], unit: 'mmol/L', range: [1.0, 2.2] },
    { key: 'ldl', names: ['低密度脂蛋白', 'LDL'], unit: 'mmol/L', range: [0, 3.4] },
    { key: 'wbc', names: ['白细胞', 'WBC'], unit: '10^9/L', range: [3.5, 9.5] },
    { key: 'rbc', names: ['红细胞', 'RBC'], unit: '10^12/L', range: [4.3, 5.8] },
    { key: 'hemoglobin', names: ['血红蛋白', 'HGB', 'Hb'], unit: 'g/L', range: [130, 175] },
    { key: 'platelet', names: ['血小板', 'PLT'], unit: '10^9/L', range: [125, 350] },
    { key: 'alt', names: ['谷丙转氨酶', 'ALT'], unit: 'U/L', range: [0, 40] },
    { key: 'ast', names: ['谷草转氨酶', 'AST'], unit: 'U/L', range: [0, 40] },
    { key: 'creatinine', names: ['肌酐', 'Cr', 'CREA'], unit: 'μmol/L', range: [57, 97] },
    { key: 'uricAcid', names: ['尿酸', 'UA'], unit: 'μmol/L', range: [208, 428] },
    { key: 'hba1c', names: ['糖化血红蛋白', 'HbA1c'], unit: '%', range: [4, 6] },
    { key: 'tsh', names: ['促甲状腺激素', 'TSH'], unit: 'mIU/L', range: [0.27, 4.2] }
  ];

  function findNumber(window) {
    const m = window.match(/[-+]?\d+(?:\.\d+)?/);
    return m ? m[0] : null;
  }

  /* 从文本中识别结构化指标（启发式，仅供参考） */
  function parseIndicators(text) {
    if (!text) return [];
    const lower = text.toLowerCase();
    const found = [];
    const seen = new Set();
    for (const m of METRICS) {
      if (seen.has(m.key)) continue;
      let hitName = null, hitIdx = -1;
      for (const name of m.names) {
        const idx = lower.indexOf(name.toLowerCase());
        if (idx !== -1 && (hitIdx === -1 || idx < hitIdx)) { hitIdx = idx; hitName = name; }
      }
      if (hitIdx === -1) continue;
      const window = text.slice(hitIdx + hitName.length, hitIdx + hitName.length + 90);
      const value = findNumber(window);
      const refMatch = window.match(/[（(]\s*(\d+(?:\.\d+)?)\s*[-~～至]\s*(\d+(?:\.\d+)?)\s*[)）]/);
      const refRange = refMatch ? `${refMatch[1]}-${refMatch[2]}` : (m.range ? m.range.join('-') : '');
      let abnormal = '';
      if (value != null && refRange) {
        const v = parseFloat(value);
        const parts = refRange.split('-').map(Number);
        if (parts.length === 2 && !isNaN(v)) {
          if (v < parts[0]) abnormal = '↓ 偏低';
          else if (v > parts[1]) abnormal = '↑ 偏高';
          else abnormal = '正常';
        }
      }
      seen.add(m.key);
      found.push({ key: m.key, name: m.names[0], value, unit: m.unit || '', refRange, abnormal });
    }
    return found;
  }

  /* 依据文本/文件名自动判断记录类型 */
  function detectType(text, filename) {
    const t = ((text || '') + ' ' + (filename || '')).toLowerCase();
    const rules = [
      ['lab', ['化验', '检验', '白细胞', '红细胞', '血红蛋白', '血小板', '血糖', '血脂', '肝功能', '肾功能', '转氨酶', '肌酐', '尿酸', '尿常规', '血常规', '胆固醇', '甘油三酯', '血样', '血液']],
      ['imaging', ['ct', 'x光', '胸片', 'b超', '彩超', '超声', '核磁', 'mri', '影像', 'dr', '钼靶']],
      ['medication', ['处方', '医嘱', '剂量', '用法', '每日', '口服', '药品', '开药', '药']],
      ['vitals', ['体重', '血压', '心率', '体温', '脉搏', '收缩压', '舒张压']],
      ['symptom', ['疼', '痛', '晕', '乏力', '失眠', '咳嗽', '发烧', '发热', '不舒服', '感觉', '症状', '难受', '酸', '麻']],
      ['exam', ['体检', '报告', '年度', '健康检查', '入职']]
    ];
    let best = 'other', bestScore = 0;
    for (const [type, kws] of rules) {
      let s = 0;
      for (const k of kws) if (t.includes(k)) s++;
      if (s > bestScore) { bestScore = s; best = type; }
    }
    return best;
  }

  window.Parser = { ocrImage, extractPdfText, parseIndicators, detectType, METRICS };
})();
