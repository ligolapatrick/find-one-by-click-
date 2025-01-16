const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session'); // Import express-session
const { Sequelize, DataTypes, Op } = require('sequelize');

// Create HTTP server and Socket.IO instance
const server = http.createServer(app);
const io = socketIo(server);

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'database.sqlite'
});

// Define the User model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  fullPhoneNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  profilePicture: {
    type: DataTypes.STRING,
    allowNull: true
  },
  age: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  gender: {
    type: DataTypes.STRING,
    allowNull: true
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  online: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  mood: {
    type: DataTypes.STRING,
    allowNull: true
  },
  interests: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  instantDate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false 

  },
  availableToday: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
   searchingForRelationship: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
});

// Define the Message model
const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  fromUserId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id'
    },
    allowNull: false
  },
  toUserId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id'
    },
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW
  },
  messageType: {
    type: DataTypes.STRING,
    allowNull: true
  }
});

// Define the Event model
const Event = sequelize.define('Event', {
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  description: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

// Define the LiveStream model
const LiveStream = sequelize.define('LiveStream', {
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  host: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

// Define associations
User.hasMany(Message, { as: 'SentMessages', foreignKey: 'fromUserId' });
User.hasMany(Message, { as: 'ReceivedMessages', foreignKey: 'toUserId' });
Message.belongsTo(User, { as: 'Sender', foreignKey: 'fromUserId' });
Message.belongsTo(User, { as: 'Receiver', foreignKey: 'toUserId' });

sequelize.sync();

module.exports = { User, Message };

// Sync database
sequelize.sync({ force: true }); // Drop and recreate the tables

// Serve static files from the 'public' directory
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));


// Configure session middleware
app.use(session({
  secret: '4123',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Use secure: true in production with HTTPS
}));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage: storage });

// Handle registration form submission
app.post('/register', async (req, res) => {
  const { username, password, countryCode, phone } = req.body;
  if (password.length < 6) {
    return res.send('Password must be at least 6 characters long.');
  }
  const fullPhoneNumber = `${countryCode}${phone}`;
  const existingUser = await User.findOne({ where: { fullPhoneNumber } });
  if (existingUser) {
    return res.send('Phone number is already used by another user.');
  }
  try {
    const user = await User.create({ username, password, fullPhoneNumber });
    req.session.userId = user.id; // Save userId in session
    res.redirect(`/profile?userId=${user.id}`);
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Handle login form submission
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ where: { username, password } });
    if (user) {
      req.session.userId = user.id; // Save userId in session
      res.redirect(`/profile?userId=${user.id}`);
    } else {
      res.send('Invalid username or password.');
    }
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Middleware to check if the user is logged in
const requireLogin = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
};

// Route to serve the index.html file
app.get('/', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route to serve the registration.html file
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'registration.html'));
});

// Route to serve the login.html file
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Route to serve the profile.html file
app.get('/profile', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// Route to serve the matches.html file
app.get('/matches', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'matches.html'));
});

// Route to serve the nearby.html file
app.get('/nearby', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'nearby.html'));
});

// Route to serve the messages.html file
app.get('/messages', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'messages.html'));
});

// Route to serve the secretcrush.html file
app.get('/secretcrush', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'secretcrush.html'));
});

// Route to serve the coffee-room.html file
app.get('/coffee-room', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'coffee-room.html'));
});

// Route to serve the free-today.html file
app.get('/free-today', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'free-today.html'));
});

// Route to serve the speed-dating.html file
app.get('/speed-dating', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'speed-dating.html'));
});

// Route to serve the about-app.html file
app.get('/about-app', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'about-app.html'));
});

// Route to serve the voice-chat-room.html file
app.get('/voice-chat-room', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'voice-chat-room.html'));
});

// Route to serve the freetohangout.html file
app.get('/freetohangout', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'freetohangout.html'));
});

// Route to serve the searching.html file
app.get('/searching', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'searching.html'));
});

// Route to serve the moodmatcher.html file
app.get('/moodmatcher', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'moodmatcher.html'));
});

// Route to serve the instantdate.html file
app.get('/instantdate', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'instantdate.html'));
});

// Route to serve the nearby-users.html file
app.get('/nearby-users', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'nearby-users.html'));
});

