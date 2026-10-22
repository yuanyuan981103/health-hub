/* ===== 健康集 · AI 客户端（通过本地服务器代理转发，解决跨域） ===== */
(function () {
  function buildMessages(systemPrompt, userPrompt) {
    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
  }

  function extractContent(data) {
    const content =
      (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ||
      (data.choices && data.choices[0] && data.choices[0].text) ||
      (data.output_text) ||
      (data.message) || '';
    if (!content) throw new Error('未收到有效回复，请检查接口与模型配置');
    return String(content);
  }

  /* 浏览器直连接口（静态托管下使用，需接口支持 CORS） */
  async function directCall(endpoint, apiKey, model, messages) {
    let resp;
    try {
      resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body: JSON.stringify({ model, messages, stream: false })
      });
    } catch (e) {
      throw new Error('直连接口失败，可能是跨域被拦截（CORS）或网络问题。DeepSeek 已支持浏览器直连；其他接口若被拦截，可在电脑上运行 python server.py 使用。');
    }
    let data;
    try { data = await resp.json(); } catch (e) { throw new Error('接口返回异常（HTTP ' + resp.status + '）'); }
    if (!resp.ok) {
      const err = data && data.error;
      throw new Error((err && (err.message || err)) || ('请求失败（HTTP ' + resp.status + '）'));
    }
    return extractContent(data);
  }

  async function chat(messages, options = {}) {
    const s = window.Settings.load();
    const endpoint = options.endpoint || s.endpoint;
    const apiKey = options.apiKey || s.apiKey;
    const model = options.model || s.model;

    if (!apiKey) {
      throw new Error('尚未配置 API Key，请到「我的 → AI 配置」里填写');
    }
    if (!endpoint) {
      throw new Error('尚未配置接口地址，请到「我的 → AI 配置」里填写');
    }

    // 1) 优先走本地代理（python server.py，能解决跨域，任意接口都可用）
    let viaProxy = false;
    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, apiKey, model, messages })
      });
      const ct = (resp.headers.get('content-type') || '');
      if (ct.includes('application/json')) {
        viaProxy = true;
        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data && data.error ? data.error : '请求失败（HTTP ' + resp.status + '）');
        }
        return extractContent(data);
      }
      // 返回的不是 JSON（静态托管下的 404 页面）→ 没有代理，走直连
    } catch (e) {
      if (viaProxy) throw e; // 代理已响应但出错，直接上报
      // 否则视为没有本地代理，继续直连
    }

    // 2) 浏览器直连（GitHub Pages 等静态托管）
    return directCall(endpoint, apiKey, model, messages);
  }

  const SYSTEM_BASE =
    '你是一位专业、谨慎、友好的健康管理助手。你掌握用户的个人健康档案（体检、化验、用药、体征、症状等）。' +
    '回答要求：1) 基于提供的档案信息给出实用、可操作的建议；2) 条理清晰、口语化、中文；3) 涉及异常指标时解释可能含义，但绝不下诊断；' +
    '4) 每次涉及健康风险时都要温和提醒：你的建议不能替代医生面诊，异常或持续不适请及时就医。';

  async function chatWithContext(userText, contextText) {
    const system = SYSTEM_BASE + '\n\n以下是用户最近的健康档案摘要（可能为空）：\n' + (contextText || '（暂无记录）');
    return chat(buildMessages(system, userText));
  }

  async function summarizeRecord(record) {
    const parts = [];
    parts.push('类型：' + (record.type || '其他'));
    parts.push('标题：' + (record.title || '未命名'));
    parts.push('日期：' + (record.recordDate || ''));
    if (record.indicators && record.indicators.length) {
      parts.push('结构化指标：' + record.indicators
        .map((i) => `${i.name} ${i.value || '-'}${i.unit || ''}${i.refRange ? '（参考范围 ' + i.refRange + '）' : ''}${i.abnormal ? '【' + i.abnormal + '】' : ''}`)
        .join('；'));
    }
    if (record.content) parts.push('原始内容/描述：\n' + record.content.slice(0, 3000));

    const system = SYSTEM_BASE;
    const user = '请针对下面这条健康记录做一次简洁解读，分三个部分：\n【关注要点】【可能提示】【生活建议】\n每部分 1-3 条要点即可，最后附一句就医提醒。\n\n' + parts.join('\n\n');
    return chat(buildMessages(system, user));
  }

  /* 图片压缩为 base64 dataURL（控制请求体积） */
  function downscaleDataURL(blob, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        const scale = Math.min(1, maxDim / Math.max(w, h));
        w = Math.round(w * scale); h = Math.round(h * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', quality || 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片读取失败')); };
      img.src = url;
    });
  }

  /* 用配置的视觉模型识别图片报告（效果优于本地 OCR） */
  async function recognizeImage(blob, opts = {}) {
    const s = window.Settings.load();
    const model = (opts.model || s.visionModel || '').trim();
    if (!model) throw new Error('未配置视觉模型');
    const dataUrl = await downscaleDataURL(blob, 1568, 0.85);
    const messages = [{
      role: 'user',
      content: [
        { type: 'text', text: '请识别这张医学报告/化验单图片中的全部文字内容，并尽量整理出各项检查指标（项目名、数值、单位、参考范围）。只输出你实际看到的文字和指标，不要编造。' },
        { type: 'image_url', image_url: { url: dataUrl } }
      ]
    }];
    return chat(messages, { model });
  }

  window.AI = { chat, chatWithContext, summarizeRecord, recognizeImage };
})();
