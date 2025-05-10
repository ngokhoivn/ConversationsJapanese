document.addEventListener('DOMContentLoaded', function () {
    // DOM Elements
    const chatArea = document.getElementById('chat-area');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const typingIndicator = document.getElementById('typing-indicator');
    const clearChatButton = document.getElementById('clear-chat');
    const clearInputButton = document.getElementById('clear-input');
    const translateButton = document.getElementById('translate-button');

    // Mobile viewport fix
    function setViewportHeight() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    // Initialize viewport and set event listeners
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', () => setTimeout(setViewportHeight, 100));

    // API Key Management
    const API_KEYS = [
        'AIzaSyDjgTk4uZQUCpFH5Zt8ZgP2CW-jhmkLv8o',
        'AIzaSyDaROReiR48rjfavf8Lk6XvphC6QxKPZo4',
        'AIzaSyD-LQ7BMIl85o0Tq3LogG2rBmtYjkOpogU'
    ];
    let currentApiKeyIndex = 0;

    // Get current API key and rotation function
    function getCurrentApiKey() {
        return API_KEYS[currentApiKeyIndex];
    }

    function rotateApiKey() {
        currentApiKeyIndex = (currentApiKeyIndex + 1) % API_KEYS.length;
        console.log(`Switched to API key index: ${currentApiKeyIndex}`);
    }

    // Initialize conversation history
    let conversationHistory = JSON.parse(localStorage.getItem('conversation_history')) || [
        {
            role: "model",
            parts: [{ text: "こんにちは！日本語の練習や会話を楽しみましょう！何か話したいことはありますか？" }]
        }
    ];

    // Conversation management functions
    function generateConversationId() {
        return 'conv_' + Math.random().toString(36).substring(2, 15);
    }

    function generateConversationTitle() {
        if (!conversationHistory || conversationHistory.length <= 1) return "新しい会話";
        const userMessages = conversationHistory.filter(msg => msg.role === "user");
        if (userMessages.length === 0) return "新しい会話";
        const firstMessage = userMessages[0].parts[0].text || "無題";
        return firstMessage.length > 20 ? firstMessage.substring(0, 20) + '...' : firstMessage;
    }

    function generateSummary(history) {
        if (!history || history.length <= 3) return "";
        const userMessages = history.filter(msg => msg.role === "user").map(msg => msg.parts[0].text || "");
        const commonWords = findCommonWords(userMessages);
        return commonWords.length > 0 ? `${commonWords.join('、')}についての会話` : "";
    }

    function findCommonWords(messages) {
        const wordFrequency = {};

        messages.forEach(message => {
            const words = message.split(/[\s,.?!。、？！]/);

            words.forEach(word => {
                if (word.length >= 2) {
                    wordFrequency[word] = (wordFrequency[word] || 0) + 1;
                }
            });
        });

        return Object.entries(wordFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(entry => entry[0]);
    }

    // Render conversation to chat UI
    function renderConversation() {
        chatArea.innerHTML = '';
        conversationHistory.forEach(msg => {
            if (msg.role === "user" || msg.role === "model") {
                const sender = msg.role === "user" ? "user" : "bot";
                addMessageToChat(msg.parts[0].text, sender, false);
            }
        });
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    // Add a message to the chat UI
    function addMessageToChat(content, sender, scroll = true) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        messageDiv.setAttribute('aria-label', sender === 'bot' ? 'ボットからのメッセージ' : 'あなたのメッセージ');

        const contentDiv = document.createElement('div');
        contentDiv.className = `message-content ${sender}-content`;

        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = `message-bubble ${sender}-bubble`;
        bubbleDiv.textContent = content;
        bubbleDiv.setAttribute('role', 'text');
        bubbleDiv.setAttribute('aria-label', content);

        // Create filtered text for accessibility
        const cleanText = content
            .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
            .replace(/\([^)]*\)/g, '')
            .replace(/[【】（）「」『』☆★♪♫♬~〜@#\$%\^&\*_+=`|{}\[\];:"'<>?,./]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        const accessibleDiv = document.createElement('div');
        accessibleDiv.textContent = cleanText;
        accessibleDiv.style.position = 'absolute';
        accessibleDiv.style.left = '-9999px';
        accessibleDiv.setAttribute('aria-hidden', 'false');
        contentDiv.appendChild(accessibleDiv);

        // Create message action buttons
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        actionsDiv.setAttribute('role', 'toolbar');
        actionsDiv.setAttribute('aria-label', 'メッセージのアクション');

        // Read button
        const readBtn = createActionButton(
            'メッセージを読み上げる',
            `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77 0-4.28-2.99-7.86-7-8.77z"/>
            </svg>`,
            () => {
                if (!cleanText || !cleanText.trim()) return;

                const utterance = new SpeechSynthesisUtterance(cleanText);
                utterance.lang = 'ja-JP';
                utterance.rate = 0.9;
                utterance.pitch = 1.1;

                const speak = () => {
                    const voices = speechSynthesis.getVoices();
                    const jpVoice = voices.find(voice => voice.lang === 'ja-JP');
                    if (jpVoice) utterance.voice = jpVoice;
                    speechSynthesis.speak(utterance);
                };

                if (speechSynthesis.getVoices().length > 0) {
                    speak();
                } else {
                    speechSynthesis.onvoiceschanged = () => {
                        speak();
                        speechSynthesis.onvoiceschanged = null;
                    };
                }
            }
        );

        // Copy button
        const copyBtn = createActionButton(
            'メッセージをコピー',
            `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>`,
            (btn) => {
                navigator.clipboard.writeText(content).then(() => {
                    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                    </svg>`;
                    setTimeout(() => {
                        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                        </svg>`;
                    }, 1000);
                });
            }
        );

        actionsDiv.appendChild(readBtn);
        actionsDiv.appendChild(copyBtn);
        contentDiv.appendChild(bubbleDiv);
        contentDiv.appendChild(actionsDiv);
        messageDiv.appendChild(contentDiv);
        chatArea.appendChild(messageDiv);

        if (scroll) {
            setTimeout(() => {
                chatArea.scrollTop = chatArea.scrollHeight;
            }, 10);
        }
    }

    // Helper function to create action buttons
    function createActionButton(ariaLabel, svgIcon, clickHandler) {
        const button = document.createElement('button');
        button.className = 'icon-btn';
        button.innerHTML = svgIcon;
        button.setAttribute('aria-label', ariaLabel);
        button.onclick = () => clickHandler(button);
        return button;
    }

    // Handle keyboard visibility changes
    function handleVisualViewportResize() {
        const isKeyboardVisible = window.visualViewport.height < window.innerHeight * 0.8;

        if (isKeyboardVisible) {
            const keyboardHeight = window.innerHeight - window.visualViewport.height;
            document.querySelector('.input-area').style.bottom = `${keyboardHeight}px`;
            chatArea.style.marginBottom = `${keyboardHeight + 80}px`;
        } else {
            document.querySelector('.input-area').style.bottom = '0';
            chatArea.style.marginBottom = '80px';
        }

        chatArea.scrollTop = chatArea.scrollHeight;
    }

    // Set up visualViewport event listener for keyboard handling
    if ('visualViewport' in window) {
        window.visualViewport.addEventListener('resize', handleVisualViewportResize);
        window.visualViewport.addEventListener('scroll', handleVisualViewportResize);
    }

    // Hàm tóm tắt hội thoại
    async function summarizeConversation(history) {
        const API_KEY = getCurrentApiKey();
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;

        const conversationText = history
            .map(msg => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.parts[0].text}`)
            .join('\n');

        const summaryPrompt = {
            role: "user",
            parts: [{
                text: `Summarize the following conversation in 2-3 concise English sentences, focusing on the user's main intent and topic:\n\n${conversationText}`
            }]
        };

        const requestBody = {
            contents: [summaryPrompt],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 100,
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
            ]
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) throw new Error(`Summary API request failed with status ${response.status}`);
            const data = await response.json();
            return data?.candidates?.[0]?.content?.parts?.[0]?.text || "Unable to summarize.";
        } catch (error) {
            console.error("Error summarizing conversation:", error);
            return "Summary unavailable due to an error.";
        }
    }


    // AI Communication Functions
    async function sendToGeminiAPI(message) {
        const API_KEY = getCurrentApiKey();
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;

        const recentHistory = conversationHistory.slice(-15);

        let contextSummary = localStorage.getItem('conversation_summary') || "";
        if (conversationHistory.length > 10 && !contextSummary) {
            contextSummary = await summarizeConversation(conversationHistory);
            localStorage.setItem('conversation_summary', contextSummary);
        }

        if (conversationHistory.length % 10 === 0) {
            contextSummary = await summarizeConversation(conversationHistory);
            localStorage.setItem('conversation_summary', contextSummary);
        }

        const systemInstruction = {
            role: "system",
            parts: [{
                text: `Context: ${contextSummary}\n\nYou are a friendly Japanese-speaking chatbot. 
Please reply in natural, short Japanese (2-3 sentences), using casual tone, emojis, and a follow-up question if possible. 
Do not repeat the context; just use it for understanding.`
            }]
        };

        const requestBody = {
            contents: [systemInstruction, ...recentHistory],
            generationConfig: {
                temperature: 0.85,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 200,
                stopSequences: []
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
            ]
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
            const data = await response.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
                return text;
            } else {
                throw new Error("Invalid API response structure");
            }
        } catch (error) {
            console.error("Error sending to Gemini API:", error);
            throw error;
        }
    }


    // Context-aware fallback responses
    function getFallbackResponse(message) {
        // Topic-specific responses
        if (message.includes("旅行") || message.includes("行")) {
            return "旅行の話、すごく興味あります！🌏 接続が回復したら、行きたい場所について教えてくださいね！";
        } else if (message.includes("食") || message.includes("料理") || message.includes("レストラン")) {
            return "食べ物の話ですね！😋 サーバー問題が解決したら、好きな料理について話しましょう！";
        } else if (message.includes("アニメ") || message.includes("映画") || message.includes("見")) {
            return "アニメや映画の話、いいですね！📺 ちょっと接続が悪いみたいです…少しだけ待ってみてください！";
        } else if (message.includes("音楽") || message.includes("聞") || message.includes("歌")) {
            return "音楽の話ですか？🎵 接続が直ったら、どんな音楽が好きか教えてくださいね！";
        }

        // Generic responses
        const responses = [
            "あれ？接続が不安定みたい…😅 もう一度試してみてください！",
            "ごめんなさい、エラーが出ちゃいました！もう少ししたらまた話しかけてください🙏",
            "うーん、サーバーが応答してくれないみたい…(´・ω・`) 少し待ってからもう一度お願いします！",
            "あ、ちょっと通信エラーが…💦 もう一回メッセージ送ってみてくれますか？"
        ];

        return responses[Math.floor(Math.random() * responses.length)];
    }

    // Save conversation to localStorage
    function saveConversation() {
        try {
            // ... existing code ...
        } catch (error) {
            console.error("Failed to save conversation:", error);
            // Clean up old conversations if storage is full
            if (error.name === 'QuotaExceededError') {
                const conversationsList = JSON.parse(localStorage.getItem('conversations_list')) || [];
                while (conversationsList.length > 10) {
                    const oldest = conversationsList.shift();
                    localStorage.removeItem(`conversation_${oldest.id}`);
                }
                localStorage.setItem('conversations_list', JSON.stringify(conversationsList));
                // Retry saving
                setTimeout(saveConversation, 100);
            }
        }
    }

    // Update conversations list in localStorage
    function updateConversationsList(conversationData) {
        const conversationsList = JSON.parse(localStorage.getItem('conversations_list')) || [];
        const existingIndex = conversationsList.findIndex(c => c.id === conversationData.id);

        if (existingIndex >= 0) {
            conversationsList[existingIndex] = {
                id: conversationData.id,
                title: conversationData.title,
                lastUpdated: conversationData.lastUpdated,
                summary: conversationData.summary,
                previewText: conversationData.messages[conversationData.messages.length - 1].parts[0].text.substring(0, 50) + '...'
            };
        } else {
            conversationsList.push({
                id: conversationData.id,
                title: conversationData.title,
                lastUpdated: conversationData.lastUpdated,
                summary: conversationData.summary,
                previewText: conversationData.messages[conversationData.messages.length - 1].parts[0].text.substring(0, 50) + '...'
            });
        }

        // Limit stored conversations
        if (conversationsList.length > 50) {
            const oldestConversation = conversationsList.shift();
            localStorage.removeItem(`conversation_${oldestConversation.id}`);
        }

        localStorage.setItem('conversations_list', JSON.stringify(conversationsList));
    }

    // Handle sending messages
    async function handleSendMessage() {
        const message = userInput.value.trim();
        if (message === '') return;

        // Add user message to chat
        addMessageToChat(message, 'user');
        conversationHistory.push({
            role: "user",
            parts: [{ text: message }]
        });
        saveConversation();

        // Clear input and show typing indicator
        userInput.value = '';
        typingIndicator.style.display = 'flex';
        chatArea.scrollTop = chatArea.scrollHeight;

        try {
            // Get AI response
            const response = await sendToGeminiAPI(message);

            // Add AI response to chat
            addMessageToChat(response, 'bot');
            conversationHistory.push({
                role: "model",
                parts: [{ text: response }]
            });
            saveConversation();
        } catch (error) {
            console.error("API Error:", error);
            rotateApiKey();

            // Use fallback response
            const fallbackResponse = getFallbackResponse(message);
            addMessageToChat(fallbackResponse, 'bot');
            conversationHistory.push({
                role: "model",
                parts: [{ text: fallbackResponse }]
            });
            saveConversation();
        } finally {
            typingIndicator.style.display = 'none';
            chatArea.scrollTop = chatArea.scrollHeight;
        }
    }

    // Initialize conversation manager
    function setupConversationManager() {
        const managerButton = document.createElement('button');
        managerButton.className = 'action-button';
        managerButton.id = 'conversation-manager';
        managerButton.title = '会話履歴';
        managerButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                <path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
                <path d="M6 11.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/>
            </svg>
        `;

        const inputContainer = document.querySelector('.input-container');
        if (inputContainer) {
            inputContainer.insertBefore(managerButton, inputContainer.firstChild);
            managerButton.addEventListener('click', showConversationList);
        }
    }

    // Show conversation history list modal
    function showConversationList() {
        const conversationsList = JSON.parse(localStorage.getItem('conversations_list')) || [];

        const modal = document.createElement('div');
        modal.className = 'conversation-modal';
        modal.innerHTML = `
            <div class="conversation-modal-content">
                <div class="conversation-modal-header">
                    <h2>会話履歴</h2>
                    <button class="close-button">&times;</button>
                </div>
                <div class="conversation-list">
                    ${conversationsList.length > 0 ?
                conversationsList.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated))
                    .map(conv => `
                                <div class="conversation-item" data-id="${conv.id}">
                                    <div class="conversation-info">
                                        <h3>${conv.title || '無題の会話'}</h3>
                                        <p class="conversation-date">${new Date(conv.lastUpdated).toLocaleString('ja-JP')}</p>
                                        <p class="conversation-preview">${conv.previewText || '会話の内容がありません'}</p>
                                    </div>
                                    <div class="conversation-actions">
                                        <button class="load-conversation" data-id="${conv.id}">読み込み</button>
                                        <button class="delete-conversation" data-id="${conv.id}">削除</button>
                                    </div>
                                </div>
                            `).join('')
                : '<p class="no-conversations">保存された会話はありません</p>'
            }
                </div>
                <div class="conversation-modal-footer">
                    <button class="new-conversation">新しい会話</button>
                </div>
            </div>
        `;

        // Add CSS styles for modal
        addConversationModalStyles();

        document.body.appendChild(modal);

        // Add event listeners
        modal.querySelector('.close-button').addEventListener('click', () => {
            modal.remove();
        });

        modal.querySelector('.new-conversation').addEventListener('click', () => {
            startNewConversation();
            modal.remove();
        });

        modal.querySelectorAll('.load-conversation').forEach(button => {
            button.addEventListener('click', (e) => {
                const conversationId = e.target.getAttribute('data-id');
                loadConversation(conversationId);
                modal.remove();
            });
        });

        modal.querySelectorAll('.delete-conversation').forEach(button => {
            button.addEventListener('click', (e) => {
                const conversationId = e.target.getAttribute('data-id');
                deleteConversation(conversationId);

                const item = modal.querySelector(`.conversation-item[data-id="${conversationId}"]`);
                if (item) {
                    item.remove();

                    if (modal.querySelectorAll('.conversation-item').length === 0) {
                        modal.querySelector('.conversation-list').innerHTML =
                            '<p class="no-conversations">保存された会話はありません</p>';
                    }
                }
            });
        });
    }

    // Add styles for conversation modal
    function addConversationModalStyles() {
        if (!document.getElementById('conversation-modal-styles')) {
            const style = document.createElement('style');
            style.id = 'conversation-modal-styles';
            style.textContent = `
            /* ... (giữ nguyên phần CSS trước đó) ... */
            
            .conversation-modal-footer {
                padding: 15px;
                display: flex;
                justify-content: center;
                border-top: 1px solid #3a3a3a;
            }
            
            .new-conversation {
                background: linear-gradient(135deg, #4caf50, #3d8b40);
                color: white;
                border: none;
                border-radius: 20px;
                padding: 8px 16px;
                cursor: pointer;
                font-weight: bold;
                transition: transform 0.2s, box-shadow 0.2s;
            }
            
            .new-conversation:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            }
            
            .no-conversations {
                text-align: center;
                padding: 20px;
                color: #aaa;
                margin: 0;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes slideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
            document.head.appendChild(style);
        }
    }

    // Start a new conversation
    function startNewConversation() {
        const newId = generateConversationId();
        localStorage.setItem('conversation_id', newId);

        conversationHistory = [
            {
                role: "model",
                parts: [{ text: "こんにちは！日本語の練習や会話を楽しみましょう！何か話したいことはありますか？" }]
            }
        ];

        localStorage.setItem('conversation_history', JSON.stringify(conversationHistory));
        renderConversation();
    }

    // Load a conversation from history
    function loadConversation(conversationId) {
        const conversationsList = JSON.parse(localStorage.getItem('conversations_list')) || [];
        const conversation = conversationsList.find(conv => conv.id === conversationId);
        if (!conversation) return;

        const storedConversation = localStorage.getItem(`conversation_${conversationId}`);
        if (!storedConversation) return;

        const conversationData = JSON.parse(storedConversation);
        localStorage.setItem('conversation_id', conversationId);
        conversationHistory = conversationData.messages || [];

        if (!Array.isArray(conversationHistory)) {
            console.warn("Invalid conversation data, resetting...");
            startNewConversation();
            return;
        }

        localStorage.setItem('conversation_history', JSON.stringify(conversationHistory));
        renderConversation();
    }

    function smoothScrollToBottom() {
        const chatArea = document.getElementById('chat-area');
        const start = chatArea.scrollTop;
        const end = chatArea.scrollHeight - chatArea.clientHeight;
        const duration = 300;
        const startTime = performance.now();

        function scrollStep(timestamp) {
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            chatArea.scrollTop = start + (end - start) * progress;

            if (progress < 1) {
                window.requestAnimationFrame(scrollStep);
            }
        }

        window.requestAnimationFrame(scrollStep);
    }

    // Delete a conversation
    function deleteConversation(conversationId) {
        const conversationsList = JSON.parse(localStorage.getItem('conversations_list')) || [];
        const updatedList = conversationsList.filter(conv => conv.id !== conversationId);
        localStorage.setItem('conversations_list', JSON.stringify(updatedList));
        localStorage.removeItem(`conversation_${conversationId}`);

        if (localStorage.getItem('conversation_id') === conversationId) {
            startNewConversation();
        }
    }

    // Event listeners
    sendButton.addEventListener('click', handleSendMessage);

    userInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    });

    clearChatButton.addEventListener('click', function () {
        startNewConversation();
    });

    clearInputButton.addEventListener('click', function () {
        userInput.value = '';
        userInput.focus();
    });

    translateButton.addEventListener('click', function () {
        window.location.href = 'Translate.html';
    });

    // Initialize
    renderConversation();
    setupConversationManager();
    userInput.focus();
});