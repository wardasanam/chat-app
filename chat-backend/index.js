const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  methods: ['GET', 'POST'],
  credentials: true
}));
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST']
  }
}));

const USERS_FILE = path.join(__dirname, 'users.json');

async function loadUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

async function saveUsers(users) {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

app.post('/signup', async (req, res) => {
  console.log('Signup request received:', req.body); // Log the request
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const users = await loadUsers();
  if (users[username]) {
    return res.status(400).json({ error: 'Username taken' });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  users[username] = { password: hashedPassword, messages: [] };
  await saveUsers(users);
  res.json({ message: 'Signup successful' });
});

app.post('/login', async (req, res) => {
  console.log('Login request received:', req.body); // Log the request
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const users = await loadUsers();
  if (!users[username]) {
    return res.status(400).json({ error: 'User not found' });
  }
  const match = await bcrypt.compare(password, users[username].password);
  if (!match) {
    return res.status(400).json({ error: 'Invalid password' });
  }
  res.json({ message: 'Login successful', username });
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('message', async (msg) => {
    const users = await loadUsers();
    for (const username in users) {
      users[username].messages.push(msg);
    }
    await saveUsers(users);
    io.emit('message', msg);
  });

  socket.on('typing', (username) => {
    socket.broadcast.emit('typing', username);
  });

  socket.on('getMessages', async (username) => {
    const users = await loadUsers();
    const allMessages = [];
    const messageSet = new Set();
    for (const user in users) {
      users[user].messages.forEach((msg) => {
        const msgKey = `${msg.user}:${msg.text}:${msg.timestamp}`;
        if (!messageSet.has(msgKey)) {
          messageSet.add(msgKey);
          allMessages.push(msg);
        }
      });
    }
    allMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    socket.emit('loadMessages', allMessages);
  });

  socket.on('deleteMessage', async ({ user, text, timestamp }) => {
    const users = await loadUsers();
    for (const username in users) {
      users[username].messages = users[username].messages.filter(
        (msg) => !(msg.user === user && msg.text === text && msg.timestamp === timestamp)
      );
    }
    await saveUsers(users);
    io.emit('messageDeleted', { user, text, timestamp });
  });

  socket.on('clearChat', async (username) => {
    const users = await loadUsers();
    if (users[username]) {
      users[username].messages = [];
      await saveUsers(users);
      socket.emit('loadMessages', []);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(5000, () => {
  console.log('Backend server running on http://localhost:5000');
});