/*
HOW TO SET UP

run {
    npm i
    node app
}
go to localhost:3000

download formbar dev branch from https://github.com/csmith1188/Formbar.js/tree/DEV
in formbar window, run {
    npm i;
    cp .env-template .env;
    npm run init-db;
    node app;
}
go to localhost:420
log in (or register)
*/

require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const sqlite3 = require('sqlite3');
const { Server } = require('socket.io');
const ioServer = new Server(http);
const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const session = require('express-session');

const FORMBAR_URL = 'http://localhost:420';
const API_KEY = process.env.API_KEY;
const THIS_URL = 'http://localhost:3000/login';
const AUTH_URL = 'http://localhost:420/oauth';
const port = 3000;

const socket = io(FORMBAR_URL, {
    extraHeaders: { api: API_KEY }
});

const db = new sqlite3.Database('data/database.db', (err) => {
    if (err) console.error('Error opening database: ' + err.message);
    else console.log('Connected to the database.');
});

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
    secret: 'ohnose!',
    resave: false,
    saveUninitialized: false
}));

let latestClassData = null;

ioServer.on('connection', (browserSocket) => {
    console.log('Browser connected to PollPin socket');
    browserSocket.emit('serverAlive', { ok: true, ts: Date.now() });
    if (latestClassData) browserSocket.emit('classData', latestClassData);

    socket.on('classUpdate', (classroomData) => {
        if (!classroomData) return;
        console.log('Received class update:', classroomData);

        latestClassData = classroomData;
        ioServer.emit('classData', latestClassData);

        db.get('SELECT * FROM Classes WHERE id=?', [classroomData.id], (err, row) => {
            if (err) return console.error('Error fetching class data:', err);

            if (!row) {
                db.run(
                    'INSERT INTO Classes (id, name, owner, key, permissions) VALUES (?, ?, ?, ?, ?)',
                    [
                        classroomData.id,
                        classroomData.className,
                        JSON.stringify(classroomData.students[1]?.id || null),
                        classroomData.key,
                        JSON.stringify(classroomData.permissions)
                    ],
                    (err) => {
                        if (err) console.error('Error inserting class data:', err);
                        else console.log('Class data inserted successfully');
                    }
                );
            }
        });
    });

    socket.on('classData', (pinPollPrompt, pinPollResponses) => {
        console.log('Received classData event');
        console.log('Poll Prompt:', pinPollPrompt);
        console.log('Poll Responses:', pinPollResponses);

        db.run(
            'UPDATE Polls SET pollPrompt=?, pollResponse=?',
            [pinPollPrompt, pinPollResponses],
            (err) => {
                if (err) console.error('Error updating class data:', err);
                else console.log('Class data updated successfully');
            }
        );

        latestClassData = { pinPollPrompt, pinPollResponses };
        ioServer.emit('classData', latestClassData);
    });

    socket.on('pinPoll', (data) => {
        console.log('pinPoll', data);

        const { pinPollPrompt, pinPollResponses } = data || {};
        if (pinPollPrompt && pinPollResponses) {
            db.run(
                'UPDATE Classes SET pollPrompt=?, pollResponse=?',
                [pinPollPrompt, pinPollResponses],
                (err) => {
                    if (err) console.error('Error updating poll data:', err);
                    else console.log('Poll data updated successfully');
                }
            );
        }

        latestClassData = data;
        ioServer.emit('classData', latestClassData);
        console.log('pinnedPoll', data);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from Formbar');
    });
});

let classId = 1;
let classCode = 'rne5';
socket.emit('joinClass', classId);
socket.on('joinClass', (response) => {
    console.log('joinClass', response);
    if (response === true) {
        console.log('Successfully joined class');
        socket.emit('classUpdate');
    } else {
        socket.emit('joinRoom', classCode);
        console.log('Failed to join class: ' + response);
    }
});

function isAuthenticated(req, res, next) {
    console.log('Checking Auth');
    if (req.session.user) next();
    else res.redirect(`/login?redirectURL=${THIS_URL}`);
}

app.get('/login', (req, res) => {
    if (req.query.token) {
        let tokenData = jwt.decode(req.query.token)
        console.log("Token data:", tokenData)
        req.session.token = tokenData
        req.session.user = tokenData.displayName
        req.session.permissions = tokenData.permissions
        req.session.email = tokenData.email
        req.session.activeClass = tokenData.activeClass
        console.log("Logged in as " + req.session.user)
        res.redirect('/')
        db.get('SELECT * FROM users WHERE fb_name=? AND fb_id=?', [req.session.user, tokenData.id], (err, row) => {
            if (err) {
                console.log(err)
                res.send("There big bad error:\n" + err)
            } else if (!row) {
                // Insert new user
                db.run(
                    'INSERT INTO users(fb_name, fb_id, permissions, email, activeClass) VALUES(?, ?, ?, ?, ?);',
                    [req.session.user, tokenData.id, tokenData.permissions, tokenData.email, tokenData.activeClass],
                    (err) => {
                        if (err) {
                            console.log(err)
                            res.send("Database error:\n" + err)
                        }
                    }
                );
            } else {
                // Update existing user's activeClass
                db.run(
                    'UPDATE users SET activeClass=? WHERE fb_name=? AND fb_id=?;',
                    [tokenData.activeClass, req.session.user, tokenData.id],
                    (err) => {
                        if (err) {
                            console.log(err)
                            res.send("Database error:\n" + err)
                        }
                    }
                );
            }
        });
    } else {
        if (!req.session.user) {
            return res.redirect(`${AUTH_URL}?redirectURL=${THIS_URL}`);
        }
        console.log('Already logged in as:', req.session.user.displayName);
        res.redirect('/');
    }
});

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/Polls', isAuthenticated, (req, res) => {
    try {
        res.render('Polls', {
            user: req.session.user.displayName,
            permissions: req.session.user.permissions,
            polls: req.session.polls
        });
    } catch (error) {
        console.error('Error rendering Polls page:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/profile', isAuthenticated, (req, res) => {
    db.get('SELECT * FROM users WHERE fb_name=?', [req.session.user.displayName], (err, user) => {
        if (err) {
            console.error('Error fetching user data:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.render('profile', { user });
    });
});

app.get('/classes', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;

    db.all('SELECT * FROM Classes WHERE owner = ?', [userId], (err, classes) => {
        if (err) {
            console.error('Error fetching classes:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.render('classes', { classes });
    });
});

// Create a new class
app.post('/classes', isAuthenticated, (req, res) => {
    const { name, key } = req.body;
    const owner = req.session.user.id;
    const permissions = 'teacher';

    if (!name || !key) {
        return res.status(400).send('Class name and key are required.');
    }

    db.run(
        'INSERT INTO Classes (name, owner, key, permissions) VALUES (?, ?, ?, ?)',
        [name, owner, key, permissions],
        function (err) {
            if (err) {
                console.error('Error inserting class:', err);
                return res.status(500).send('Internal Server Error');
            }
            res.redirect('/classes');
        }
    );
});

http.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
});
