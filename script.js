const app = {
    // State
    participants: [], 
    queue: [], // Array of names
    theme: 'light',
    targetName: null,

    init() {
        const savedParticipants = localStorage.getItem('sq_v3_participants');
        const savedQueue = localStorage.getItem('sq_v3_queue');
        const savedTheme = localStorage.getItem('sq_v3_theme');
        
        if (savedParticipants) {
            this.participants = JSON.parse(savedParticipants);
            document.getElementById('input-names').value = this.participants.map(p => p.name).join('\n');
        }
        
        if (savedQueue) {
            this.queue = JSON.parse(savedQueue);
        }

        // Theme Init
        if (savedTheme) {
            this.theme = savedTheme;
        }
        this.applyTheme();

        if (this.participants.length === 0) {
            this.toggleView('setup');
        } else {
            this.renderList();
        }
    },

    // --- Core Logic ---

    saveNamesAndStart() {
        const rawText = document.getElementById('input-names').value;
        const newNames = rawText.split('\n').map(n => n.trim()).filter(n => n.length > 0);

        if (newNames.length === 0) {
            alert("Please enter at least one name.");
            return;
        }

        const mergedParticipants = newNames.map(name => {
            const existing = this.participants.find(p => p.name === name);
            return {
                name: name,
                speakCount: existing ? existing.speakCount : 0
            };
        });

        this.queue = this.queue.filter(qName => newNames.includes(qName));
        this.participants = mergedParticipants;
        this.saveState();
        this.toggleView('list');
        this.renderList();
    },

    resetQueue() {
        if(confirm("Clear the waiting line?")) {
            this.queue = [];
            this.saveState();
            this.renderList();
        }
    },

    addToQueue(name) {
        if (!this.queue.includes(name)) {
            this.queue.push(name);
            this.saveState();
            this.renderList();
        }
    },

    removeFromQueue(name, didSpeak = false) {
        this.queue = this.queue.filter(n => n !== name);
        
        if (didSpeak) {
            const p = this.participants.find(p => p.name === name);
            if (p) p.speakCount++;
        }

        this.saveState();
        this.renderList();
    },

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.applyTheme();
        this.saveState();
    },

    applyTheme() {
        if (this.theme === 'dark') {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    },

    // --- UI Rendering ---

    toggleView(viewName) {
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        document.getElementById('view-' + viewName).classList.add('active');
    },

    toggleStats() {
        const panel = document.getElementById('stats-panel');
        if (panel.style.display === 'none') {
            panel.style.display = 'block';
        } else {
            panel.style.display = 'none';
        }
    },

    renderList() {
        const container = document.getElementById('participants-container');
        container.innerHTML = '';

        // Header Stats
        const countText = `${this.queue.length} speakers / ${this.participants.length} participants`;
        document.getElementById('stats-counter').textContent = countText;

        // --- Sorting Logic for List ---
        // Active speakers first (sorted by queue order)
        // Inactive speakers last (sorted by original entry order)
        const activeNames = this.queue;
        const inactiveNames = this.participants
            .map(p => p.name)
            .filter(n => !activeNames.includes(n));

        // Combine them for display
        const displayOrderNames = [...activeNames, ...inactiveNames];

        displayOrderNames.forEach(name => {
            const p = this.participants.find(part => part.name === name);
            if(!p) return; 

            const queueIndex = this.queue.indexOf(p.name);
            const isActive = queueIndex !== -1;
            
            const row = document.createElement('div');
            row.className = `speaker-row ${isActive ? 'active' : ''}`;

            let contentHtml = '';

            // Main Row Area
            contentHtml += `<div class="speaker-main" onclick="app.handleMainClick('${p.name}', ${isActive})">`;
            
            if (isActive) {
                contentHtml += `<div class="queue-badge">${queueIndex + 1}</div>`;
                contentHtml += `
                    <div class="speaker-info">
                        <span class="speaker-name">${p.name}</span>
                        <span class="speaker-status-icon">🔊</span>
                    </div>`;
            } else {
                // Inactive
                contentHtml += `
                    <div class="speaker-info" style="padding-left: 4px;">
                        <span class="speaker-status-icon" style="color:#ccc; margin-right: 12px;">🔇</span>
                        <span class="speaker-name" style="opacity: 0.7;">${p.name}</span>
                    </div>
                    <span style="font-size: 0.7rem; color: #999; text-transform: uppercase; font-weight: bold;">Tap to Add</span>`;
            }
            contentHtml += `</div>`;

            // Control Buttons (Only if active)
            if (isActive) {
                contentHtml += `
                    <div class="speaker-controls">
                        <button onclick="app.openAssignModal('${p.name}')" class="btn-change">
                            <span>CHANGE PLACE</span>
                        </button>
                        <button onclick="app.confirmRemove('${p.name}')" class="btn-remove">
                            <span>REMOVE</span>
                        </button>
                        <button onclick="app.markDone('${p.name}')" class="btn-done">
                            <span>DONE SPEAKING</span>
                        </button>
                    </div>
                `;
            }

            row.innerHTML = contentHtml;
            container.appendChild(row);
        });

        this.renderStatsPanel();
    },

    renderStatsPanel() {
        const tbody = document.getElementById('stats-body');
        tbody.innerHTML = '';

        // Sort: Ascending (Zero speaks first, then 1, 2...)
        const sorted = [...this.participants].sort((a, b) => a.speakCount - b.speakCount);

        sorted.forEach(p => {
            const tr = document.createElement('tr');
            
            let badge = '';
            if (p.speakCount === 0) badge = `<span class="badge badge-silent">Silent So Far</span>`;
            
            tr.innerHTML = `
                <td>${p.name} ${badge}</td>
                <td style="text-align: right;">${p.speakCount}</td>
            `;
            tbody.appendChild(tr);
        });
    },

    handleMainClick(name, isActive) {
        // If inactive, add to queue (active)
        if (!isActive) {
            this.addToQueue(name);
        } 
        // If active, do nothing (controls are below)
    },

    // --- Actions ---

    confirmRemove(name) {
        this.targetName = name;
        document.getElementById('confirm-name').textContent = name;
        this.openModal('modal-confirm');
        
        const yesBtn = document.getElementById('btn-confirm-yes');
        yesBtn.onclick = () => {
            // False = Do NOT increment speak count
            this.removeFromQueue(this.targetName, false); 
            this.closeModal('modal-confirm');
        };
    },

    markDone(name) {
        // True = Increment speak count
        this.removeFromQueue(name, true);
    },

    openAssignModal(name) {
        this.targetName = name;
        const currentPos = this.queue.indexOf(name) + 1;
        const maxPos = this.queue.length;

        document.getElementById('assign-name').textContent = name;
        
        const slider = document.getElementById('assign-slider');
        const input = document.getElementById('assign-input');
        
        slider.max = maxPos; 
        slider.value = currentPos;
        input.value = currentPos;
        this.updateSliderDisplay(currentPos);

        this.openModal('modal-assign');

        const saveBtn = document.getElementById('btn-assign-save');
        saveBtn.onclick = () => {
            const val = parseInt(document.getElementById('assign-input').value);
            if (val && val > 0) {
                this.manualAssign(this.targetName, val);
            }
            this.closeModal('modal-assign');
        };
    },

    manualAssign(name, position) {
        let tempQueue = this.queue.filter(n => n !== name);
        if (position >= tempQueue.length + 1) {
            tempQueue.push(name);
        } else {
            tempQueue.splice(position - 1, 0, name);
        }
        this.queue = tempQueue;
        this.saveState();
        this.renderList();
    },

    // --- Helpers ---
    updateSliderDisplay(val) {
        document.getElementById('slider-display').textContent = val;
        document.getElementById('assign-input').value = val;
    },
    
    syncSlider(val) {
        document.getElementById('assign-slider').value = val;
        document.getElementById('slider-display').textContent = val;
    },

    saveState() {
        localStorage.setItem('sq_v3_participants', JSON.stringify(this.participants));
        localStorage.setItem('sq_v3_queue', JSON.stringify(this.queue));
        localStorage.setItem('sq_v3_theme', this.theme);
    },

    openModal(id) {
        document.getElementById(id).classList.add('open');
    },

    closeModal(id) {
        document.getElementById(id).classList.remove('open');
        this.targetName = null;
    }
};

window.addEventListener('DOMContentLoaded', () => app.init());