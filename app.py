from flask import Flask, request, jsonify, session, make_response, send_from_directory, render_template
from flask_socketio import SocketIO, emit, join_room
import openai
from flask_cors import CORS
import os
import requests
import sqlite3
import time
import json
from datetime import datetime, timedelta
import logging
from logging.handlers import RotatingFileHandler

app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24)

сайт = "https://test.letbefit.ru"
api_key = "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"
assistant_id = "asst_nHH028GYJddazN1iT2yfhNrj"


# Настройка SocketIO с параметрами перезапуска при дисконнекте
socketio = SocketIO(app, cors_allowed_origins="*", logger=True, engineio_logger=True, ping_timeout=10, ping_interval=5, reconnect=True)

# Настройка CORS
CORS(app, supports_credentials=True, resources={r"/*": {"origins": ["https://test.letbefit.ru", "https://bot-fit.ru"]}})

# Настройка логирования с ротацией файлов
handler = RotatingFileHandler('app.log', maxBytes=1000000, backupCount=5)
handler.setLevel(logging.INFO)
app.logger.addHandler(handler)

# Настройка подключения к базе данных SQLite
conn = sqlite3.connect('chatbot.db', check_same_thread=False)
cursor = conn.cursor()

# Создание таблиц, если они не существуют
cursor.execute('''
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE,
    page_url TEXT,
    user_agent TEXT
)
''')

cursor.execute('''
CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    phone TEXT,
    message TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
)
''')
conn.commit()


# Функции для работы с базой данных
def get_or_create_user(session_id, page_url, user_agent):
    try:
        cursor.execute("SELECT id FROM users WHERE session_id = ?", (session_id,))
        user = cursor.fetchone()
        
        if user is None:
            cursor.execute(
                "INSERT INTO users (session_id, page_url, user_agent) VALUES (?, ?, ?)",
                (session_id, page_url, user_agent)
            )
            conn.commit()
            return cursor.lastrowid
        else:
            return user[0]
    except sqlite3.Error as e:
        app.logger.error(f"Ошибка базы данных: {e}")
        return None


def save_message(user_id, sender, message):
    try:
        cursor.execute(
            "INSERT INTO messages (user_id, sender, message) VALUES (?, ?, ?)",
            (user_id, sender, message)
        )
        conn.commit()
        return cursor.lastrowid
    except sqlite3.Error as e:
        app.logger.error(f"Ошибка базы данных: {e}")
        return None


def get_user_messages(session_id):
    try:
        cursor.execute("""
            SELECT id, sender, message, timestamp
            FROM messages
            WHERE user_id = (SELECT id FROM users WHERE session_id = ?)
            ORDER BY timestamp
        """, (session_id,))
        
        return [{"id": row[0], "sender": row[1], "text": row[2], "timestamp": row[3]} for row in cursor.fetchall()]
    except sqlite3.Error as e:
        app.logger.error(f"Ошибка базы данных: {e}")
        return []


