const AppState = {
  inspirations: [],
  currentView: 'record',
  currentFilter: 'all',
  searchQuery: '',
  isRecording: false,
  recordingStartTime: null,
  recordingDuration: 0,
  settings: {
    autoTranscribe: true,
    autoTag: true,
    dailyReview: true,
    reviewTime: '21:00',
    soundEffects: true
  }
};

const Storage = {
  KEY_INSPIRATIONS: 'inspiration_recorder_inspirations',
  KEY_SETTINGS: 'inspiration_recorder_settings',

  loadInspirations() {
    try {
      const data = localStorage.getItem(this.KEY_INSPIRATIONS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to load inspirations:', e);
      return [];
    }
  },

  saveInspirations(inspirations) {
    try {
      localStorage.setItem(this.KEY_INSPIRATIONS, JSON.stringify(inspirations));
    } catch (e) {
      console.error('Failed to save inspirations:', e);
    }
  },

  loadSettings() {
    try {
      const data = localStorage.getItem(this.KEY_SETTINGS);
      return data ? JSON.parse(data) : AppState.settings;
    } catch (e) {
      console.error('Failed to load settings:', e);
      return AppState.settings;
    }
  },

  saveSettings(settings) {
    try {
      localStorage.setItem(this.KEY_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }
};

const AITagger = {
  typeKeywords: {
    inspiration: ['灵感', '想法', '创意', '方案', '可以', '想到', '设计', '产品', '功能', '优化', '改进', '创新', '构思'],
    todo: ['待办', '要做', '需要', '记得', '明天', '今天', '会议', '安排', '任务', '计划', '准备', '完成', '提交'],
    memo: ['备忘', '记录', '记下', '注意', '提醒', '保存', '收藏', '资料', '信息', '数据'],
    mood: ['感觉', '心情', '情绪', '开心', '难过', '焦虑', '压力', '兴奋', '疲惫', '感动', '生气', '平静'],
    book: ['读', '书', '看到', '文章里', '书中', '这句话', '这段', '读书笔记', '书摘', '引用']
  },

  tagKeywords: {
    '产品功能': ['产品', '功能', '需求', '迭代', '版本', '用户', '体验', '交互'],
    '工作安排': ['工作', '安排', '任务', '计划', '项目', '进度', 'deadline', '截止'],
    '创意灵感': ['创意', '灵感', '想法', '思路', '构思', '设计', '创新', '方案'],
    '学习笔记': ['学习', '笔记', '知识', '概念', '理论', '方法', '技巧', '总结'],
    '生活感悟': ['生活', '感悟', '人生', '体会', '思考', '道理', '心得'],
    '健康运动': ['运动', '健身', '健康', '跑步', '锻炼', '饮食', '睡眠', '休息']
  },

  classifyType(text) {
    const scores = {};
    for (const [type, keywords] of Object.entries(this.typeKeywords)) {
      scores[type] = keywords.reduce((count, kw) => {
        return count + (text.includes(kw) ? 1 : 0);
      }, 0);
    }
    
    const maxType = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b);
    return maxType[1] > 0 ? maxType[0] : 'inspiration';
  },

  generateTags(text, type) {
    const tags = [];
    const typeNames = {
      inspiration: '灵感',
      todo: '待办',
      memo: '备忘',
      mood: '情绪',
      book: '书摘'
    };
    
    if (typeNames[type]) {
      tags.push(typeNames[type]);
    }
    
    for (const [tag, keywords] of Object.entries(this.tagKeywords)) {
      const matches = keywords.some(kw => text.includes(kw));
      if (matches) {
        tags.push(tag);
      }
    }
    
    return tags.slice(0, 4);
  },

  generateSummary(text) {
    const sentences = text.split(/[。！？.!?\n]/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return text.slice(0, 50) + '...';
    if (sentences.length === 1) return sentences[0];
    return sentences.slice(0, 2).join('。') + '。';
  },

  expandIdea(text) {
    const expansions = [
      `这个想法可以从以下几个方面展开：首先，明确核心目标——${text.slice(0, 30)}...的关键价值是什么？其次，思考实现路径：需要哪些资源、技术和人力支持？最后，评估可行性和潜在风险，确保方案能够落地执行。`,
      `围绕这个灵感，可以进一步深化：1）用户视角——这个想法解决了什么人的什么问题？2）技术视角——实现的难点在哪里，有哪些替代方案？3）商业视角——如果产品化，价值主张是什么？建议把这些角度都记录下来，让想法更完整。`,
      `这个思路很有意思！可以尝试用"5W1H"方法来展开：What（是什么）、Why（为什么重要）、Who（为谁做）、When（什么时候做）、Where（在什么场景下）、How（怎么做）。系统地梳理后，灵感会更有可执行性。`
    ];
    return expansions[Math.floor(Math.random() * expansions.length)];
  }
};

const InspirationManager = {
  addInspiration(data) {
    const inspiration = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      content: data.content,
      type: data.type || 'inspiration',
      tags: data.tags || [],
      summary: data.summary || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isArchived: false,
      isTodo: data.type === 'todo',
      isCompleted: false,
      audioUrl: data.audioUrl || null,
      duration: data.duration || 0
    };
    
    AppState.inspirations.unshift(inspiration);
    Storage.saveInspirations(AppState.inspirations);
    return inspiration;
  },

  updateInspiration(id, updates) {
    const index = AppState.inspirations.findIndex(i => i.id === id);
    if (index !== -1) {
      AppState.inspirations[index] = {
        ...AppState.inspirations[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      Storage.saveInspirations(AppState.inspirations);
      return AppState.inspirations[index];
    }
    return null;
  },

  deleteInspiration(id) {
    AppState.inspirations = AppState.inspirations.filter(i => i.id !== id);
    Storage.saveInspirations(AppState.inspirations);
  },

  getInspiration(id) {
    return AppState.inspirations.find(i => i.id === id);
  },

  getFilteredInspirations() {
    let result = [...AppState.inspirations];
    
    if (AppState.currentFilter !== 'all') {
      if (AppState.currentFilter === 'archived') {
        result = result.filter(i => i.isArchived);
      } else if (AppState.currentFilter === 'todo') {
        result = result.filter(i => i.isTodo && !i.isCompleted);
      } else {
        result = result.filter(i => i.type === AppState.currentFilter && !i.isArchived);
      }
    } else {
      result = result.filter(i => !i.isArchived);
    }
    
    if (AppState.searchQuery.trim()) {
      const query = AppState.searchQuery.toLowerCase();
      result = result.filter(i => 
        i.content.toLowerCase().includes(query) ||
        i.tags.some(t => t.toLowerCase().includes(query))
      );
    }
    
    return result;
  },

  getTodayInspirations() {
    const today = new Date().toDateString();
    return AppState.inspirations.filter(i => {
      const date = new Date(i.createdAt);
      return date.toDateString() === today && !i.isArchived;
    });
  },

  getStats() {
    const today = this.getTodayInspirations();
    const total = AppState.inspirations.filter(i => !i.isArchived).length;
    const todoCount = AppState.inspirations.filter(i => i.isTodo && !i.isCompleted && !i.isArchived).length;
    const archivedCount = AppState.inspirations.filter(i => i.isArchived).length;
    
    return { total, today: today.length, todo: todoCount, archived: archivedCount };
  },

  getTypeCounts() {
    const counts = {
      inspiration: 0,
      todo: 0,
      memo: 0,
      mood: 0,
      book: 0
    };
    
    AppState.inspirations.filter(i => !i.isArchived).forEach(i => {
      if (counts[i.type] !== undefined) {
        counts[i.type]++;
      }
    });
    
    return counts;
  }
};

const VoiceRecorder = {
  mediaRecorder: null,
  audioChunks: [],
  recognition: null,
  finalTranscript: '',
  isRecognizing: false,

  async init() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('MediaDevices API not supported');
      return false;
    }
    return true;
  },

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.start();
      
      if (AppState.settings.autoTranscribe) {
        this.startRecognition();
      }
      
      return true;
    } catch (e) {
      console.error('Failed to start recording:', e);
      UI.showToast('无法访问麦克风，请检查权限设置', 'error');
      return false;
    }
  },

  async stopRecording() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve({ audioUrl: null, transcript: this.finalTranscript });
        return;
      }
      
      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        this.mediaRecorder = null;
        
        this.stopRecognition();
        
        resolve({ audioUrl, transcript: this.finalTranscript });
      };
      
      this.mediaRecorder.stop();
    });
  },

  startRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported');
      return;
    }
    
    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'zh-CN';
      
      this.finalTranscript = '';
      this.isRecognizing = false;
      
      this.recognition.onresult = (event) => {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            this.finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        UI.updateTranscript(this.finalTranscript + interimTranscript);
      };
      
      this.recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
      };
      
      this.recognition.onend = () => {
        if (AppState.isRecording && this.isRecognizing) {
          try {
            this.recognition.start();
          } catch (e) {
            console.warn('Failed to restart recognition:', e);
          }
        }
      };
      
      this.recognition.start();
      this.isRecognizing = true;
    } catch (e) {
      console.error('Failed to start recognition:', e);
    }
  },

  stopRecognition() {
    this.isRecognizing = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.warn('Failed to stop recognition:', e);
      }
      this.recognition = null;
    }
  }
};