// Route to serve the virtualmeetup.html file
app.get('/virtualmeetup', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'virtualmeetup.html'));
});

// Route to get all users
app.get('/api/all-users', async (req, res) => {
  const users = await User.findAll();
  res.json(users);
});

// Route to get online users
app.get('/api/online-users', async (req, res) => {
  const onlineUsers = await User.findAll({
    where: {
      online: true // Assuming you have a field to track online status
    }
  });
  res.json(onlineUsers);
});

app.get('/profile', async (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login.html');
  }
  const user = await User.findByPk(req.session.userId);
  if (user) {
    res.render('profile', { user });
  } else {
    res.redirect('/login.html');
  }
});

// Route to get a user's profile
app.get('/api/profile', requireLogin, async (req, res) => {
  const userId = req.session.userId;
  const user = await User.findByPk(userId);
  if (user) {
    res.json(user);
  } else {
    res.send('User not found.');
  }
});

// Handle profile update form submission
app.post('/profile', upload.single('profilePicture'), async (req, res) => {
  const { bio, interests, location, age, gender } = req.body;
  const profilePicture = req.file ? `/uploads/${req.file.filename}` : '';
  // Update user's bio, interests, profile picture, location, age, and gender in the database
  const user = await User.findByPk(req.session.userId);
  if (user) {
    user.bio = bio;
    user.interests = JSON.stringify(interests.split(', '));
    user.profilePicture = profilePicture || user.profilePicture;
    user.location = location;
    user.age = age;
    user.gender = gender;
    await user.save();
    res.redirect(`/profile?userId=${user.userId}`);
  } else {
    res.send('User not found.');
  }
});

// Route to get matches for a user
app.get('/api/matches', requireLogin, async (req, res) => {
  const userId = req.session.userId;
  const user = await User.findByPk(userId);
  if (user) {
    const matches = await User.findAll({
      where: {
        id: { [Sequelize.Op.ne]: userId },
        interests: { [Sequelize.Op.like]: `%${user.interests}%` },
        age: {
          [Sequelize.Op.between]: [user.age - 2, user.age + 2]
        }
      }
    });
    res.json(matches);
  } else {
    res.send('User not found.');
  }
});

