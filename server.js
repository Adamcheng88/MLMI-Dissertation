const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const settingsRoutes = require('./server/routes/settings');
const participantRoutes = require('./server/routes/participants');
const adminRoutes = require('./server/routes/admin');
const chatRoutes = require('./server/routes/chat');
const configureChatRoutes = require('./server/routes/configureChat');

const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3004;
const HOST = process.env.HOST || '127.0.0.1';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '15mb' }));
app.use(cookieParser());


app.use('/api', settingsRoutes);
app.use('/api', participantRoutes);
app.use('/api', adminRoutes);
app.use('/api', chatRoutes);
app.use('/api', configureChatRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});


app.use(express.static(PUBLIC_DIR));


app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Listening on ${HOST}:${PORT}`);
});
