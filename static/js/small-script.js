function initializeChatWidget() {
    // Добавление CSS стилей для чата
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = 'https://bot-fit.ru/static/css/styles.css';
    document.head.appendChild(style);

    // Инициализация переменных
    let unreadCount = parseInt(localStorage.getItem('unreadCount')) || 0; // Количество непрочитанных сообщений
    let isQuestionsVisible = true; // Флаг для отслеживания состояния видимости быстрых вопросов

    // HTML структура чата
    const chatHTML = `
        <div id="chat-widget" style="display: none; visibility: hidden;">
            <div id="chat-header">
                <div id="header-content">
                    <span id="phone-number">Поговорим о питании и ЗОЖ с твоим ассистентом Befit</span>
                    <button id="close-chat">✕</button>
                </div>
<!--                <div id="chat-tabs">-->
<!--                    <button class="tab active">-->
<!--                        <img src="https://bot-fit.ru/static/filename/чат.png" alt="Чат"> Чат-->
<!--                    </button>-->
<!--                    <button class="tab">-->
<!--                        <img src="https://bot-fit.ru/static/filename/заявки.png" alt="Заявка"> Заявка-->
<!--                    </button>-->
<!--                    <button class="tab">-->
<!--                        <img src="https://bot-fit.ru/static/filename/контакты.png" alt="Контакты"> Контакты-->
<!--                    </button>-->
<!--                </div>-->
            </div>
            

            <div id="chat-messages">
                <div class="message admin-message">
                    <div class="avatar">
                        <img src="https://bot-fit.ru/static/filename/аватар.png" alt="avatar">
                    </div>
                    <div class="message-content">
                        <p>Привет!! Я ваш виртуальный ассистент по питанию и здоровью BeFit. Если вам нужны советы по нашим готовым рационам, здоровому питанию или помощь в достижении ваших целей, обращайтесь ко мне. Жду ваших вопросов и с радостью помогу вам на пути к здоровому образу жизни!</p>
                    </div>
                </div>
            </div>

            <div id="typing-indicator" style="display:none;">
                <div class="avatar"><img src="https://bot-fit.ru/static/filename/logo-symbol.svg" alt="bot-avatar"></div>
                <div class="message-content typing-dots">
                    <span></span><span></span><span></span>
                </div>
            </div>

            <div id="toggle-questions">
                <span id="toggle-text">Скрыть вопросы</span>
            </div>

            <div id="quick-questions">
                <button class="quick-question-btn">Какой рацион лучше выбрать для похудения?</button>
                <button class="quick-question-btn">Как правильно составить здоровый рацион?</button>
                <button class="quick-question-btn">Сколько калорий и бжу мне нужно потреблять в день?</button>
                <button class="quick-question-btn">Можно ли есть сладкое?</button>
                <button class="quick-question-btn">Что нужно есть до и после тренировки?</button>
            </div>
            
            <div id="chat-input">
                <input type="text" placeholder="Введите сообщение" id="message-input">
                <button id="send-message">
                    <img src="https://bot-fit.ru/static/filename/отправить.png" alt="Отправить">
                </button>
            </div>

            <div id="request-form" style="display: none;">
                <h3>Форма заявки</h3>
                <form id="form-request">
                    <label for="name">Имя:</label>
                    <input type="text" id="name" name="name" required>
                    <label for="phone">Телефон:</label>
                    <input type="text" id="phone" name="phone" required>
                    <label for="message">Сообщение:</label>
                    <textarea id="message" name="message" required></textarea>
                    <button type="submit">Отправить</button>
                </form>
            </div>

            <div id="contact-info" style="display: none;">
                <h3>Контактная информация</h3>
                <p><strong>Email:</strong> support@befit.com</p>
                <p><strong>Телефон:</strong> +7 (123) 456-7890</p>
                <p><strong>Адрес:</strong> г. Москва, ул. Примерная, д. 1</p>
            </div>
            
            <div id="success-popup" style="display:none; position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background-color: #4CAF50; color: white; padding: 10px 20px; border-radius: 5px; z-index: 1000;">
                Заявка успешно создана!
            </div>
            
            <div id="request-list" style="display: none; margin-top: 20px;">
                <h3>Список заявок</h3>
            </div>

            <audio id="new-message-sound" src="https://bot-fit.ru/static/sounds/sound.mp3" preload="auto"></audio>
        </div>

        <button id="open-chat" style="display: none; visibility: hidden;">💬
            <span id="unread-count" style="background-color: red; color: white; border-radius: 50%; padding: 2px 5px; font-size: 12px; position: absolute; top: -5px; right: -5px; display: none;">0</span>
        </button>
    `;

    // Вставка HTML на страницу
    document.body.insertAdjacentHTML('beforeend', chatHTML);

    // Инициализация элементов чата
    const chatWidget = document.getElementById('chat-widget');
    const openChatButton = document.getElementById('open-chat');
    const unreadCountElement = document.getElementById('unread-count');
    const chatMessages = document.getElementById('chat-messages');
    const quickQuestions = document.getElementById('quick-questions');
    const toggleQuestionsBtn = document.getElementById('toggle-questions-btn');

    // Когда стили загружены, показываем чат и кнопку открытия чата
    style.onload = function() {
        chatWidget.style.visibility = 'visible';
        openChatButton.style.visibility = 'visible';
        openChatButton.style.display = 'block';

        const userSession = getCookie('userSession'); // Получаем сессию пользователя
        loadChatHistory(userSession); // Загружаем историю сообщений
        updateUnreadCount(); // Обновляем счетчик непрочитанных сообщений
    };

    // Скрытие/отображение быстрых вопросов
    document.getElementById('toggle-questions').addEventListener('click', function() {
        isQuestionsVisible = !isQuestionsVisible;
        const toggleText = document.getElementById('toggle-text');

        if (isQuestionsVisible) {
            quickQuestions.style.display = 'flex'; // Показать вопросы
            toggleText.textContent = 'Скрыть вопросы';
        } else {
            quickQuestions.style.display = 'none'; // Скрыть вопросы
            toggleText.textContent = 'Показать вопросы';
        }
    });

    // Обработка кликов на кнопки с быстрыми вопросами
    document.querySelectorAll('.quick-question-btn').forEach(button => {
        button.addEventListener('click', function() {
            sendMessage(this.textContent); // Отправляем текст кнопки как сообщение
        });
    });

    // Генерация уникального ID для пользователя
    function generateUUID() {
        let d = new Date().getTime();
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            d += performance.now();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }

    // Получение cookie по имени
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        return parts.length === 2 ? parts.pop().split(';').shift() : null;
    }

    // Установка cookie
    function setCookie(name, value, days) {
        let expires = "";
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + (value || "") + expires + "; path=/";
    }

    // Событие, когда страница полностью загружена
    document.addEventListener('DOMContentLoaded', () => {
        let userSession = getCookie('userSession');
        if (!userSession) {
            userSession = generateUUID(); // Если сессии нет, создаем новую
            setCookie('userSession', userSession, 7); // Сохраняем сессию на 7 дней
        }
    });

    // Загрузка истории чата с сервера
    async function loadChatHistory(userSession) {
        try {
            const response = await fetch(`https://bot-fit.ru/proxy/history?userSession=${userSession}`);
            const data = await response.json();
            if (data?.messages?.length > 0) {
                chatMessages.innerHTML = ''; // Очищаем предыдущие сообщения

                data.messages.forEach(msg => {
                    const messageClass = msg.sender === 'bot' ? 'admin-message' : 'user-message';
                    const formattedText = formatText(msg.text).replace(/\n/g, '<br>'); // Форматирование текста

                    const messageElement = document.createElement('div');
                    messageElement.classList.add('message', messageClass);
                    messageElement.innerHTML = `
                        ${msg.sender === 'bot' ? '<div class="avatar"><img src="https://bot-fit.ru/static/filename/logo-symbol.svg" alt="bot-avatar"></div>' : ''}
                        <div class="message-content">${formattedText}</div>
                    `;

                    chatMessages.appendChild(messageElement); // Добавляем сообщение в чат
                });

                chatMessages.scrollTop = chatMessages.scrollHeight; // Прокрутка вниз
            }
        } catch (error) {
            console.error('Ошибка при загрузке истории чата:', error);
        }
    }

    // Инициализация WebSocket соединения
    const socket = io('https://bot-fit.ru', { transports: ['polling'] });

    // Событие подключения к серверу
    socket.on('connect', () => {
        socket.emit('join', { session_id: getCookie('userSession') });
    });

    // Форматирование текста
    function formatText(text) {
        return text.replace(/\*\*/g, ''); // Пример: удаление звездочек из текста
    }

    // Обработка получения нового сообщения через WebSocket
    socket.on('new_message', msg => {
        const messageClass = msg.sender === 'bot' ? 'admin-message' : 'user-message';

        if (!document.querySelector(`[data-message-id="${msg.bot_message_id}"]`)) {
            const messageElement = document.createElement('div');
            messageElement.classList.add('message', messageClass);
            messageElement.setAttribute('data-message-id', msg.bot_message_id);

            const formattedText = formatText(msg.response).replace(/\n/g, '<br>');

            messageElement.innerHTML = `
                <div class="avatar"><img src="https://bot-fit.ru/static/filename/logo-symbol.svg" alt="avatar"></div>
                <div class="message-content">${formattedText}</div>
            `;

            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            if (chatWidget.style.display === 'none') {
                unreadCount++; // Увеличение количества непрочитанных сообщений
                updateUnreadCount(); // Обновление счетчика
            }
        }
    });

    // Закрытие чата
    document.getElementById('close-chat').addEventListener('click', () => {
        chatWidget.style.display = 'none';
        openChatButton.style.display = 'block'; // Показываем кнопку открытия чата
    });

    // Событие для переключения вкладок в чате (Чат, Заявка, Контакты)
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            // Скрываем все разделы, кроме выбранного
            document.querySelectorAll('#chat-messages, #chat-input, #request-form, #contact-info, #request-list').forEach(div => div.style.display = 'none');
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

            this.classList.add('active');

            if (this.innerText.includes('Заявка')) {
                document.getElementById('request-form').style.display = 'block';
                document.getElementById('request-list').style.display = 'block';
                loadRequests(getCookie('userSession'));
            } else if (this.innerText.includes('Чат')) {
                document.getElementById('chat-messages').style.display = 'block';
                document.getElementById('chat-input').style.display = 'flex';
            } else if (this.innerText.includes('Контакты')) {
                document.getElementById('contact-info').style.display = 'block';
            }
        });
    });

    // Загрузка списка заявок с сервера
    async function loadRequests(userSession) {
        try {
            const response = await fetch(`https://bot-fit.ru/get_requests?userSession=${userSession}`);
            const data = await response.json();
            const requestList = document.getElementById('request-list');
            requestList.innerHTML = ''; // Очищаем предыдущие заявки

            data.requests.forEach(req => {
                const requestItem = document.createElement('div');
                requestItem.innerHTML = `
                    <p><strong>Имя:</strong> ${req.name}</p>
                    <p><strong>Телефон:</strong> ${req.phone}</p>
                    <p><strong>Сообщение:</strong> ${req.message}</p>
                    <p><strong>Дата:</strong> ${req.timestamp}</p>
                `;
                requestList.appendChild(requestItem); // Добавляем заявку в список
            });
        } catch (error) {
            console.error('Ошибка загрузки заявок:', error);
        }
    }

    // Отправка заявки через форму
    document.getElementById('form-request').addEventListener('submit', async function(e) {
        e.preventDefault();
        const name = document.getElementById('name').value;
        const phone = document.getElementById('phone').value;
        const message = document.getElementById('message').value;
        const userSession = getCookie('userSession');

        try {
            const response = await fetch('https://bot-fit.ru/zayavka', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}&message=${encodeURIComponent(message)}&userSession=${encodeURIComponent(userSession)}`
            });

            if (response.ok) {
                const popup = document.getElementById('success-popup');
                popup.style.display = 'block'; // Показываем всплывающее уведомление
                setTimeout(() => popup.style.display = 'none', 3000);

                // Очищаем форму после успешной отправки
                document.getElementById('name').value = '';
                document.getElementById('phone').value = '';
                document.getElementById('message').value = '';
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.error('Ошибка при отправке:', error);
        }
    });

    // Обновление счетчика непрочитанных сообщений
    function updateUnreadCount() {
        unreadCountElement.textContent = unreadCount > 2 ? '3+' : unreadCount;
        unreadCountElement.style.display = unreadCount > 0 ? 'inline' : 'none'; // Скрываем, если нет непрочитанных
        localStorage.setItem('unreadCount', unreadCount); // Сохраняем в localStorage
    }

    // Открытие чата
    openChatButton.addEventListener('click', () => {
        chatWidget.style.display = 'flex';
        openChatButton.style.display = 'none'; // Скрываем кнопку открытия чата

        unreadCount = 0; // Сбрасываем счетчик непрочитанных сообщений
        updateUnreadCount();
        chatMessages.scrollTop = chatMessages.scrollHeight; // Прокручиваем чат вниз
    });

    // Показ индикатора печати
    function showTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        typingIndicator.style.display = 'flex'; // Показываем индикатор
        chatMessages.appendChild(typingIndicator);
        chatMessages.scrollTop = chatMessages.scrollHeight; // Прокручиваем чат вниз
    }

    // Скрытие индикатора печати
    function hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.style.display = 'none'; // Скрываем индикатор
        }
    }

    // Отправка сообщения
    function sendMessage(message = null) {
        if (!message) {
            const messageInput = document.getElementById('message-input');
            message = messageInput.value;
        }

        if (message) {
            const userSession = getCookie('userSession');
            const pageUrl = window.location.href;
            const userAgent = navigator.userAgent;

            // Добавляем сообщение пользователя в чат
            chatMessages.innerHTML += `
                <div class="message user-message">
                    <div class="message-content">${message}</div>
                </div>`;
            chatMessages.scrollTop = chatMessages.scrollHeight; // Прокручиваем чат вниз

            setTimeout(showTypingIndicator, 1000); // Показываем индикатор через 1 секунду после отправки сообщения

            // Отправляем сообщение на сервер
            try {
                fetch('https://bot-fit.ru/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    credentials: 'include',
                    body: `message=${encodeURIComponent(message)}&userSession=${encodeURIComponent(userSession)}&pageUrl=${encodeURIComponent(pageUrl)}&userAgent=${encodeURIComponent(userAgent)}`
                });
            } catch (error) {
                console.error('Ошибка отправки сообщения:', error);
            }

            const messageInput = document.getElementById('message-input');
            if (messageInput) {
                messageInput.value = ''; // Очищаем поле ввода после отправки
            }

            unreadCount = 0; // Сбрасываем счетчик непрочитанных сообщений
            updateUnreadCount();
        }
    }

    // Скрытие индикатора при получении ответа от бота
    socket.on('new_message', msg => {
        hideTypingIndicator(); // Скрываем индикатор печатания

        const messageClass = msg.sender === 'bot' ? 'admin-message' : 'user-message';

        if (!document.querySelector(`[data-message-id="${msg.bot_message_id}"]`)) {
            const messageElement = document.createElement('div');
            messageElement.classList.add('message', messageClass);
            messageElement.setAttribute('data-message-id', msg.bot_message_id);

            const avatarHtml = '<div class="avatar"><img src="https://bot-fit.ru/static/filename/logo-symbol.svg" alt="bot-avatar"></div>';
            const messageContentElement = document.createElement('div');
            messageContentElement.classList.add('message-content');
            messageElement.innerHTML = avatarHtml;

            messageElement.appendChild(messageContentElement);
            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            typeEffect(messageContentElement, formatText(msg.response).replace(/\n/g, '<br>'), 50);

            if (chatWidget.style.display === 'none') {
                unreadCount++;
                updateUnreadCount();
            }
        }
    });

    document.getElementById('send-message').addEventListener('click', function() {
        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();

        if (message.length > 0) {
            sendMessage(message); // Передаем только текст сообщения
            messageInput.value = ''; // Очищаем поле ввода
            quickQuestions.style.display = 'none'; // Скрываем вопросы
            isQuestionsVisible = false;
            document.getElementById('toggle-text').textContent = 'Показать вопросы';
        }
    });

    // Событие на отправку сообщения по нажатию Enter
    document.getElementById('message-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault(); // Предотвращаем отправку формы
            const message = this.value.trim();

            if (message.length > 0) {
                sendMessage(message); // Отправляем сообщение
                this.value = ''; // Очищаем поле ввода
                quickQuestions.style.display = 'none'; // Скрываем быстрые вопросы
                isQuestionsVisible = false;
                document.getElementById('toggle-text').textContent = 'Показать вопросы'; // Обновляем текст кнопки
            }
        }
    });
}

initializeChatWidget(); // Инициализация виджета чата
