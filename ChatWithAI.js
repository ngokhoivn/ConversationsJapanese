document.addEventListener('DOMContentLoaded', function () {
    // Set correct viewport height for mobile browsers
    function setVh() {
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    // Run initially and on resize
    setVh();
    window.addEventListener('resize', setVh);
    window.addEventListener('orientationchange', () => {
        setTimeout(setVh, 100);
    });

    const chatArea = document.getElementById('chat-area');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const typingIndicator = document.getElementById('typing-indicator');
    const clearChatButton = document.getElementById('clear-chat');
    const clearInputButton = document.getElementById('clear-input');
    const translateButton = document.getElementById('translate-button');

    translateButton.addEventListener('click', function () {
        window.location.href = 'Translate.html';
    });

    const DEFAULT_API_KEYS = [
        'AIzaSyDjgTk4uZQUCpFH5Zt8ZgP2CW-jhmkLv8o',
        'AIzaSyDaROReiR48rjfavf8Lk6XvphC6QxKPZo4',
        'AIzaSyD-LQ7BMIl85o0Tq3LogG2rBmtYjkOpogU'
    ];
    let currentApiKeyIndex = 0;

    function getCurrentApiKey() {
        return DEFAULT_API_KEYS[currentApiKeyIndex];
    }

    function rotateApiKey() {
        currentApiKeyIndex = (currentApiKeyIndex + 1) % DEFAULT_API_KEYS.length;
        console.log(`Switched to API key index: ${currentApiKeyIndex}`);
    }

    // Load conversation history from localStorage or initialize with welcome message
    let conversationHistory = JSON.parse(localStorage.getItem('conversation_history')) || [
        {
            role: "model",
            parts: [{ text: "こんにちは！日本語の練習や会話を楽しみましょう！何か話したいことはありますか？" }]
        }
    ];

    // Context box to store summarized conversation context
    let conversationContext = localStorage.getItem('conversation_context') || '';
    let messageCount = conversationHistory.filter(msg => msg.role === "user").length;

    // Render existing conversation messages
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

    renderConversation();

    // Update conversation context every 5 user messages
    async function updateConversationContext() {
        if (messageCount % 5 === 0 && messageCount > 0) {
            const recentMessages = conversationHistory.slice(-10).map(msg => 
                `${msg.role === 'user' ? 'ユーザー' : 'ボット'}: ${msg.parts[0].text}`
            ).join('\n');

            const contextPrompt = `
以下の会話から簡潔なコンテキスト（1-2文、最大50文字）を生成してください。自然な日本語で、会話の主題や雰囲気を反映してください。
会話:
${recentMessages}
`;

            try {
                const contextResponse = await sendToGeminiAPI(contextPrompt, true);
                conversationContext = contextResponse;
                localStorage.setItem('conversation_context', conversationContext);
                console.log('Updated context:', conversationContext);
            } catch (error) {
                console.error('Failed to update context:', error);
                conversationContext = '会話のコンテキストを更新できませんでした。';
                localStorage.setItem('conversation_context', conversationContext);
            }
        }
    }

    // Handle sending messages
    async function handleSendMessage() {
        const message = userInput.value.trim();
        if (message === '') return;

        addMessageToChat(message, 'user');
        conversationHistory.push({
            role: "user",
            parts: [{ text: message }]
        });
        messageCount++;
        saveConversation();

        userInput.value = '';
        typingIndicator.style.display = 'flex';
        chatArea.scrollTop = chatArea.scrollHeight;

        try {
            await updateConversationContext();
            const response = await sendToGeminiAPI(message);
            addMessageToChat(response, 'bot');
            conversationHistory.push({
                role: "model",
                parts: [{ text: response }]
            });
            saveConversation();
        } catch (error) {
            console.error("API Error:", error);
            rotateApiKey();
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

    // Handle keyboard visibility change on iOS
    function handleVisualViewportResize() {
        const isKeyboardVisible = window.visualViewport.height < window.innerHeight * 0.8;
        const keyboardHeight = isKeyboardVisible ? window.innerHeight - window.visualViewport.height : 0;
        document.querySelector('.input-area').style.bottom = `${keyboardHeight}px`;
        chatArea.style.marginBottom = `${keyboardHeight + 80}px`;
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    if ('visualViewport' in window) {
        window.visualViewport.addEventListener('resize', handleVisualViewportResize);
        window.visualViewport.addEventListener('scroll', handleVisualViewportResize);
    }

    // Add a message to the chat UI
    function addMessageToChat(content, sender, scroll = true) {
        const lastMsg = chatArea.lastElementChild?.querySelector('.message-bubble')?.textContent;
        if (lastMsg && lastMsg === content) return;

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

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        actionsDiv.setAttribute('role', 'toolbar');
        actionsDiv.setAttribute('aria-label', 'メッセージのアクション');

        const readBtn = document.createElement('button');
        readBtn.className = 'icon-btn';
        readBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77 0-4.28-2.99-7.86-7-8.77z"/>
        </svg>`;
        readBtn.title = '読み上げ';
        readBtn.setAttribute('aria-label', 'メッセージを読み上げる');
        readBtn.onclick = () => {
            if (!cleanText || !cleanText.trim()) return;
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = 'ja-JP';
            utterance.rate = 0.9;
            utterance.pitch = 1.1;
            utterance.onerror = (event) => {
                console.error("SpeechSynthesis Error:", event.error);
                alert("読み上げエラー: " + event.error);
            };
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
                setTimeout(() => {
                    if (speechSynthesis.getVoices().length === 0) {
                        alert("音声を読み込めませんでした。音声設定を確認するか、後でもう一度お試しください。");
                    }
                }, 5000);
            }
        };

        const copyBtn = document.createElement('button');
        copyBtn.className = 'icon-btn';
        copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>`;
        copyBtn.title = 'コピー';
        copyBtn.setAttribute('aria-label', 'メッセージをコピーする');
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(content).then(() => {
                copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                </svg>`;
                setTimeout(() => {
                    copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                    </svg>`;
                }, 1000);
            });
        };

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

    function saveConversation() {
        localStorage.setItem('conversation_history', JSON.stringify(conversationHistory));
    }

    async function sendToGeminiAPI(message, isContextGeneration = false) {
        const API_KEY = getCurrentApiKey();
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;

        const systemInstruction = {
            role: "model",
            parts: [{
                text: isContextGeneration 
                    ? "会話から簡潔なコンテキストを生成してください。"
                    : `You are a cheerful Japanese chatbot. Reply in casual Japanese, short (1–2 sentences max), and friendly. Use slang or emojis sometimes like (笑), マジ!? to sound natural. Current context: ${conversationContext}`
            }]
        };

        const requestBody = {
            contents: [systemInstruction, ...conversationHistory],
            generationConfig: {
                temperature: isContextGeneration ? 0.7 : 0.85,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: isContextGeneration ? 50 : 100,
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

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("API Error Details:", errorData);
                throw new Error(`API request failed with status ${response.status}`);
            }

            const data = await response.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
                if (conversationHistory.length > 20) {
                    conversationHistory = [
                        ...conversationHistory.slice(conversationHistory.length - 10)
                    ];
                }
                return text;
            } else {
                throw new Error("Invalid API response structure");
            }
        } catch (error) {
            console.error("Error sending to Gemini API:", error);
            return isContextGeneration 
                ? "コンテキスト生成に失敗しました。"
                : "エラーが発生しました。もう一度試してみてください。(⌒_⌒;)";
        }
    }

    function getFallbackResponse(message) {
        const responses = [
            "すみません、API接続に問題があるようです。もう一度試してみてください。",
            "現在サーバーと通信できません。後ほど再度お試しください。",
            "申し訳ありませんが、技術的な問題が発生しています。",
            "エラーが発生しました。しばらくしてからもう一度お試しください。"
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    chatArea.addEventListener('touchstart', function () {
        chatArea.style.overflowY = 'scroll';
    });

    sendButton.addEventListener('click', handleSendMessage);

    userInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    });

    clearChatButton.addEventListener('click', function () {
        conversationHistory = [
            {
                role: "model",
                parts: [{ text: "こんにちは！日本語の練習や会話を楽しみましょう！何か話したいことはありますか？" }]
            }
        ];
        conversationContext = '';
        messageCount = 0;
        localStorage.setItem('conversation_context', '');
        saveConversation();
        renderConversation();
    });

    clearInputButton.addEventListener('click', function () {
        userInput.value = '';
        userInput.focus();
    });

    userInput.focus();
});
