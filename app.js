let express = require('express');
let app = express();
const { io } = require('socket.io-client');
const FORMBAR_URL = 'http://localhost:420'  //'http://172.16.3.159:420/';
const API_KEY = 'aa3663be018501ad55c4c1c6ef1ca0073704586be7f11c74849daf3fed035f6d';

const socket = io(FORMBAR_URL, {
    extraHeaders: {
        api: API_KEY
    }
});

app.set('view engine', 'ejs');

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

app.listen(3000);