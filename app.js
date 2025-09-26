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

/* TODO:
[X] Send user permissions, formbar_id, and username from classroomData to Polls.ejs (so it can be used for the db)
[X] Make a page that displays the relevant data for the current class and polls via websockets
[] Only users with the correct permissions can create polls
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

const FBJS_URL = 'https://formbeta.yorktechapps.com'
const THIS_URL = 'http://localhost:3000/login'
const AUTH_URL = 'https://formbeta.yorktechapps.com/oauth' 


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

ioServer.on('connection', (browserSocket) => {
    console.log('Browser connected to PollPin socket');
    browserSocket.emit('serverAlive', { ok: true, ts: Date.now() });
    if (latestClassData) {
        browserSocket.emit('classData', latestClassData);
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

app.use(session({
    secret: 'ohnose!',
    resave: false,
    saveUninitialized: false
}))

function isAuthenticated(req, res, next) {
    console.log("Checking Auth")
    if (req.session.user) next()
    else res.redirect(`/login?redirectURL=${THIS_URL}`)
}


app.get('/login', (req, res) => {
    if (req.query.token) {
        let tokenData = jwt.decode(req.query.token)
        req.session.token = tokenData
        req.session.user = tokenData.displayName
        res.redirect('/')
        db.get('SELECT * FROM users WHERE fb_name=?', req.session.user, (err, row) => {
            if (err) {
                console.log(err)
                res.send("There big bad error:\n" + err)
            } else if (!row) {
                db.run('INSERT INTO users(fb_name, fb_id, permissions) VALUES(?, ?, ?);', [req.session.user, tokenData.id, tokenData.permissions], (err) => {
                    if (err) {
                        console.log(err)
                        res.send("Database error:\n" + err)
                    }
                });
            }
        });
    } else {
        // If not logged in, redirect to OAuth provider
        if (!req.session.user) {
            return res.redirect(`${AUTH_URL}?redirectURL=${THIS_URL}`);
        }
        // Otherwise, show the user value for debugging
        console.log(req.session.user)
        res.redirect('/')
    }
});

app.get('/', (req, res) => {
    res.render('index');
})

app.get('/Polls', isAuthenticated, (req, res) => {
    try {
        res.render('Polls', { user: req.session.user })
        console.log(req.session.user)

    } catch (error) {
        console.error('Error rendering Polls page: ', error)
    }
});

app.get('/profile', isAuthenticated, (req, res) => {
    db.get('SELECT * FROM users WHERE fb_name=?', req.session.user, (err, user) => {
        if (err) {
            console.error('Error fetching user data: ', err);
            return res.status(500).send('Internal Server Error');
        } else {
            console.log('User data fetched successfully: ', user);
        }

        res.render('profile', { user });
    });
});

http.listen(port, () => {
    console.log(`Listening on ${port}`)
});