# Функция для получения ответа от OpenAI API
def get_openai_response(user_input, session_id):
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2"
    }
    
    try:
        create_thread_url = "https://api.openai.com/v1/threads"
        thread_request_data = {
            "messages": [
                {"role": "user", "content": user_input}
            ]
        }
        
        app.logger.info(f"Отправляем запрос на создание потока: {thread_request_data}")
        thread_response = requests.post(create_thread_url, headers=headers, data=json.dumps(thread_request_data), timeout=10)
        thread_response.raise_for_status()
        thread_data = thread_response.json()
        thread_id = thread_data['id']
        app.logger.info(f"Поток создан с ID: {thread_id}")
        
        run_url = f"https://api.openai.com/v1/threads/{thread_id}/runs"
        run_request_data = {
            "assistant_id": assistant_id
        }
        
        app.logger.info(f"Запускаем ассистента: {run_request_data}")
        run_response = requests.post(run_url, headers=headers, data=json.dumps(run_request_data), timeout=10)
        run_response.raise_for_status()
        run_data = run_response.json()
        run_id = run_data['id']
        run_status = run_data['status']
        
        app.logger.info(f"Статус выполнения: {run_status}")
        
        run_status_url = f"https://api.openai.com/v1/threads/{thread_id}/runs/{run_id}"
        
        # Ожидание завершения
        while run_status not in ['completed', 'failed']:
            app.logger.info(f"Ожидаем завершение: {run_status}")
            time.sleep(2)
            run_status_response = requests.get(run_status_url, headers=headers, timeout=10)
            run_status_response.raise_for_status()
            run_data = run_status_response.json()
            run_status = run_data['status']
        
        app.logger.info(f"Окончательный статус: {run_status}")
        
        if run_status == 'completed':
            messages_url = f"https://api.openai.com/v1/threads/{thread_id}/messages"
            messages_response = requests.get(messages_url, headers=headers, timeout=10)
            messages_response.raise_for_status()
            messages_data = messages_response.json()
            
            app.logger.info(f"Сообщения от ассистента: {messages_data}")
            
            for msg in messages_data['data']:
                if msg['role'] == 'assistant':
                    response_text = msg['content'][0]['text']['value']
                    app.logger.info(f"Ответ от ассистента: {response_text}")
                    return response_text
        
        return 'Ответ не получен от ассистента.'
    
    except requests.exceptions.RequestException as e:
        app.logger.error(f"Ошибка при обращении к OpenAI API: {e}")
        return 'Ошибка при обращении к OpenAI API.'
    except Exception as e:
        app.logger.error(f"Произошла ошибка: {e}")
        return 'Произошла внутренняя ошибка.'


# Маршруты и API
@app.route('/chat', methods=['POST'])
def chat():
    user_message = request.form.get('message')
    user_session = request.form.get('userSession')
    page_url = request.form.get('pageUrl')
    user_agent = request.form.get('userAgent')
    
    if not all([user_message, user_session, page_url, user_agent]):
        return jsonify({"error": "Missing required fields"}), 400
    
    user_id = get_or_create_user(user_session, page_url, user_agent)
    
    if user_id is None:
        return jsonify({"error": "Database error"}), 500
    
    user_message_id = save_message(user_id, 'user', user_message)
    
    bot_response = get_openai_response(user_message, user_session)
    
    if user_message_id is None:
        return jsonify({"error": "Database error"}), 500
    
    bot_message_id = save_message(user_id, 'bot', bot_response)
    
    socketio.emit('new_message', {
        "response": bot_response,
        "user_session": user_session,
        "user_message_id": user_message_id,
        "bot_message_id": bot_message_id,
        "sender": "bot"
    }, room=user_session)
    
    return jsonify({
        "response": bot_response,
        "user_session": user_session,
        "user_message_id": user_message_id,
        "bot_message_id": bot_message_id
    })


@app.route('/proxy/history', methods=['GET'])
def get_history():
    user_session = request.args.get('userSession')
    last_seen_message_id = request.args.get('lastSeenMessageId', '0')
    
    try:
        last_seen_message_id = int(last_seen_message_id)
    except ValueError:
        last_seen_message_id = 0
    
    messages = cursor.execute("""
        SELECT id, sender, message, timestamp
        FROM messages
        WHERE user_id = (SELECT id FROM users WHERE session_id = ?)
        AND id > ?
        ORDER BY id ASC
    """, (user_session, last_seen_message_id)).fetchall()
    
    messages_list = [{"id": row[0], "sender": row[1], "text": row[2], "timestamp": row[3]} for row in messages]
    
    return jsonify({"messages": messages_list})


@app.route('/zayavka', methods=['POST'])
def zayavka():
    session_id = request.form.get('userSession')
    name = request.form.get('name')
    phone = request.form.get('phone')
    message = request.form.get('message')
    
    if not all([session_id, name, phone, message]):
        return jsonify({"error": "Missing required fields"}), 400
    
    cursor.execute("SELECT id FROM users WHERE session_id = ?", (session_id,))
    result = cursor.fetchone()
    
    if result is None:
        return jsonify({"error": "User not found"}), 400
    
    user_id = result[0]
    
    cursor.execute("INSERT INTO requests (user_id, name, phone, message) VALUES (?, ?, ?, ?)", (user_id, name, phone, message))
    conn.commit()
    
    return jsonify({"status": "success"}), 200


