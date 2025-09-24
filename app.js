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

let express = require('express');
let app = express();

const http = require('http').createServer(app);
const sqlite3 = require('sqlite3');
const { Server } = require('socket.io');
const ioServer = new Server(http);
const { io } = require('socket.io-client');
const FORMBAR_URL = 'http://localhost:420'  //'http://formbeta.yorktechapps.com';
const API_KEY = '746ed7eea135dc837a60171b2c8cd4c5c6b14fd4fd5935d99808996150671dae'; // PUT YOUR API KEY HERE FOR IT TO WORK
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

app.get('/', function (req, res) {
    res.render('Polls');
});


http.listen(port, () => {
    console.log(`Listening on ${port}`)
});

