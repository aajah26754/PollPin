let express = require('express');
let app = express();
const sqlite3 = require('sqlite3');
const { io } = require('socket.io-client');
const FORMBAR_URL = 'localhost:420'  //'http://172.16.3.159:420/';
const API_KEY = '81bf3b7cb7c2d41a7f34b7e5c29247fe07f4f74b6205efc468064efcf11fee82';
port = 3000;
const socket = io(FORMBAR_URL, {
    auth: {
        token: API_KEY
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

socket.on('connect', () => {
    console.log('Connected');
    socket.emit('getActiveClass');
});

socket.on('classUpdate', (newClassId) => {
    console.log(`The user is currently in the class with id ${newClassId}`);
});

let classId = 1; // Class Id here
let classCode = 'vmnt' // If you're not already in the classroom, you can join it by using the class code.
socket.emit('joinClass', classId);
socket.on('joinClass', (response) => {
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

socket.on('classUpdate', (classroomData) => {
    console.log(classroomData);
});

app.get('/', function (req, res) {
    res.render('Polls');
});

app.listen(port, () => {
    console.log(`Listening on ${port}`)
});