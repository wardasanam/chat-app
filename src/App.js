import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './App.css';

const socket = io('http://localhost:5000');

function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [username, setUsername] = useState('');
  const [typingUser, setTypingUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState('');
  const chatBoxRef = useRef(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    // Validate inputs
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      return;
    }
    try {
      const endpoint = isSignup ? '/signup' : '/login';
      console.log('Sending request to:', endpoint, { username, password }); // Log the request
      const response = await axios.post(`http://localhost:5000${endpoint}`, {
        username,
        password
      });
      setIsLoggedIn(true);
      setError('');
      socket.emit('getMessages', username);
    } catch (err) {
      console.error('Error during login/signup:', err.response?.data); // Log the error
      setError(err.response?.data?.error || 'Something went wrong');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
    setMessages([]);
    setError('');
    setIsSignup(false);
  };

  const handleDeleteMessage = (index) => {
    const message = messages[index];
    socket.emit('deleteMessage', { user: message.user, text: message.text, timestamp: message.timestamp });
  };

  const handleClearChat = () => {
    socket.emit('clearChat', username);
    setMessages([]);
  };

  const sendMessage = () => {
    if (input.trim()) {
      const newMessage = {
        user: username,
        text: input,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      socket.emit('message', newMessage);
      setInput('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (e.target.value.trim()) {
      socket.emit('typing', username);
    }
  };

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    socket.on('message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('typing', (username) => {
      setTypingUser(username);
      setTimeout(() => setTypingUser(null), 3000);
    });

    socket.on('loadMessages', (savedMessages) => {
      setMessages(savedMessages);
    });

    socket.on('messageDeleted', ({ user, text, timestamp }) => {
      setMessages((prev) =>
        prev.filter(
          (msg) => !(msg.user === user && msg.text === text && msg.timestamp === timestamp)
        )
      );
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('message');
      socket.off('typing');
      socket.off('loadMessages');
      socket.off('messageDeleted');
    };
  }, []);

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  if (!isLoggedIn) {
    return (
      <div className="app-container">
        <div className="chat-container glass-effect">
          <h1 className="chat-header">My Chat App</h1>
          <form onSubmit={handleLogin} className="login-form glass-effect">
            <h2>{isSignup ? 'Sign Up' : 'Login'}</h2>
            <div className="form-group">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="form-input"
                autoComplete="username"
              />
            </div>
            <div className="form-group">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="form-input"
                autoComplete="current-password"
              />
            </div>
            {error && <p className="error-message">{error}</p>}
            <button type="submit" className="submit-button">
              {isSignup ? 'Sign Up' : 'Login'}
            </button>
            <div className="toggle-container">
              <span className="toggle-text">
                {isSignup ? 'Already have an account?' : 'No account?'}
              </span>
              <button
                onClick={() => { setIsSignup(!isSignup); setError(''); }}
                className="toggle-button signup-button"
              >
                {isSignup ? 'Login' : 'Sign Up'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="chat-container glass-effect">
        <h1 className="chat-header">My Chat App</h1>
        <div className="user-info">
          <p>Logged in as: {username}</p>
          <div>
            <button onClick={handleClearChat} className="clear-chat-button">
              Clear Chat
            </button>
            <button onClick={handleLogout} className="logout-button">
              Logout
            </button>
          </div>
        </div>
        <div className="chat-box glass-effect" ref={chatBoxRef}>
          {messages.map((msg, index) => (
            <div className={`message ${msg.user === username ? 'you' : ''}`} key={index}>
              <span>
                <strong>{msg.user}:</strong> {msg.text}{' '}
                <span className="timestamp">[{msg.timestamp}]</span>
              </span>
              {msg.user === username && (
                <button
                  onClick={() => handleDeleteMessage(index)}
                  className="delete-button"
                  title="Delete message"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="input-area">
          <input
            value={input}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="message-input glass-effect"
          />
          <button onClick={sendMessage} className="send-button">
            Send
          </button>
        </div>
        {typingUser && typingUser !== username && (
          <p className="typing-indicator">{typingUser} is typing...</p>
        )}
      </div>
    </div>
  );
}

export default App;