const UI = {
  init() {
    this.loadData();
    this.bindEvents();
    this.renderSidebarStats();
    this.switchView('record');
    this.checkDailyReview();
  },

  loadData() {
    AppState.inspirations = Storage.loadInspirations();
    const savedSettings = Storage.loadSettings();
    AppState.settings = { ...AppState.settings, ...savedSettings };
  },

  bindEvents() {
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        this.switchView(view);
        this.closeMobileSidebar();
      });
    });

    const recordBtn = document.getElementById('recordBtn');
    if (recordBtn) {
      recordBtn.addEventListener('click', () => this.toggleRecording());
    }

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && AppState.currentView === 'record') {
        e.preventDefault();
        this.toggleRecording();
      }
      if (e.code === 'Escape' && AppState.isRecording) {
        this.toggleRecording();
      }
    });

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        AppState.searchQuery = e.target.value;
        if (AppState.currentView === 'list') {
          this.renderInspirationList();
        }
      });
    }

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        AppState.currentFilter = filter;
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderInspirationList();
      });
    });

    const modalOverlay = document.getElementById('detailModal');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay || e.target.closest('.detail-close-btn')) {
          this.closeDetailModal();
        }
      });
    }

    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', () => this.toggleMobileSidebar());
    }

    const sidebarOverlay = document.getElementById('sidebarOverlay');
    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', () => this.closeMobileSidebar());
    }

    document.querySelectorAll('.toggle-switch').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const setting = toggle.dataset.setting;
        if (setting && AppState.settings.hasOwnProperty(setting)) {
          AppState.settings[setting] = !AppState.settings[setting];
          toggle.classList.toggle('active', AppState.settings[setting]);
          Storage.saveSettings(AppState.settings);
        }
      });
    });
  },

  switchView(view) {
    AppState.currentView = view;
    
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.classList.toggle('active', item.dataset.view === view);
    });
    
    document.querySelectorAll('.view').forEach(v => {
      v.classList.remove('active');
    });
    
    const targetView = document.getElementById(`${view}View`);
    if (targetView) {
      targetView.classList.add('active');
    }
    
    const topbarTitle = document.getElementById('topbarTitle');
    const titles = {
      record: '快速记录',
      list: '灵感列表',
      review: '每日回顾',
      settings: '设置'
    };
    if (topbarTitle && titles[view]) {
      topbarTitle.textContent = titles[view];
    }
    
    const searchBox = document.querySelector('.search-box');
    if (searchBox) {
      searchBox.style.display = (view === 'list') ? 'block' : 'none';
    }
    
    if (view === 'list') {
      this.renderInspirationList();
    } else if (view === 'review') {
      this.renderReviewView();
    } else if (view === 'settings') {
      this.renderSettings();
    }
    
    this.updateNavBadges();
  },

  updateNavBadges() {
    const stats = InspirationManager.getStats();
    const typeCounts = InspirationManager.getTypeCounts();
    
    const setBadge = (view, count) => {
      const item = document.querySelector(`.nav-item[data-view="${view}"] .nav-badge`);
      if (item) {
        item.textContent = count;
        item.style.display = count > 0 ? 'block' : 'none';
      }
    };
    
    setBadge('list', stats.total);
    setBadge('review', stats.today);
  },

  async toggleRecording() {
    if (AppState.isRecording) {
      await this.stopRecording();
    } else {
      await this.startRecording();
    }
  },

  async startRecording() {
    const supported = await VoiceRecorder.init();
    if (!supported) {
      this.showToast('您的浏览器不支持录音功能', 'error');
      return;
    }
    
    const started = await VoiceRecorder.startRecording();
    if (!started) return;
    
    AppState.isRecording = true;
    AppState.recordingStartTime = Date.now();
    AppState.recordingDuration = 0;
    
    const recordBtn = document.getElementById('recordBtn');
    const status = document.getElementById('recordStatus');
    const timer = document.getElementById('recordTimer');
    const waveform = document.getElementById('waveform');
    const transcriptPreview = document.getElementById('transcriptPreview');
    
    if (recordBtn) recordBtn.classList.add('recording');
    if (status) {
      status.textContent = '正在录音...';
      status.classList.add('recording');
    }
    if (timer) {
      timer.textContent = '00:00';
      timer.classList.add('active');
    }
    if (waveform) waveform.classList.add('active');
    if (transcriptPreview) transcriptPreview.classList.remove('visible');
    
    this.timerInterval = setInterval(() => {
      AppState.recordingDuration = Math.floor((Date.now() - AppState.recordingStartTime) / 1000);
      const m = String(Math.floor(AppState.recordingDuration / 60)).padStart(2, '0');
      const s = String(AppState.recordingDuration % 60).padStart(2, '0');
      if (timer) timer.textContent = `${m}:${s}`;
    }, 1000);
  },

  async stopRecording() {
    if (!AppState.isRecording) return;
    
    clearInterval(this.timerInterval);
    
    const result = await VoiceRecorder.stopRecording();
    
    AppState.isRecording = false;
    
    const recordBtn = document.getElementById('recordBtn');
    const status = document.getElementById('recordStatus');
    const timer = document.getElementById('recordTimer');
    const waveform = document.getElementById('waveform');
    
    if (recordBtn) recordBtn.classList.remove('recording');
    if (status) {
      status.textContent = '点击按钮开始录音';
      status.classList.remove('recording');
    }
    if (timer) timer.classList.remove('active');
    if (waveform) waveform.classList.remove('active');
    
    let content = result.transcript;
    if (!content || content.trim().length === 0) {
      const demoTexts = [
        '想到了一个新功能，可以在用户完成录音后自动生成思维导图，把语音中的关键概念提取出来，用可视化的方式展示想法之间的关联。',
        '明天上午10点开会，记得带上Q2的用户增长数据报告，还有上周做的竞品分析PPT，需要跟产品团队讨论下一步迭代方向。',
        '读《认知觉醒》这本书的时候想到的，人的注意力就像手电筒的光束，聚焦才能照亮，发散只能看到模糊的轮廓。这个比喻可以用在下一篇文章里。'
      ];
      content = demoTexts[Math.floor(Math.random() * demoTexts.length)];
      this.showToast('已使用示例文本（语音识别需HTTPS环境）', 'success');
    }
    
    const type = AppState.settings.autoTag ? AITagger.classifyType(content) : 'inspiration';
    const tags = AppState.settings.autoTag ? AITagger.generateTags(content, type) : [];
    const summary = AITagger.generateSummary(content);
    
    const inspiration = InspirationManager.addInspiration({
      content,
      type,
      tags,
      summary,
      audioUrl: result.audioUrl,
      duration: AppState.recordingDuration
    });
    
    this.showTranscriptPreview(inspiration);
    this.renderSidebarStats();
    this.updateNavBadges();
    this.showToast('灵感已保存！', 'success');
  },

  updateTranscript(text) {
    const transcriptText = document.querySelector('.transcript-text');
    const transcriptPreview = document.getElementById('transcriptPreview');
    
    if (transcriptText && text.trim().length > 0) {
      transcriptText.textContent = text;
      if (transcriptPreview) transcriptPreview.classList.add('visible');
    }
  },

  showTranscriptPreview(inspiration) {
    const transcriptPreview = document.getElementById('transcriptPreview');
    const transcriptText = document.querySelector('#transcriptPreview .transcript-text');
    const transcriptTags = document.getElementById('transcriptTags');
    
    if (transcriptText) {
      transcriptText.textContent = inspiration.content;
    }
    
    if (transcriptTags) {
      transcriptTags.innerHTML = '';
      inspiration.tags.forEach(tag => {
        const tagEl = document.createElement('span');
        tagEl.className = `tag tag-${inspiration.type}`;
        tagEl.textContent = tag;
        transcriptTags.appendChild(tagEl);
      });
    }
    
    if (transcriptPreview) {
      transcriptPreview.classList.add('visible');
    }
  },

  renderSidebarStats() {
    const stats = InspirationManager.getStats();
    
    const totalEl = document.querySelector('.stat-item:nth-child(1) .stat-number');
    const todayEl = document.querySelector('.stat-item:nth-child(2) .stat-number');
    
    if (totalEl) totalEl.textContent = stats.total;
    if (todayEl) todayEl.textContent = stats.today;
  },

  renderInspirationList() {
    const listContainer = document.getElementById('inspirationList');
    if (!listContainer) return;
    
    const inspirations = InspirationManager.getFilteredInspirations();
    
    if (inspirations.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" x2="12" y1="19" y2="22"></line>
            </svg>
          </div>
          <h3 class="empty-title">还没有灵感记录</h3>
          <p class="empty-desc">点击下方按钮开始记录你的第一个灵感吧！</p>
        </div>
      `;
      return;
    }
    
    listContainer.innerHTML = inspirations.map(inspiration => this.createInspirationCard(inspiration)).join('');
    
    listContainer.querySelectorAll('.inspiration-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.action-btn') || e.target.closest('.inspiration-actions')) return;
        const id = card.dataset.id;
        this.openDetailModal(id);
      });
    });
    
    listContainer.querySelectorAll('.action-btn[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        this.handleInspirationAction(action, id);
      });
    });
  },

  createInspirationCard(inspiration) {
    const typeNames = {
      inspiration: '灵感',
      todo: '待办',
      memo: '备忘',
      mood: '情绪',
      book: '书摘'
    };
    
    const typeIcons = {
      inspiration: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
      todo: '<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>',
      memo: '<rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect><line x1="16" x2="16" y1="2" y2="6"></line><line x1="8" x2="8" y1="2" y2="6"></line><line x1="3" x2="21" y1="10" y2="10"></line>',
      mood: '<circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" x2="9.01" y1="9" y2="9"></line><line x1="15" x2="15.01" y1="9" y2="9"></line>',
      book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>'
    };
    
    const time = this.formatTime(inspiration.createdAt);
    
    return `
      <div class="inspiration-card" data-id="${inspiration.id}">
        <div class="inspiration-card-header">
          <div class="inspiration-type type-${inspiration.type}">
            <div class="type-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                ${typeIcons[inspiration.type] || typeIcons.inspiration}
              </svg>
            </div>
            ${typeNames[inspiration.type] || '灵感'}
          </div>
          <span class="inspiration-time">${time}</span>
        </div>
        <p class="inspiration-content">${this.escapeHtml(inspiration.content)}</p>
        <div class="inspiration-tags">
          ${inspiration.tags.map(tag => `<span class="tag tag-${inspiration.type}">${this.escapeHtml(tag)}</span>`).join('')}
        </div>
        <div class="inspiration-actions">
          <button class="action-btn" data-action="toggle-todo" data-id="${inspiration.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              ${inspiration.isTodo ? '<polyline points="20 6 9 17 4 12"></polyline>' : '<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>'}
            </svg>
            ${inspiration.isTodo ? '取消待办' : '设为待办'}
          </button>
          <button class="action-btn" data-action="archive" data-id="${inspiration.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="20" height="5" x="2" y="3" rx="1"></rect>
              <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path>
              <path d="M10 12h4"></path>
            </svg>
            归档
          </button>
          <button class="action-btn danger" data-action="delete" data-id="${inspiration.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18"></path>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            </svg>
            删除
          </button>
        </div>
      </div>
    `;
  },

  handleInspirationAction(action, id) {
    const inspiration = InspirationManager.getInspiration(id);
    if (!inspiration) return;
    
    switch (action) {
      case 'toggle-todo':
        InspirationManager.updateInspiration(id, { isTodo: !inspiration.isTodo });
        this.showToast(inspiration.isTodo ? '已取消待办' : '已设为待办', 'success');
        break;
      case 'archive':
        InspirationManager.updateInspiration(id, { isArchived: !inspiration.isArchived });
        this.showToast(inspiration.isArchived ? '已取消归档' : '已归档', 'success');
        break;
      case 'delete':
        if (confirm('确定要删除这条灵感吗？')) {
          InspirationManager.deleteInspiration(id);
          this.showToast('已删除', 'success');
        }
        break;
      case 'complete':
        InspirationManager.updateInspiration(id, { isCompleted: !inspiration.isCompleted });
        this.showToast(inspiration.isCompleted ? '已标记为未完成' : '已完成！', 'success');
        break;
    }
    
    this.renderInspirationList();
    this.renderSidebarStats();
    this.updateNavBadges();
    
    if (AppState.currentView === 'review') {
      this.renderReviewView();
    }
    
    if (AppState.currentView === 'detail') {
      this.updateDetailModal(id);
    }
  },

  openDetailModal(id) {
    const inspiration = InspirationManager.getInspiration(id);
    if (!inspiration) return;
    
    this.currentDetailId = id;
    this.updateDetailModal(id);
    
    const modal = document.getElementById('detailModal');
    if (modal) {
      modal.classList.add('visible');
    }
  },

  updateDetailModal(id) {
    const inspiration = InspirationManager.getInspiration(id);
    if (!inspiration) return;
    
    const typeNames = {
      inspiration: '灵感',
      todo: '待办',
      memo: '备忘',
      mood: '情绪',
      book: '书摘'
    };
    
    const modal = document.getElementById('detailModal');
    if (!modal) return;
    
    const titleEl = modal.querySelector('.detail-modal-title');
    const contentEl = modal.querySelector('.detail-content');
    const metaEl = modal.querySelector('.detail-meta');
    const tagsEl = modal.querySelector('.detail-tags');
    const actionsEl = modal.querySelector('.detail-actions');
    
    if (titleEl) titleEl.textContent = typeNames[inspiration.type] + '详情';
    if (contentEl) contentEl.textContent = inspiration.content;
    
    if (metaEl) {
      metaEl.innerHTML = `
        <div class="detail-meta-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          ${this.formatFullTime(inspiration.createdAt)}
        </div>
        ${inspiration.duration ? `
        <div class="detail-meta-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" x2="12" y1="19" y2="22"></line>
          </svg>
          ${inspiration.duration}秒
        </div>
        ` : ''}
      `;
    }
    
    if (tagsEl) {
      tagsEl.innerHTML = inspiration.tags.map(tag => 
        `<span class="tag tag-${inspiration.type}">${this.escapeHtml(tag)}</span>`
      ).join('');
    }
    
    if (actionsEl) {
      actionsEl.innerHTML = `
        <button class="action-btn" onclick="UI.handleInspirationAction('toggle-todo', '${inspiration.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${inspiration.isTodo ? '<polyline points="20 6 9 17 4 12"></polyline>' : '<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>'}
          </svg>
          ${inspiration.isTodo ? '取消待办' : '设为待办'}
        </button>
        <button class="action-btn" onclick="UI.handleInspirationAction('archive', '${inspiration.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="20" height="5" x="2" y="3" rx="1"></rect>
            <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path>
            <path d="M10 12h4"></path>
          </svg>
          ${inspiration.isArchived ? '取消归档' : '归档'}
        </button>
        <button class="action-btn danger" onclick="UI.handleInspirationAction('delete', '${inspiration.id}'); UI.closeDetailModal();">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"></path>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
          </svg>
          删除
        </button>
      `;
    }
    
    this.updateAIExpand(inspiration);
  },

  updateAIExpand(inspiration) {
    const expandSection = document.querySelector('.ai-expand-section');
    if (!expandSection) return;
    
    const expandText = expandSection.querySelector('.ai-expand-text');
    if (expandText) {
      expandText.textContent = AITagger.expandIdea(inspiration.content);
    }
  },

  closeDetailModal() {
    const modal = document.getElementById('detailModal');
    if (modal) {
      modal.classList.remove('visible');
    }
    this.currentDetailId = null;
  },

  renderReviewView() {
    const todayInspirations = InspirationManager.getTodayInspirations();
    const todoCount = todayInspirations.filter(i => i.isTodo && !i.isCompleted).length;
    const archivedToday = todayInspirations.filter(i => i.isArchived).length;
    
    const statsContainer = document.querySelector('.review-stats');
    if (statsContainer) {
      statsContainer.innerHTML = `
        <div class="review-stat-card">
          <div class="review-stat-number">${todayInspirations.length}</div>
          <div class="review-stat-label">今日记录</div>
        </div>
        <div class="review-stat-card">
          <div class="review-stat-number">${todoCount}</div>
          <div class="review-stat-label">待办事项</div>
        </div>
        <div class="review-stat-card">
          <div class="review-stat-number">${archivedToday}</div>
          <div class="review-stat-label">已归档</div>
        </div>
        <div class="review-stat-card">
          <div class="review-stat-number">${Math.max(0, todayInspirations.length - todoCount - archivedToday)}</div>
          <div class="review-stat-label">待整理</div>
        </div>
      `;
    }
    
    const reviewList = document.querySelector('.review-list');
    if (reviewList) {
      if (todayInspirations.length === 0) {
        reviewList.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" x2="12" y1="19" y2="22"></line>
              </svg>
            </div>
            <h3 class="empty-title">今天还没有灵感</h3>
            <p class="empty-desc">去记录页面捕捉今天的第一个灵感吧！</p>
          </div>
        `;
      } else {
        reviewList.innerHTML = todayInspirations.map(item => `
          <div class="review-item">
            <div class="review-item-checkbox ${item.isCompleted ? 'checked' : ''}" 
                 onclick="UI.handleInspirationAction('complete', '${item.id}'); UI.renderReviewView();">
              ${item.isCompleted ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
            </div>
            <div class="review-item-content">
              <p class="review-item-text">${this.escapeHtml(item.content.slice(0, 100))}${item.content.length > 100 ? '...' : ''}</p>
              <div class="review-item-meta">
                <span>${this.formatTime(item.createdAt)}</span>
                <span>${item.tags.slice(0, 2).map(t => '#' + t).join(' ')}</span>
              </div>
            </div>
            <div class="review-item-actions">
              <button class="review-action-btn" onclick="UI.openDetailModal('${item.id}')">查看</button>
            </div>
          </div>
        `).join('');
      }
    }
  },

  renderSettings() {
    Object.entries(AppState.settings).forEach(([key, value]) => {
      const toggle = document.querySelector(`.toggle-switch[data-setting="${key}"]`);
      if (toggle) {
        toggle.classList.toggle('active', value);
      }
    });
  },

  checkDailyReview() {
    if (!AppState.settings.dailyReview) return;
    
    const now = new Date();
    const [reviewHour, reviewMinute] = AppState.settings.reviewTime.split(':').map(Number);
    
    if (now.getHours() === reviewHour && now.getMinutes() >= reviewMinute) {
      const todayReviewed = localStorage.getItem('inspiration_reviewed_' + now.toDateString());
      if (!todayReviewed) {
        const todayCount = InspirationManager.getTodayInspirations().length;
        if (todayCount > 0) {
          setTimeout(() => {
            this.showToast(`今日有 ${todayCount} 条灵感等待回顾`, 'success');
          }, 2000);
        }
      }
    }
  },

  toggleMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('open');
  },

  closeMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  },

  showToast(message, type = 'success') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${type === 'success' 
          ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'
          : '<circle cx="12" cy="12" r="10"></circle><line x1="15" x2="9" y1="9" y2="15"></line><line x1="9" x2="15" y1="9" y2="15"></line>'
        }
      </svg>
      <span class="toast-message">${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('visible'), 10);
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  },

  formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
    
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  },

  formatFullTime(dateString) {
    const date = new Date(dateString);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  UI.init();
});