@app.route('/get_requests', methods=['GET'])
def get_requests():
    user_session = request.args.get('userSession')
    
    cursor.execute("SELECT id FROM users WHERE session_id = ?", (user_session,))
    user_id = cursor.fetchone()[0]
    
    cursor.execute('''
        SELECT name, phone, message, timestamp FROM requests WHERE user_id = ?
    ''', (user_id,))
    requests_data = cursor.fetchall()
    
    requests_list = []
    for req in requests_data:
        requests_list.append({
            'name': req[0],
            'phone': req[1],
            'message': req[2],
            'timestamp': req[3]
        })
    
    return jsonify({"requests": requests_list})


@app.after_request
def after_request(response):
    allowed_origins = ["https://test.letbefit.ru", 'https://another-allowed-origin.com']
    origin = request.headers.get('Origin')
    if origin in allowed_origins:
        response.headers.add('Access-Control-Allow-Origin', origin)
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response


@app.route('/admin_panel')
def admin_panel():
    cursor.execute('''
        SELECT users.id, users.session_id, users.page_url, users.user_agent,
               MAX(messages.timestamp) as last_message_time
        FROM users
        LEFT JOIN messages ON users.id = messages.user_id
        GROUP BY users.id
        ORDER BY last_message_time DESC
    ''')
    users_data = cursor.fetchall()
    
    today = datetime.now().date()
    yesterday = today - timedelta(days=1)
    
    users = []
    for user in users_data:
        user_id, session_id, page_url, user_agent, last_message_time = user
        
        if last_message_time is None:
            time_category = 'Ранее'
        else:
            last_message_date = datetime.strptime(last_message_time, '%Y-%m-%d %H:%M:%S').date()
            if last_message_date == today:
                time_category = 'Сегодня'
            elif last_message_date == yesterday:
                time_category = 'Вчера'
            else:
                time_category = 'Ранее'
        
        users.append({
            'session_id': session_id,
            'page_url': page_url,
            'user_agent': user_agent,
            'display_name': f"Пользователь {user_id}",
            'time_category': time_category,
            'last_message_time': last_message_time if last_message_time else 'Нет сообщений'
        })
    
    cursor.execute('''
        SELECT name, phone, message, timestamp FROM requests ORDER BY timestamp DESC
    ''')
    requests_data = cursor.fetchall()
    
    requests = []
    for req in requests_data:
        name, phone, message, timestamp = req
        request_date = datetime.strptime(timestamp, '%Y-%m-%d %H:%M:%S').date()
        
        if request_date == today:
            time_category = 'Сегодня'
        elif request_date == yesterday:
            time_category = 'Вчера'
        else:
            time_category = 'Ранее'
        
        requests.append({
            'name': name,
            'phone': phone,
            'message': message,
            'timestamp': timestamp,
            'time_category': time_category
        })
    
    return render_template('admin_panel.html', users=users, requests=requests)


@socketio.on('connect')
def handle_connect():
    app.logger.info('Client connected')


@socketio.on('disconnect')
def handle_disconnect():
    app.logger.info('Client disconnected')


@app.route('/send_admin_message', methods=['POST'])
def send_admin_message():
    session_id = request.form.get('userSession')
    message = request.form.get('message')
    
    if not all([session_id, message]):
        return jsonify({"error": "Missing required fields"}), 400
    
    cursor.execute("SELECT id FROM users WHERE session_id = ?", (session_id,))
    result = cursor.fetchone()
    
    if result is None:
        return jsonify({"error": "User not found"}), 400
    
    user_id = result[0]
    
    message_id = save_message(user_id, 'bot', message)
    
    socketio.emit('new_message', {
        "response": message,
        "user_session": session_id,
        "bot_message_id": message_id,
        "sender": "bot"
    }, room=session_id)
    
    return jsonify({"status": "success", "message_id": message_id}), 200


@socketio.on('join')
def on_join(data):
    session_id = data['session_id']
    join_room(session_id)
    app.logger.info(f'User joined room: {session_id}')


if __name__ == "__main__":
    socketio.run(app, host='0.0.0.0', port=5000)

