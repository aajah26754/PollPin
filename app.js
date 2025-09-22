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
[] Send user permissions, formbar_id, and username from classroomData to Polls.ejs (so it can be used for the db)
[] Make a page that displays the relevant data for the current class and polls via websockets
[] Only users with the correct permissions can create polls
*/

let express = require('express');
let app = express();
const { io } = require('socket.io-client');
const FORMBAR_URL = 'http://localhost:420'  //'http://formbeta.yorktechapps.com';
const API_KEY = 'aa3663be018501ad55c4c1c6ef1ca0073704586be7f11c74849daf3fed035f6d'; // Your API key here

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

