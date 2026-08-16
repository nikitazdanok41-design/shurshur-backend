const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Добавляем настройки CORS, чтобы сервер принимал запросы с твоего GitHub Pages
const io = new Server(server, {
    cors: {
        origin: "*", // Разрешает любые внешние адреса сайтов
        methods: ["GET", "POST"]
    }
});

// Имитация базы данных в памяти сервера
const users = {}; 

io.on('connection', (socket) => {
    console.log(`Пользователь подключился: ${socket.id}`);

    // 1. Авторизация и Регистрация
    socket.on('auth', ({ phone, password }) => {
        if (users[phone]) {
            if (users[phone].password !== password) {
                return socket.emit('auth_response', { success: false, message: 'Неверный пароль!' });
            }
            users[phone].socketId = socket.id; 
            console.log(`[ShurShur] Вход: ${phone}`);
        } else {
            users[phone] = { password, socketId: socket.id };
            console.log(`[ShurShur] Регистрация: ${phone}`);
        }
        socket.phone = phone;
        socket.emit('auth_response', { success: true, phone });
    });

    // 2. Поиск пользователя по номеру телефона
    socket.on('search_contact', (targetPhone) => {
        if (users[targetPhone]) {
            socket.emit('search_response', { exists: true, phone: targetPhone });
        } else {
            socket.emit('search_response', { exists: false, message: 'Пользователь не найден в ShurShur' });
        }
    });

    // 3. Пересылка зашифрованного E2EE сообщения
    socket.on('send_msg', ({ to, encryptedText, time }) => {
        const recipient = users[to];
        if (recipient && recipient.socketId) {
            io.to(recipient.socketId).emit('receive_msg', {
                from: socket.phone,
                encryptedText,
                time
            });
        }
    });

    // 4. Индикатор «Печатает...»
    socket.on('typing_status', ({ to, isTyping }) => {
        const recipient = users[to];
        if (recipient && recipient.socketId) {
            io.to(recipient.socketId).emit('user_typing', {
                from: socket.phone,
                isTyping
            });
        }
    });

    socket.on('disconnect', () => {
        if (socket.phone && users[socket.phone]) {
            users[socket.phone].socketId = null;
        }
        console.log(`Пользователь отключился: ${socket.id}`);
    });
});

// Автоматический порт для Railway
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер ShurShur Messenger запущен на порту ${PORT}`);
});