app.get('/api/currently-online-users', async (req, res) => {
  try {
    const users = await User.findAll({
      where: {
        // Replace 'instantDate' with the correct column name if it's different
        instantdate: true, // Users who are in the Instant Date feature
        online: true // Users who are currently online
      },
      attributes: ['id', 'username', 'profilePicture', 'age', 'location', 'interests']
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching currently online users:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Socket.IO handling for Speed Dating
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('joinSpeedDating', () => {
    // Handle user joining speed dating session
    console.log('User joined speed dating');
  });

  socket.on('sendMessage', (message) => {
    // Broadcast message to other users
    io.emit('receiveMessage', message);
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Socket.IO handling for Voice Chat
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('joinVoiceChat', () => {
    // Handle user joining voice chat
    console.log('User joined voice chat');
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Route to search users based on criteria
app.get('/api/search-users', async (req, res) => {
  const { minAge, maxAge, gender, interests, location } = req.query;
  const interestsArray = interests && interests !== 'any' ? interests.split(',').map(interest => interest.trim()) : [];
  
  try {
    const searchCriteria = {};

    if (minAge && maxAge) {
      searchCriteria.age = { [Op.between]: [minAge, maxAge] };
    } else if (minAge) {
      searchCriteria.age = { [Op.gte]: minAge };
    } else if (maxAge) {
      searchCriteria.age = { [Op.lte]: maxAge };
    }

    if (gender) {
      searchCriteria.gender = gender;
    }

    if (location) {
      searchCriteria.location = location;
    }

    if (interestsArray.length > 0) {
      searchCriteria.interests = {
        [Op.or]: interestsArray.map(interest => ({
          [Op.like]: `%${interest}%`
        }))
      };
    }

    const users = await User.findAll({
      where: searchCriteria
    });
    
    res.json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to get nearby users
app.get('/api/nearby', async (req, res) => {
  const userId = req.session.userId;
  const user = await User.findByPk(userId);
  if (user) {
    const nearbyUsers = await User.findAll({
      where: {
        userId: { [Sequelize.Op.ne]: userId },
        location: user.location
      }
    });
    res.json(nearbyUsers);
  } else {
    res.send('User not found.');
  }
});

// Route to get online users
app.get('/api/online-users', async (req, res) => {
  const onlineUsers = await User.findAll({
    where: {
      online: true
    }
  });
  res.json(onlineUsers);
});

// Route to get messages between users
app.get('/api/messages', async (req, res) => {
  const { userId, chatUserId } = req.query;
  try {
    const messages = await Message.findAll({
      where: {
        [Sequelize.Op.or]: [
          { fromUserId: userId, toUserId: chatUserId },
          { fromUserId: chatUserId, toUserId: userId }
        ]
      },
      order: [['timestamp', 'ASC']]
    });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).send('Internal Server Error');
  }
});
// Send a message
app.post('/api/send-message', requireLogin, async (req, res) => {
  const { toUserId, content } = req.body;

  // Log the user IDs for debugging
  console.log('Sending message from:', req.session.userId, 'to:', toUserId);

  // Validate the toUserId parameter
  if (!toUserId) {
    return res.status(400).json({ error: 'Missing required parameter: toUserId' });
  }

  try {
    const message = await Message.create({
      fromUserId: req.session.userId,
      toUserId,
      content,
      timestamp: new Date()
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Send a message
app.post('/api/send-message', async (req, res) => {
  const { toUserId, content } = req.body;
  const fromUserId = req.session.userId; // Replace with dynamic userId from session

  try {
    const message = await Message.create({ fromUserId, toUserId, content });
    res.sendStatus(200);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Fetch messages for a specific conversation
app.get('/api/messages', async (req, res) => {
  const { userId, chatUserId } = req.query;

  if (!userId || !chatUserId) {
    return res.status(400).json({ error: 'Missing userId or chatUserId' });
  }

  try {
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { fromUserId: userId, toUserId: chatUserId },
          { fromUserId: chatUserId, toUserId: userId }
        ]
      },
      order: [['createdAt', 'ASC']]
    });

    const chatUser = await User.findByPk(chatUserId, {
      attributes: ['id', 'username']
    });

    res.json({ messages, chatUser });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch the chat list for a user
app.get('/api/chat-list', async (req, res) => {
  const userId = req.query.userId;

  try {
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { fromUserId: userId },
          { toUserId: userId }
        ]
      },
      attributes: [
        [sequelize.fn('DISTINCT', sequelize.col('fromUserId')), 'fromUserId'],
        [sequelize.fn('DISTINCT', sequelize.col('toUserId')), 'toUserId']
      ]
    });

    const chatUserIds = new Set();
    messages.forEach(msg => {
      if (msg.fromUserId != userId) chatUserIds.add(msg.fromUserId);
      if (msg.toUserId != userId) chatUserIds.add(msg.toUserId);
    });

    const chatUsers = await User.findAll({
      where: { id: Array.from(chatUserIds) },
      attributes: ['id', 'username']
    });

    res.json(chatUsers);
  } catch (error) {
    console.error('Error fetching chat list:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Routes
app.get('/api/match-mood', async (req, res) => {
  const { userId } = req.session;
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).send('User not found');
    }

    const matches = await User.findAll({
      attributes: ['id', 'username', 'mood', 'profilePicture'],
      where: {
        mood: user.mood
      }
    });
    res.json(matches);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/update-mood', async (req, res) => {
  const { mood } = req.body;
  const userId = req.session.userId; // Assuming userId is stored in the session
  try {
    const user = await User.findByPk(userId);
    if (user) {
      user.mood = mood;
      await user.save();
      res.sendStatus(200);
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    console.error('Error updating mood:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/send-mood-match-request', async (req, res) => {
  const { userId } = req.body; // ID of the user to send match request to
  const fromUserId = req.session.userId; // Assuming userId is stored in the session
  // Implement logic for sending match request
  // For now, we'll just log the request
  console.log(`Match request sent from ${fromUserId} to ${userId}`);
  res.sendStatus(200);
});
// Routes
app.get('/api/nearby-users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'profilePicture', 'age', 'interests', 'online']
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching nearby users:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/nearby-users', (req, res) => {
    // Mock data for nearby users
    const nearbyUsers = Object.values(users).map(user => ({
        userId: user.userId,
        username: user.username,
        profilePicture: user.profile_picture || 'default-profile.png'
    }));
    res.send(nearbyUsers);
});
app.get('/api/matches', async (req, res) => {
  const { mood } = req.query;
  try {
    if (!mood) {
      return res.status(400).send('Mood parameter is required.');
    }
    const matches = await User.findAll({
      where: {
        mood
      }
    });
    res.json(matches);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/online-users', async (req, res) => {
  try {
    const onlineUsers = await User.findAll({
      where: {
        online: true
      },
      attributes: ['id', 'username', 'profilePicture']
    });
    res.json(onlineUsers);
  } catch (error) {
    console.error('Error fetching users by status:', error);
    res.status(500).send('Internal Server Error');
  }
});

let waitingUsers = [];
let chatPairs = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('joinCoffeeRoom', () => {
    if (waitingUsers.length > 0) {
      const partnerSocketId = waitingUsers.pop();
      chatPairs[socket.id] = partnerSocketId;
      chatPairs[partnerSocketId] = socket.id;

      socket.emit('strangerMessage', 'You are now chatting with a stranger.');
      io.to(partnerSocketId).emit('strangerMessage', 'You are now chatting with a stranger.');

      setTimeout(() => {
        endChat(socket.id);
        endChat(partnerSocketId);
      }, 180000); // 3 minutes in milliseconds
    } else {
      waitingUsers.push(socket.id);
    }
  });

  socket.on('userMessage', (message) => {
    const partnerSocketId = chatPairs[socket.id];
    if (partnerSocketId) {
      io.to(partnerSocketId).emit('strangerMessage', message);
    }
  });

  socket.on('endChat', () => {
    endChat(socket.id);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    endChat(socket.id);
  });

  function endChat(socketId) {
    const partnerSocketId = chatPairs[socketId];
    if (partnerSocketId) {
      io.to(partnerSocketId).emit('endChat');
      delete chatPairs[partnerSocketId];
      delete chatPairs[socketId];
    } else {
      const index = waitingUsers.indexOf(socketId);
      if (index !== -1) {
        waitingUsers.splice(index, 1);
      }
    }
  }
});

app.get('/api/matches', async (req, res) => {
  const { userId } = req.query;
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).send('User not found');
    }

    const ageRangeMin = user.age - 2;
    const ageRangeMax = user.age + 2;
    const interestArray = JSON.parse(user.interests || '[]');

    const matches = await User.findAll({
      where: {
        userId: { [Sequelize.Op.ne]: userId },
        age: { [Sequelize.Op.between]: [ageRangeMin, ageRangeMax] },
        interests: { [Sequelize.Op.like]: `%${interestArray}%` }
      },
      attributes: ['userId', 'username', 'age', 'interests', 'profilePicture', 'online']
    });

    res.json(matches);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).send('Internal Server Error');
  }
});
// Define new route to fetch users based on online/offline status
app.get('/api/users-status', async (req, res) => {
  const { status } = req.query; // Accepts 'online' or 'offline'
  try {
    const users = await User.findAll({
      where: {
        online: status === 'online' ? true : false
      },
      attributes: ['id', 'username', 'profilePicture', 'online']
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users by status:', error);
    res.status(500).send('Internal Server Error');
  }
});

let ongoingVoiceChats = [];

// Routes

// Updated endpoint to fetch users based on online/offline status
app.get('/api/users-status', async (req, res) => {
  const { status } = req.query; // Accepts 'online' or 'offline'
  try {
    const users = await User.findAll({
      where: {
        online: status === 'online' ? true : false
      },
      attributes: ['userId', 'username', 'profilePicture', 'age', 'interests', 'online']
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users by status:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/nearby-users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['userId', 'username', 'profilePicture', 'online']
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching nearby users:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/matches', async (req, res) => {
  const { userId } = req.session;
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).send('User not found');
    }

    const matches = await User.findAll({
      attributes: ['userId', 'username', 'profilePicture'],
      where: {
        mood: user.mood
      }
    });
    res.json(matches);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Route to send a message
app.post('/api/send-message', async (req, res) => {
  const { from, to, content } = req.body;
  try {
    await Message.create({ from, to, content, timestamp: new Date() });
    res.sendStatus(200);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Add route to fetch chat list
app.get('/api/chat-list', async (req, res) => {
  const { userId } = req.query;
  try {
    const chats = await Message.findAll({
      where: {
        [Sequelize.Op.or]: [
          { fromUserId: userId },
          { toUserId: userId }
        ]
      },
      include: [
        { model: User, as: 'Sender', attributes: ['username'] },
        { model: User, as: 'Receiver', attributes: ['username'] }
      ]
    });

    const uniqueUsers = [...new Set(chats.map(msg => 
      msg.fromUserId === parseInt(userId) ? msg.Receiver : msg.Sender))];
    res.json(uniqueUsers);
  } catch (error) {
    console.error('Error fetching chat list:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Fetch users who are currently in the SecretCrush feature
app.get('/api/secretcrush-users', async (req, res) => {
  try {
    const users = await User.findAll({
      where: {
        // You can add any additional criteria here if needed
      },
      attributes: ['id', 'username', 'profilePicture', 'age', 'gender', 'interests']
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching secretcrush users:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Fetch users for SecretCrush
app.get('/api/secretcrush-users', requireLogin, async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Send a message
app.post('/api/send-message', requireLogin, async (req, res) => {
  const { toUserId, content } = req.body;
  try {
    const message = await Message.create({
      fromUserId: req.session.userId,
      toUserId,
      content,
      timestamp: new Date()
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Send a secret admirer message
app.post('/api/send-admirer-message', requireLogin, async (req, res) => {
  const { toUserId, content } = req.body;
  try {
    const message = await Message.create({
      fromUserId: req.session.userId,
      toUserId,
      content,
      timestamp: new Date(),
      messageType: 'secretCrush'
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending secret admirer message:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Fetch received messages
app.get('/api/received-messages', requireLogin, async (req, res) => {
  const { userId } = req.query;
  try {
    const messages = await Message.findAll({
      where: { toUserId: userId },
      include: [{ model: User, as: 'Sender', attributes: ['username'] }]
    });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching received messages:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/send-notification', async (req, res) => {
  const { message } = req.body;
  // Implement logic to send notification
  res.json({ message: 'Notification sent!' });
});

// Socket.IO event handling
io.on('connection', (socket) => {
  console.log('A user connected');
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});
// Route to get all messages for the logged-in user
app.get('/api/messages', async (req, res) => {
  const fromUserId = req.session.userId;
  if (!fromUserId) {
    return res.status(400).json({ error: 'User not logged in' });
  }
  try {
    const messages = await Message.findAll({ where: { fromUserId } });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Route to fetch currently online users in the Instant Date feature
app.get('/api/currently-online-users', async (req, res) => {
  try {
    const users = await User.findAll({
      where: {
        instantDate: true,
        online: true
      },
      attributes: ['id', 'username', 'profilePicture', 'age', 'location', 'interests']
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching currently online users:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Route to handle user joining the Instant Date feature
app.post('/api/join-instant-date', async (req, res) => {
  const userId = req.session.userId;
  try {
    const user = await User.findByPk(userId);
    if (user) {
      user.instantDate = true;
      await user.save();
      res.sendStatus(200);
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    console.error('Error joining Instant Date:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Route to handle user leaving the Instant Date feature
app.post('/api/leave-instant-date', async (req, res) => {
  const userId = req.session.userId;
  try {
    const user = await User.findByPk(userId);
    if (user) {
      user.instantDate = false;
      await user.save();
      res.sendStatus(200);
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    console.error('Error leaving Instant Date:', error);
    res.status(500).send('Internal Server Error');
  }
});

let speedDatingSessions = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('createSpeedDatingSession', (sessionName) => {
    speedDatingSessions[sessionName] = { host: socket.id, participants: [socket.id], messages: [] };
    socket.join(sessionName);
    socket.emit('sessionCreated', sessionName);
    updateSessionList();
  });

  socket.on('joinSpeedDatingSession', (sessionName) => {
    if (speedDatingSessions[sessionName]) {
      speedDatingSessions[sessionName].participants.push(socket.id);
      socket.join(sessionName);
      socket.emit('sessionJoined', sessionName);
      updateSessionList();
    }
  });

  socket.on('sendMessage', ({ content, session }) => {
    const message = { sender: socket.id, content };
    speedDatingSessions[session].messages.push(message);
    io.to(session).emit('receiveMessage', message);
  });

  socket.on('endSpeedDatingSession', (sessionName) => {
    if (speedDatingSessions[sessionName]) {
      delete speedDatingSessions[sessionName];
      io.to(sessionName).emit('sessionEnded');
      updateSessionList();
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const sessionName in speedDatingSessions) {
      const session = speedDatingSessions[sessionName];
      if (session.host === socket.id) {
        delete speedDatingSessions[sessionName];
        io.to(sessionName).emit('sessionEnded');
      } else {
        session.participants = session.participants.filter(id => id !== socket.id);
      }
    }
    updateSessionList();
  });

  function updateSessionList() {
    const sessions = Object.keys(speedDatingSessions).map(name => ({
      name,
      participants: speedDatingSessions[name].participants
    }));
    io.emit('updateSessionList', sessions);
  }
});

// Fetch available voice chats
app.get('/api/voice-chats', async (req, res) => {
  try {
    // Implement logic to fetch available voice chats
    res.json([]); // Placeholder for available voice chats
  } catch (error) {
    console.error('Error fetching voice chats:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Fetch available voice chats
app.get('/api/voice-chats', async (req, res) => {
  try {
    res.json(Object.keys(voiceChatRooms));
  } catch (error) {
    console.error('Error fetching voice chats:', error);
    res.status(500).send('Internal Server Error');
  }
});

let voiceChatRooms = {};
let coffeeRoomUsers = [];

// Socket.IO handling
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('createVoiceChat', (sessionName) => {
    voiceChatRooms[sessionName] = { host: socket.id, participants: [socket.id], listeners: [] };
    socket.join(sessionName);
    socket.emit('voiceChatCreated', sessionName);
    updateVoiceChatList();
  });

  socket.on('joinVoiceChat', (sessionName) => {
    if (voiceChatRooms[sessionName]) {
      if (voiceChatRooms[sessionName].participants.length < 6) {
        voiceChatRooms[sessionName].participants.push(socket.id);
        socket.join(sessionName);
        socket.emit('voiceChatJoined', sessionName);
        io.to(sessionName).emit('newParticipant', socket.id);
      } else {
        voiceChatRooms[sessionName].listeners.push(socket.id);
        socket.emit('voiceChatJoined', sessionName);
      }
    }
  });

  socket.on('leaveVoiceChat', (sessionName) => {
    if (voiceChatRooms[sessionName]) {
      if (voiceChatRooms[sessionName].host === socket.id) {
        // End session if the host leaves
        delete voiceChatRooms[sessionName];
        io.to(sessionName).emit('sessionEnded');
      } else {
        voiceChatRooms[sessionName].participants = voiceChatRooms[sessionName].participants.filter(id => id !== socket.id);
        if (voiceChatRooms[sessionName].listeners.length > 0) {
          const newParticipant = voiceChatRooms[sessionName].listeners.shift();
          voiceChatRooms[sessionName].participants.push(newParticipant);
          io.to(sessionName).emit('newParticipant', newParticipant);
        }
      }
      socket.leave(sessionName);
      updateVoiceChatList();
    }
  });

  socket.on('offer', async ({ to, offer }) => {
    io.to(to).emit('offer', { from: socket.id, offer });
  });

  socket.on('answer', ({ to, answer }) => {
    io.to(to).emit('answer', { from: socket.id, answer });
  });

  socket.on('iceCandidate', ({ to, candidate }) => {
    io.to(to).emit('iceCandidate', { from: socket.id, candidate });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
    for (const sessionName in voiceChatRooms) {
      const room = voiceChatRooms[sessionName];
      if (room.host === socket.id) {
        // End session if the host disconnects
        delete voiceChatRooms[sessionName];
        io.to(sessionName).emit('sessionEnded');
      } else {
        room.participants = room.participants.filter(id => id !== socket.id);
        if (room.listeners.length > 0) {
          const newParticipant = room.listeners.shift();
          room.participants.push(newParticipant);
          io.to(sessionName).emit('newParticipant', newParticipant);
        }
      }
    }
    updateVoiceChatList();
    
    // Handle user disconnection from coffee room
    const index = coffeeRoomUsers.indexOf(socket);
    if (index !== -1) {
      coffeeRoomUsers.splice(index, 1);
    }
  });
});

function updateVoiceChatList() {
  const sessions = Object.keys(voiceChatRooms);
  io.emit('updateVoiceChatList', sessions);
}

// Fetch available users
app.get('/api/free-to-hangout', async (req, res) => {
  try {
    const users = await User.findAll({
      where: { availableToday: true },
      attributes: ['id', 'username', 'profilePicture', 'location']
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Send hangout request
app.post('/api/send-hangout-request', async (req, res) => {
  const { userId } = req.body;
  try {
    const user = await User.findByPk(userId);
    if (user) {
      // Handle sending hangout request (e.g., notification)
      res.sendStatus(200);
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    console.error('Error sending hangout request:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Send message
app.post('/api/send-message', async (req, res) => {
  const { toUserId, content } = req.body;
  const fromUserId = 'yourUserId'; // Replace with dynamic userId

  try {
    const message = await Message.create({ fromUserId, toUserId, content });
    res.sendStatus(200);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Fetch messages
app.get('/api/messages', async (req, res) => {
  const userId = 'yourUserId'; // Replace with dynamic userId

  try {
    const messages = await Message.findAll({
      where: { toUserId: userId },
      order: [['timestamp', 'DESC']],
      include: [{ model: User, as: 'fromUser', attributes: ['username'] }]
    });

    const formattedMessages = messages.map(msg => ({
      fromUser: msg.fromUser.username,
      fromUserId: msg.fromUserId,
      content: msg.content,
      timestamp: msg.timestamp
    }));

    res.json(formattedMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Create a virtual event
app.post('/api/create-virtual-event', async (req, res) => {
  const { title, date, description } = req.body;
  try {
    const event = await Event.create({ title, date, description });
    res.status(201).json(event);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Fetch virtual events
app.get('/api/virtual-events', async (req, res) => {
  try {
    const events = await Event.findAll();
    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Fetch live streams
app.get('/api/live-streams', async (req, res) => {
  try {
    const streams = await LiveStream.findAll();
    res.json(streams);
  } catch (error) {
    console.error('Error fetching live streams:', error);
    res.status(500).send('Internal Server Error');
  }
});


// Fetch users who are searching for a relationship
app.get('/api/searching-for-relationship', async (req, res) => {
  try {
    const users = await User.findAll({
      where: { searchingForRelationship: true },
      attributes: ['id', 'username', 'profilePicture', 'location', 'age', 'interests']
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Send a message
app.post('/api/send-message', async (req, res) => {
  const { userId, message } = req.body;
  const fromUserId = req.session.userId; // Replace with dynamic userId from session
  try {
    const newMessage = await Message.create({ fromUserId, toUserId: userId, content: message });
    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Fetch messages for a specific conversation
app.get('/api/messages', async (req, res) => {
  const { userId, chatUserId } = req.query;
  if (!userId || !chatUserId) {
    return res.status(400).json({ error: 'Missing userId or chatUserId' });
  }
  try {
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { fromUserId: userId, toUserId: chatUserId },
          { fromUserId: chatUserId, toUserId: userId }
        ]
      },
      order: [['createdAt', 'ASC']]
    });
    const chatUser = await User.findByPk(chatUserId, { attributes: ['id', 'username'] });
    res.json({ messages, chatUser });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch the chat list for a user
app.get('/api/chat-list', async (req, res) => {
  const userId = req.query.userId;
  try {
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { fromUserId: userId },
          { toUserId: userId }
        ]
      },
      attributes: [
        [sequelize.fn('DISTINCT', sequelize.col('fromUserId')), 'fromUserId'],
        [sequelize.fn('DISTINCT', sequelize.col('toUserId')), 'toUserId']
      ]
    });
    const chatUserIds = new Set();
    messages.forEach(msg => {
      if (msg.fromUserId != userId) chatUserIds.add(msg.fromUserId);
      if (msg.toUserId != userId) chatUserIds.add(msg.toUserId);
    });
    const chatUsers = await User.findAll({
      where: { id: Array.from(chatUserIds) },
      attributes: ['id', 'username']
    });
    res.json(chatUsers);
  } catch (error) {
    console.error('Error fetching chat list:', error);
    res.status(500).send('Internal Server Error');
  }
});

   // Start the server
   const port = 3000;
   server.listen(port, () => {
     console.log(`Server is running on http://localhost:${port}`);
   });
