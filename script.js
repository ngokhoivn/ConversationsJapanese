
document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const elements = {		
        improveBtn: document.getElementById('improveBtn'),
        suggestBtn: document.getElementById('suggestBtn'),
        saveBtn: document.getElementById('saveBtn'),
        japaneseText: document.getElementById('japanese-text'),
        editableText: document.getElementById('editableText'),
        status: document.getElementById('status'),
        suggestions: document.getElementById('suggestions'),
        loading: document.getElementById('loading'),
        resultBox: document.getElementById('result'),
        correctionsBox: document.getElementById('corrections'),
        nextSuggestions: document.getElementById('nextSuggestions'),
        nextSuggestionList: document.getElementById('nextSuggestionList'),
        historyList: document.getElementById('historyList'),
        clearHistoryBtn: document.getElementById('clearHistoryBtn'),
        tabs: document.querySelectorAll('.tab'),
        tabContents: document.querySelectorAll('.tab-content'),
        reverseSuggestBtn: document.getElementById('reverseSuggestBtn'),
        clearSuggestionsBtn: document.getElementById('clearSuggestionsBtn'),
        vocabBtn: document.getElementById('vocabBtn'),
        vocabListContainer: document.getElementById('vocabList'),
        vocabularyDiv: document.getElementById('vocabulary'),
        detectedLanguage: document.getElementById('detectedLanguage'),
    };

    // Chat button event
    const chatButton = document.getElementById('chat-button');
    if (chatButton) {
        chatButton.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    // Check if any required element is missing and initialize it if needed
    Object.entries(elements).forEach(([key, element]) => {
        if (!element && key !== 'tabs' && key !== 'tabContents') {
            console.warn(`Element '${key}' not found in the DOM. Creating placeholder.`);
            
            // Create placeholder element
            const placeholder = document.createElement('div');
            placeholder.id = key;
            
            // Special handling for containers that need to exist
            if (key === 'vocabListContainer') {
                placeholder.id = 'vocabList';
                
                // If vocabularyDiv is also null, create it too
                if (!elements.vocabularyDiv) {
                    const vocabDiv = document.createElement('div');
                    vocabDiv.id = 'vocabulary';
                    vocabDiv.classList.add('hidden');
                    document.body.appendChild(vocabDiv);
                    vocabDiv.appendChild(placeholder);
                    elements.vocabularyDiv = vocabDiv;
                } else {
                    elements.vocabularyDiv.appendChild(placeholder);
                }
            } else {
                document.body.appendChild(placeholder);
            }
            
            // Update the reference in elements object
            elements[key] = placeholder;
        }
    });

    const GEMINI_API_KEY = "AIzaSyD-LQ7BMIl85o0Tq3LogG2rBmtYjkOpogU";

    // Tab switching functionality
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');

            elements.tabs.forEach(t => t.classList.remove('active'));
            elements.tabContents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(tabId).classList.add('active');

            if (tabId === 'history') {
                loadHistory();
            }
        });
    });

    /**
     * Detect language of the input text
     * @param {string} text - Text to analyze
     * @returns {string} Language code ('ja-JP' or 'vi-VN')
     */
    function detectLanguage(text) {
        // Simple detection based on Japanese characters
        const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
        return japaneseRegex.test(text) ? 'ja-JP' : 'vi-VN';
    }

	/**
	 * Update language display in UI
	 * @param {string} lang - Language code ('ja-JP' or 'vi-VN')
	 */
	function updateLanguageDisplay(lang) {
		if (elements.status) {
			const langText = lang === 'ja-JP' ? 'Japanese' : 'Vietnamese';
			elements.status.innerHTML = lang 
				? `<i class="fas fa-language"></i><span>${langText} detected</span>`
				: '<i class="fas fa-info-circle"></i><span>Enter text to analyze...</span>';
		}
	}

    /**
     * Get current language of the input text
     * @returns {string} Language code ('ja-JP' or 'vi-VN')
     */
    function getCurrentLanguage() {
        const text = elements.editableText.value.trim();
        if (!text) return 'ja-JP'; // Default to Japanese if no text
        
        const detectedLang = detectLanguage(text);
        updateLanguageDisplay(detectedLang);
        return detectedLang;
    }

    /**
     * Toggles the disabled state of action buttons
     * @param {boolean} enabled - Whether to enable or disable buttons
     */
    function toggleActionButtons(enabled) {
        elements.improveBtn.disabled = !enabled;
        elements.suggestBtn.disabled = !enabled;
        elements.saveBtn.disabled = !enabled;
        elements.reverseSuggestBtn.disabled = !enabled;
    }

    /**
     * Formats date for display
     * @param {string} dateString - ISO date string
     * @returns {string} Formatted date
     */
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Calls Gemini API with given prompt
     * @param {string} promptText - The prompt to send to Gemini
     * @returns {Promise<Object>} API response
     */
    async function fetchFromGemini(promptText) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'API request failed');
        }

        return response.json();
    }

    /**
     * Translates text using Gemini API
     * @param {string} text - Text to translate
     * @param {string} sourceLang - Source language code
     * @param {string} targetLang - Target language code
     * @returns {Promise<string>} Translated text
     */
    async function translateText(text, sourceLang, targetLang) {
        const sourceLangName = sourceLang === 'ja-JP' ? 'Japanese' : 'Vietnamese';
        const targetLangName = targetLang === 'ja-JP' ? 'Japanese' : 'Vietnamese';

        const prompt = `Please translate the following text from ${sourceLangName} to ${targetLangName} naturally and accurately:\n\n"${text}"\n\nReturn only the translation without any additional notes.`;

        try {
            const response = await fetchFromGemini(prompt);
            return response.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error('Translation error:', error);
            throw new Error('Translation error: ' + error.message);
        }
    }

    /**
     * Creates prompt for alternative expressions
     * @param {string} text - Text to rephrase
     * @param {string} currentLang - Current language code
     * @returns {string} Prompt text
     */
    function createReverseExpressionPrompt(text, currentLang) {
        const fromLang = currentLang === 'ja-JP' ? 'Japanese' : 'Vietnamese';
        const toLang = currentLang === 'ja-JP' ? 'Vietnamese' : 'Japanese';

        return `
            You are a language expert. Provide 3 alternative ways to express the following text in ${toLang} that sound natural and maintain the same meaning:
            "${text}"
            Return the results as a JSON array:
            ["expression 1", "expression 2", "expression 3"]
        `;
    }

    /**
     * Loads and displays saved history
     */
    function loadHistory() {
        const history = JSON.parse(localStorage.getItem('textHistory') || '[]');

        if (history.length === 0) {
            elements.historyList.innerHTML = '<div class="no-history">No items saved yet</div>';
            elements.clearHistoryBtn.classList.add('hidden');
            return;
        }

        elements.clearHistoryBtn.classList.remove('hidden');

        const historyHTML = history.map((item, index) => {
            const shortText = item.text.length > 50 ? item.text.substring(0, 50) + '...' : item.text;
            return `
                <div class="history-item" data-index="${index}">
                    <div class="history-actions">
                        <button class="history-action-btn translate-btn" title="Translate">
                            <i class="fas fa-language"></i>
                        </button>
                        <button class="history-action-btn delete-btn" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="history-text">${shortText}</div>
                    <div class="history-meta">
                        <span>${item.language === 'ja-JP' ? 'Japanese' : 'Vietnamese'}</span>
                        <span>${formatDate(item.timestamp)}</span>
                    </div>
                    <div class="translation" id="translation-${index}"></div>
                </div>
            `;
        }).join('');

        elements.historyList.innerHTML = historyHTML;

        document.querySelectorAll('.history-item').forEach(item => {
            const index = parseInt(item.getAttribute('data-index'));
            const historyItem = history[index];

            item.addEventListener('click', (e) => {
                if (!e.target.closest('.history-action-btn')) {
                    elements.editableText.value = historyItem.text;
                    // Update language display when loading from history
                    updateLanguageDisplay(historyItem.language);
                    document.querySelector('.tab[data-tab="editor"]').click();
                    toggleActionButtons(true);
                }
            });

            const translateBtn = item.querySelector('.translate-btn');
            const translationDiv = item.querySelector('.translation');

            translateBtn.addEventListener('click', async (e) => {
                e.stopPropagation();

                if (translationDiv.classList.contains('show')) {
                    translationDiv.classList.remove('show');
                    return;
                }

                translationDiv.innerHTML = '<div class="translation-label">Translating...</div>';
                translationDiv.classList.add('show');

                const targetLang = historyItem.language === 'ja-JP' ? 'vi-VN' : 'ja-JP';
                const translatedText = await translateText(historyItem.text, historyItem.language, targetLang);

                translationDiv.innerHTML = `
                    <div class="translation-label">Translated to ${targetLang === 'ja-JP' ? 'Japanese' : 'Vietnamese'}:</div>
                    <div>${translatedText}</div>
                `;
            });

            const deleteBtn = item.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this item?')) {
                    const updatedHistory = history.filter((_, i) => i !== index);
                    localStorage.setItem('textHistory', JSON.stringify(updatedHistory));
                    loadHistory();
                    elements.status.innerHTML = '<i class="fas fa-check-circle"></i><span>Item deleted!</span>';
                    setTimeout(() => {
                        elements.status.innerHTML = '<i class="fas fa-info-circle"></i><span>Ready</span>';
                    }, 2000);
                }
            });
        });
    }

    /**
     * Gets improved text and suggestions from Gemini
     * @param {string} text - Text to improve
     * @param {string} language - Language code (ja-JP or vi-VN)
     * @returns {Promise<Object>} Corrected text and suggestions
     */
    async function getImprovedTextAndSuggestions(text, language) {
        const promptText = `
            You are a language expert. Please analyze and improve the following text in ${language === 'ja-JP' ? 'Japanese' : 'Vietnamese'}:
            1. Fix any spelling and grammar mistakes
            2. Return the corrected version
            3. Suggest 2-3 more natural ways to express the same idea
            Text: "${text}"
            Return the response in JSON format:
            {
              "corrected_text": "corrected text",
              "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
            }
        `;
        const response = await fetchFromGemini(promptText);
        const responseText = response.candidates[0].content.parts[0].text;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Could not parse Gemini response');
        return JSON.parse(jsonMatch[0]);
    }

    /**
     * Generates prompt for next sentence suggestions
     * @param {string} text - Current text
     * @param {string} language - Language code
     * @returns {string} Prompt text
     */
    function createSuggestionPrompt(text, language) {
        return `Based on the following text, suggest 3 short, natural sentences that the person might want to say next in this conversation.
            Text: "${text}"
            Keep the suggestions in ${language === 'ja-JP' ? 'Japanese' : 'Vietnamese'}.
            Format each suggestion as a JSON object in an array:
            [
                {"suggestion": "suggestion 1"},
                {"suggestion": "suggestion 2"},
                {"suggestion": "suggestion 3"}
            ]`;
    }

    /**
     * Extracts suggestions from API response
     * @param {Object} responseData - API response
     * @returns {string[]} Array of suggestions
     */
    function extractSuggestions(responseData) {
        try {
            const responseText = responseData.candidates[0].content.parts[0].text;
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]).map(item => item.suggestion);
            }
            return [];
        } catch (error) {
            console.error('Error extracting suggestions:', error);
            return [];
        }
    }

    /**
     * Displays suggestions in the UI
     * @param {string[]} suggestions - List of suggestions
     * @param {HTMLElement} container - Container to display suggestions
     */
    function displaySuggestions(suggestions, container = elements.nextSuggestionList) {
        if (!container) {
            console.error('Suggestions container is null');
            elements.status.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Error: Suggestions container not found</span>';
            return;
        }
        
        container.innerHTML = suggestions.length === 0
            ? '<p>No suggestions available.</p>'
            : `<ul>${suggestions.map(s => `<li>${s}</li>`).join('')}</ul>`;

        container.querySelectorAll('li').forEach(li => {
            li.addEventListener('click', () => {
                elements.editableText.value = li.textContent;
                toggleActionButtons(true);
            });
        });

        if (container.parentElement) {
            container.parentElement.classList.toggle('hidden', suggestions.length === 0);
        }
    }

    // Generate next sentence suggestions
    async function generateNextSuggestions() {
        const text = elements.editableText.value.trim();
        if (!text) {
            elements.status.innerHTML = '<i class="fas fa-exclamation-circle"></i><span>No text to generate suggestions</span>';
            return;
        }

        elements.loading.classList.remove('hidden');
        elements.suggestBtn.disabled = true;

        try {
            const currentLang = getCurrentLanguage();
            const prompt = createSuggestionPrompt(text, currentLang);
            const response = await fetchFromGemini(prompt);
            const suggestions = extractSuggestions(response);
            displaySuggestions(suggestions);
        } catch (error) {
            elements.status.innerHTML = `<i class="fas fa-exclamation-triangle"></i><span>Error: ${error.message}</span>`;
        } finally {
            elements.loading.classList.add('hidden');
            elements.suggestBtn.disabled = false;
        }
    }

    // Improve text with Gemini
    async function improveWithGemini() {
        const textToImprove = elements.editableText.value.trim();
        if (!textToImprove) {
            elements.status.innerHTML = '<i class="fas fa-exclamation-circle"></i><span>No text to improve</span>';
            return;
        }

        elements.loading.classList.remove('hidden');
        elements.improveBtn.disabled = true;
        elements.correctionsBox.classList.add('hidden');

        try {
            const currentLang = getCurrentLanguage();
            const result = await getImprovedTextAndSuggestions(textToImprove, currentLang);
            elements.editableText.value = result.corrected_text || textToImprove;
            displaySuggestions(result.suggestions || [], elements.suggestions);
            elements.correctionsBox.classList.toggle('hidden', !result.suggestions?.length);
            toggleActionButtons(true);
        } catch (error) {
            console.error('Error:', error);
            elements.status.innerHTML = `<i class="fas fa-exclamation-triangle"></i><span>Error: ${error.message}</span>`;
        } finally {
            elements.loading.classList.add('hidden');
            elements.improveBtn.disabled = false;
        }
    }

    // Extract vocabulary
    elements.vocabBtn.addEventListener('click', async () => {
        const textarea = elements.editableText;
        const sentence = textarea?.value?.trim();

        if (!sentence) {
            elements.status.innerHTML = '<i class="fas fa-exclamation-circle"></i><span>Không có nội dung để trích xuất từ vựng</span>';
            if (elements.vocabularyDiv) {
                elements.vocabularyDiv.classList.add('hidden');
            }
            return;
        }

        // Make sure the vocabulary div exists
        if (!elements.vocabularyDiv) {
            console.error('Vocabulary div not found');
            elements.status.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Error: Vocabulary container not found</span>';
            return;
        }

        // Make sure vocabListContainer exists
        if (!elements.vocabListContainer) {
            console.error('Vocab list container not found');
            const vocabList = document.createElement('div');
            vocabList.id = 'vocabList';
            elements.vocabularyDiv.appendChild(vocabList);
            elements.vocabListContainer = vocabList;
        }

        // Gỡ phần từ vựng cũ nếu có
        const parts = sentence.split('\n\n# Từ vựng:');
        let originalTextForVocab = parts[0].trim();

        const prompt = `
            Bạn là một trợ lý dạy tiếng Nhật. Hãy trích xuất các từ vựng chính trong câu sau và trả về dưới dạng JSON với định dạng: 
            [
                {"kanji": "Kanji (nếu có)", "hiragana": "Hiragana", "meaning": "Nghĩa tiếng Việt"},
                ...
            ]
            Nếu từ không có Kanji, để kanji là chuỗi rỗng (""). Chỉ trích xuất các từ vựng quan trọng (danh từ, động từ, tính từ).
            Câu: "${originalTextForVocab}"
            Ví dụ:
            [
                {"kanji": "学校", "hiragana": "がっこう", "meaning": "trường học"},
                {"kanji": "", "hiragana": "たべる", "meaning": "ăn"}
            ]
            Trả về chỉ JSON, không thêm bất kỳ văn bản giải thích hoặc ký tự như \`\`\`json.
        `;

        try {
            elements.vocabBtn.disabled = true;
            elements.vocabBtn.textContent = '⏳ Đang trích xuất...';

            const response = await fetchFromGemini(prompt);
            let responseText = response.candidates[0].content.parts[0].text.trim();

            // Loại bỏ các ký tự không mong muốn như ```json
            responseText = responseText.replace(/```json|```/g, '').trim();

            let vocabList;
            try {
                vocabList = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Error parsing JSON:', parseError, 'Response:', responseText);
                throw new Error('Phản hồi từ API không phải JSON hợp lệ');
            }

            if (!Array.isArray(vocabList) || vocabList.length === 0) {
                elements.status.innerHTML = '<i class="fas fa-exclamation-circle"></i><span>Không tìm thấy từ vựng để trích xuất</span>';
                elements.vocabularyDiv.classList.add('hidden');
                textarea.value = originalTextForVocab;
                return;
            }

            // Hiển thị danh sách từ vựng trong div
            elements.vocabListContainer.innerHTML = vocabList
                .map(item => `
                    <div class="vocabulary-item">
                        ${item.kanji ? `<span class="vocabulary-kanji">${item.kanji}</span>` : ''}
                        <span class="vocabulary-hiragana">${item.hiragana}</span>
                        <span class="vocabulary-meaning">${item.meaning}</span>
                    </div>
                `)
                .join('');

            elements.vocabularyDiv.classList.remove('hidden');
            elements.status.innerHTML = '<i class="fas fa-check-circle"></i><span>Trích xuất từ vựng thành công!</span>';

            // Cập nhật textarea chỉ chứa văn bản gốc
            textarea.value = originalTextForVocab;

            // Kích hoạt lại các nút sau khi trích xuất
            toggleActionButtons(true);
        } catch (err) {
            console.error('Vocabulary extraction error:', err);
            elements.status.innerHTML = `<i class="fas fa-exclamation-triangle"></i><span>Lỗi: ${err.message}</span>`;
            if (elements.vocabularyDiv) {
                elements.vocabularyDiv.classList.add('hidden');
            }
            if (textarea) {
                textarea.value = originalTextForVocab;
            }
        } finally {
            elements.vocabBtn.disabled = false;
            elements.vocabBtn.textContent = '📘 Trích xuất từ vựng';
        }
    });

    // Event listeners
	elements.editableText.addEventListener('input', () => {
		const text = elements.editableText.value.trim();
		const hasText = !!text;
		
		if (hasText) {
			const detectedLang = detectLanguage(text);
			updateLanguageDisplay(detectedLang);
		} else {
			updateLanguageDisplay(null);
		}
		
		toggleActionButtons(hasText);
	});

    elements.improveBtn.addEventListener('click', improveWithGemini);
    elements.suggestBtn.addEventListener('click', generateNextSuggestions);

    elements.saveBtn.addEventListener('click', () => {
        const textToSave = elements.editableText.value.trim();
        if (!textToSave) return;
        
        const currentLang = getCurrentLanguage();
        const history = JSON.parse(localStorage.getItem('textHistory') || '[]');
        history.push({
            text: textToSave,
            language: currentLang,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('textHistory', JSON.stringify(history));
        elements.status.innerHTML = '<i class="fas fa-check-circle"></i><span>Saved!</span>';
        setTimeout(() => {
            elements.status.innerHTML = '<i class="fas fa-info-circle"></i><span>Ready</span>';
        }, 2000);
    });

    elements.clearHistoryBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all history?')) {
            localStorage.removeItem('textHistory');
            loadHistory();
            elements.status.innerHTML = '<i class="fas fa-check-circle"></i><span>History cleared!</span>';
            setTimeout(() => {
                elements.status.innerHTML = '<i class="fas fa-info-circle"></i><span>Ready</span>';
            }, 2000);
        }
    });

    elements.reverseSuggestBtn.addEventListener('click', async () => {
        const text = elements.editableText.value.trim();
        if (!text) return;

        elements.loading.classList.remove('hidden');
        elements.reverseSuggestBtn.disabled = true;

        try {
            const currentLang = getCurrentLanguage();
            const prompt = createReverseExpressionPrompt(text, currentLang);
            const response = await fetchFromGemini(prompt);
            const responseText = response.candidates[0].content.parts[0].text;
            const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
            const suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

            displaySuggestions(suggestions, elements.suggestions);
            elements.correctionsBox.classList.remove('hidden');
        } catch (error) {
            elements.status.innerHTML = `<i class="fas fa-exclamation-triangle"></i><span>Error: ${error.message}</span>`;
        } finally {
            elements.loading.classList.add('hidden');
            elements.reverseSuggestBtn.disabled = false;
        }
    });

	elements.clearSuggestionsBtn.addEventListener('click', () => {
		// Xóa nội dung ô nhập văn bản
		if (elements.editableText) elements.editableText.value = '';
		
		// Xóa các gợi ý
		if (elements.suggestions) elements.suggestions.innerHTML = '';
		if (elements.nextSuggestionList) elements.nextSuggestionList.innerHTML = '';
		
		// Xóa phần từ vựng
		if (elements.vocabListContainer) elements.vocabListContainer.innerHTML = '';
		
		// Ẩn các khung chứa
		if (elements.correctionsBox) elements.correctionsBox.classList.add('hidden');
		if (elements.nextSuggestions) elements.nextSuggestions.classList.add('hidden');
		if (elements.vocabularyDiv) elements.vocabularyDiv.classList.add('hidden');
		
		// Reset trạng thái ngôn ngữ
		updateLanguageDisplay(null);
		
		// Vô hiệu hóa các nút chức năng
		toggleActionButtons(false);
		
		// Hiển thị thông báo
		elements.status.innerHTML = '<i class="fas fa-check-circle"></i><span>Cleared all content</span>';
		setTimeout(() => {
			elements.status.innerHTML = '<i class="fas fa-info-circle"></i><span>Ready</span>';
		}, 2000);
	});
    
    // Thêm sự kiện đóng vocabulary
    document.querySelector('.close-vocab-btn')?.addEventListener('click', () => {
        elements.vocabularyDiv?.classList.add('hidden');
    });
});