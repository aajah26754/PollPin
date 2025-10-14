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
let express = require('express');
let app = express();

const http = require('http').createServer(app);
const sqlite3 = require('sqlite3');
const { Server } = require('socket.io');
const ioServer = new Server(http);
const { io } = require('socket.io-client');
const FORMBAR_URL = 'http://localhost:420'  //'http://formbeta.yorktechapps.com';
const API_KEY = process.env.API_KEY;
const jwt = require('jsonwebtoken')
const session = require('express-session')
const THIS_URL = 'http://localhost:3000/login'
const AUTH_URL = 'http://localhost:420/oauth'


port = 3000;
const socket = io(FORMBAR_URL, {
    extraHeaders: {
        api: API_KEY
    }
});

const db = new sqlite3.Database('data/database.db', (err) => {
    if (err) {
        console.error('Error opening database ' + err.message);
    } else {
        console.log('Connected to the database.');
    }
});

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

let latestClassData = null;

ioServer.on('connection', (socket) => {
    console.log('Browser connected to PollPin socket');
    socket.emit('serverAlive', { ok: true, ts: Date.now() });
    if (latestClassData) {
        socket.emit('classData', latestClassData);
    }


});
socket.on('classUpdate', (newClassId) => {
    console.log(`The user is currently in the class with id ${newClassId}`);
});

socket.on('classUpdate', (classroomData) => {
    // Forward to connected browsers via our own Socket.IO server
    latestClassData = classroomData;
    ioServer.emit('classData', latestClassData);
    console.log(classroomData);
    db.run('SELECT * FROM Classes WHERE id=?', [classroomData.id], (err, row) => {
        if (err) {
            console.error('Error fetching class data: ', err);
        } else if (!row) {
            db.run('INSERT INTO Classes (id, name, owner, key, permissions) VALUES (?, ?, ?, ?, ?)',
                [
                    classroomData.id,
                    classroomData.className,
                    JSON.stringify(classroomData.students[1].id),
                    classroomData.key,
                    JSON.stringify(classroomData.permissions)
                ],
                (err) => {
                    if (err) {
                        console.error('Error inserting class data: ', err);
                    } else {
                        console.log('Class data inserted successfully');
                    }
                });
        } else {
            db.run('UPDATE Classes SET name=?, owner=?, key=?, permissions=? WHERE id=?',
                [
                    classroomData.className,
                    JSON.stringify(classroomData.students[1].id),
                    classroomData.key,
                    JSON.stringify(classroomData.permissions),
                    classroomData.id
                ],
                (err) => {
                    if (err) {
                        console.error('Error updating class data: ', err);
                    } else {
                        console.log('Class data updated successfully');
                    }
                });
        }
    });
});

socket.on('classData', (pinPollPrompt, pinPollResponses) => {
    console.log('Received classData event');
    console.log('Poll Prompt:', pinPollPrompt);
    console.log('Poll Responses:', pinPollResponses);

    // Update the database or perform any necessary actions
    db.run('UPDATE Polls SET pollPrompt=?, pollResponse=?', [pinPollPrompt, pinPollResponses], (err) => {
        if (err) {
            console.error('Error updating class data:', err);
        } else {
            console.log('Class data updated successfully');
        }
    });

    // Optionally emit the updated data to other clients
    latestClassData = { pinPollPrompt, pinPollResponses };
    ioServer.emit('classData', latestClassData);
});

socket.on('classData', (pinPollPrompt, pinPollResponses) => {
    console.log('Received classData event');
    console.log('Poll Prompt:', pinPollPrompt);
    console.log('Poll Responses:', pinPollResponses);

    // Update the database or perform any necessary actions
    db.run('UPDATE Classes SET pollPrompt=?, pollResponse=?', [pinPollPrompt, pinPollResponses], (err) => {
        if (err) {
            console.error('Error updating class data:', err);
        } else {
            console.log('Class data updated successfully');
        }
    });

    // Optionally emit the updated data to other clients
    latestClassData = { pinPollPrompt, pinPollResponses };
    ioServer.emit('classData', latestClassData);
});

socket.on('connect', () => {
    console.log('Connected');
    socket.emit('getActiveClass');
    socket.emit('classUpdate')
});

let classId = 1; // Class Id here
let classCode = 'rne5' // If you're not already in the classroom, you can join it by using the class code.
socket.emit('joinClass', classId);
socket.on('joinClass', (response) => {
    console.log('joinClass', response);
    // If joining the class is successful, it will return true.
    if (response == true) {
        console.log('Successfully joined class')
        socket.emit('classUpdate')
    } else {
        // If not, try to join the classroom with the class code.
        socket.emit('joinRoom', classCode);
        console.log('Failed to join class: ' + response)
    }
});



socket.on('helloWorld', (data) => {
    console.log(data);
    console.log('hi');
});


app.use(session({
    secret: 'ohnose!',
    resave: false,
    saveUninitialized: false
}))

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

app.get('/', isAuthenticated, (req, res) => {
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

app.post('/pinpoll', isAuthenticated, (req, res) => {
    const pinPollPrompt = req.body.pollPrompt;
    const pinPollResponses = JSON.parse(req.body.pollResponses);

    console.log('Received pinPollPrompt:', pinPollPrompt);
    console.log('Received pinPollResponses:', pinPollResponses);

    // Perform any necessary actions, such as saving to the database
    db.run('INSERT INTO Polls (pollPrompt, pollResponse) VALUES (?, ?)', [pinPollPrompt, JSON.stringify(pinPollResponses)], (err) => {
        if (err) {
            console.error('Error saving poll data:', err);
            return res.status(500).send('Internal Server Error');
        }
        console.log('Poll data saved successfully');
        res.redirect('/Polls'); // Redirect back to the Polls page
    });
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
