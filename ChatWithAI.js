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

    // Đảm bảo tất cả các phần tử DOM đã được tải đầy đủ
    const chatArea = document.getElementById('chat-area');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const typingIndicator = document.getElementById('typing-indicator');
    const clearChatButton = document.getElementById('clear-chat');
    const clearInputButton = document.getElementById('clear-input');
    const translateButton = document.getElementById('translate-button');

    // Kiểm tra xem các phần tử có tồn tại không
    if (!chatArea) console.error('Element #chat-area not found');
    if (!userInput) console.error('Element #user-input not found');
    if (!sendButton) console.error('Element #send-button not found');
    if (!typingIndicator) console.error('Element #typing-indicator not found');
    if (!clearChatButton) console.error('Element #clear-chat not found');
    if (!clearInputButton) console.error('Element #clear-input not found');
    if (!translateButton) console.error('Element #translate-button not found');

    // Thêm kiểm tra trước khi gắn sự kiện
    if (translateButton) {
        translateButton.addEventListener('click', function () {
            window.location.href = 'Translate.html';
        });
    }

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
    let conversationHistory = [];
    try {
        // Thêm xử lý ngoại lệ cho localStorage
        const savedHistory = localStorage.getItem('conversation_history');
        conversationHistory = savedHistory ? JSON.parse(savedHistory) : [
            {
                role: "model",
                parts: [{ text: "こんにちは！日本語の練習や会話を楽しみましょう！何か面白いトピックや質問はありますか？例えば、好きなアニメや最近の出来事とか！😄" }]
            }
        ];
    } catch (error) {
        console.error('Error loading conversation history:', error);
        conversationHistory = [
            {
                role: "model",
                parts: [{ text: "こんにちは！日本語の練習や会話を楽しみましょう！何か面白いトピックや質問はありますか？例えば、好きなアニメや最近の出来事とか！😄" }]
            }
        ];
    }

    // Context box to store summarized conversation context
    let conversationContext = '';
    try {
        conversationContext = localStorage.getItem('conversation_context') || '';
    } catch (error) {
        console.error('Error loading conversation context:', error);
        conversationContext = '';
    }
    let messageCount = conversationHistory.filter(msg => msg.role === "user").length;

    // Render existing conversation messages
    function renderConversation() {
        if (!chatArea) return;

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
                try {
                    localStorage.setItem('conversation_context', conversationContext);
                } catch (error) {
                    console.error('Failed to save context to localStorage:', error);
                }
                console.log('Updated context:', conversationContext);
            } catch (error) {
                console.error('Failed to update context:', error);
                conversationContext = '会話のコンテキストを更新できませんでした。';
                try {
                    localStorage.setItem('conversation_context', conversationContext);
                } catch (storageError) {
                    console.error('Failed to save context to localStorage:', storageError);
                }
            }
        }
    }

    // Handle sending messages
    async function handleSendMessage() {
        if (!userInput || !chatArea || !typingIndicator) return;

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
        if (typingIndicator) typingIndicator.style.display = 'flex';
        chatArea.scrollTop = chatArea.scrollHeight;

        try {
            await updateConversationContext();
            let response = await sendToGeminiAPI(message);
            // Filter out generic follow-ups
            response = filterGenericResponses(response);
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
            if (typingIndicator) typingIndicator.style.display = 'none';
            if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
        }
    }

    // Filter out generic or unengaging responses
    function filterGenericResponses(response) {
        const genericPhrases = [
            '他に何かある？',
            'まだ何か話したい？',
            '何か面白いことある？',
            '次は何？',
            '何か用？'
        ];
        let modifiedResponse = response;
        genericPhrases.forEach(phrase => {
            if (modifiedResponse.includes(phrase)) {
                modifiedResponse = modifiedResponse.replace(phrase, '');
                // Add a more engaging follow-up
                modifiedResponse += '\nちなみに、この話題についてもっと深く話したい？ それとも他の面白いネタある？😉';
            }
        });
        return modifiedResponse.trim();
    }

    // Handle keyboard visibility change on iOS
    function handleVisualViewportResize() {
        if (!window.visualViewport || !chatArea) return;

        const isKeyboardVisible = window.visualViewport.height < window.innerHeight * 0.8;
        const keyboardHeight = isKeyboardVisible ? window.innerHeight - window.visualViewport.height : 0;
        const inputArea = document.querySelector('.input-area');
        if (inputArea) inputArea.style.bottom = `${keyboardHeight}px`;
        chatArea.style.marginBottom = `${keyboardHeight + 80}px`;
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    if ('visualViewport' in window) {
        window.visualViewport.addEventListener('resize', handleVisualViewportResize);
        window.visualViewport.addEventListener('scroll', handleVisualViewportResize);
    }

    // Add a message to the chat UI
    function addMessageToChat(content, sender, scroll = true) {
        if (!chatArea) return;

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
            // Kiểm tra xem trình duyệt có hỗ trợ SpeechSynthesis không
            if (!window.speechSynthesis) {
                console.error("SpeechSynthesis not supported");
                alert("お使いのブラウザは音声合成をサポートしていません。");
                return;
            }

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

            try {
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
            } catch (error) {
                console.error("SpeechSynthesis error:", error);
                alert("音声合成でエラーが発生しました。");
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
            try {
                navigator.clipboard.writeText(content).then(() => {
                    copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                    </svg>`;
                    setTimeout(() => {
                        copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                        </svg>`;
                    }, 1000);
                }).catch(err => {
                    console.error("Clipboard API error:", err);
                    alert("クリップボードへのコピーに失敗しました。");
                });
            } catch (error) {
                console.error("Copy button error:", error);
                // Fallback for older browsers
                const textArea = document.createElement("textarea");
                textArea.value = content;
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                    </svg>`;
                    setTimeout(() => {
                        copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                        </svg>`;
                    }, 1000);
                } catch (e) {
                    console.error("execCommand copy failed:", e);
                    alert("クリップボードへのコピーに失敗しました。");
                }
                document.body.removeChild(textArea);
            }
        };

        actionsDiv.appendChild(readBtn);
        actionsDiv.appendChild(copyBtn);
        contentDiv.appendChild(bubbleDiv);
        contentDiv.appendChild(actionsDiv);
        messageDiv.appendChild(contentDiv);
        chatArea.appendChild(messageDiv);

        if (scroll) {
            setTimeout(() => {
                if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
            }, 10);
        }
    }

    function saveConversation() {
        try {
            localStorage.setItem('conversation_history', JSON.stringify(conversationHistory));
        } catch (error) {
            console.error('Error saving conversation to localStorage:', error);
        }
    }

    async function sendToGeminiAPI(message, isContextGeneration = false) {
        const API_KEY = getCurrentApiKey();
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;

        // Thêm chỉ dẫn rõ ràng về độ dài trong prompt
        const lengthInstruction = isContextGeneration
            ? "50文字以内で簡潔に回答してください。"
            : "必ず180トークン以内で回答してください。3文または4文以内にまとめてください。";

        const systemInstruction = {
            role: "model",
            parts: [{
                text: isContextGeneration
                    ? `会話から簡潔なコンテキストを生成してください。${lengthInstruction}`
                    : `You are a cheerful and knowledgeable Japanese chatbot. Provide engaging and thoughtful responses in casual Japanese. Use natural slang, emojis (e.g., 😄, めっちゃ), and occasionally ask relevant follow-up questions to deepen the conversation. Avoid generic prompts like "他に何かある？" or "まだ何か話したい？". Stay context-aware using: ${conversationContext}. ${lengthInstruction}`
            }]
        };

        const requestBody = {
            contents: [systemInstruction, ...conversationHistory],
            generationConfig: {
                temperature: isContextGeneration ? 0.7 : 0.85, // Giảm temperature một chút
                topK: 30,
                topP: 0.85,
                maxOutputTokens: isContextGeneration ? 50 : 180,
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
            let text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
                // Thêm xử lý cắt văn bản nếu vẫn quá dài
                if (!isContextGeneration && text.length > 300) {
                    // Cắt tại dấu chấm gần nhất trước 300 ký tự
                    const lastSentenceEnd = text.lastIndexOf('。', 300);
                    if (lastSentenceEnd > 200) {
                        text = text.substring(0, lastSentenceEnd + 1);
                    } else {
                        // Nếu không tìm thấy dấu chấm phù hợp, cắt cứng tại 300 ký tự
                        text = text.substring(0, 300) + "...";
                    }
                } else if (isContextGeneration && text.length > 100) {
                    // Đối với context generation, cắt nghiêm ngặt hơn
                    text = text.substring(0, 100);
                }

                // Cập nhật lịch sử cuộc trò chuyện
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

    function handleKeyboard() {
        if (!chatArea) return;
        setTimeout(() => {
            chatArea.scrollTop = chatArea.scrollHeight;
        }, 300);
    }

    // Kiểm tra trước khi thêm sự kiện
    if (userInput) {
        userInput.addEventListener('focus', handleKeyboard);
    }

    if (chatArea) {
        chatArea.addEventListener('touchstart', function () {
            chatArea.style.overflowY = 'scroll';
        });
    }

    if (sendButton) {
        sendButton.addEventListener('click', handleSendMessage);
    }

    if (userInput) {
        userInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                handleSendMessage();
            }
        });
    }

    if (clearChatButton) {
        clearChatButton.addEventListener('click', function () {
            conversationHistory = [
                {
                    role: "model",
                    parts: [{ text: "こんにちは！日本語の練習や会話を楽しみましょう！何か面白いトピックや質問はありますか？例えば、好きなアニメや最近の出来事とか！😄" }]
                }
            ];
            conversationContext = '';
            messageCount = 0;
            try {
                localStorage.setItem('conversation_context', '');
            } catch (error) {
                console.error('Error clearing context in localStorage:', error);
            }
            saveConversation();
            renderConversation();
        });
    }

    if (clearInputButton) {
        clearInputButton.addEventListener('click', function () {
            if (userInput) {
                userInput.value = '';
                userInput.focus();
            }
        });
    }

    // Kiểm tra xem userInput có tồn tại không trước khi sử dụng
    if (userInput) {
        userInput.focus();
    }
});
