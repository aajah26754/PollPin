const jwt = require('jsonwebtoken')
const express = require('express')
const app = express()
const session = require('express-session')

const FBJS_URL = 'https://formbeta.yorktechapps.com'
const THIS_URL = 'http://localhost:3000/login'
const API_KEY = '12a6ddb410d96fa83a0177b9aef0ed00c73acd80fb3e02602cbdc19057af88d4b0ca51165f96ba7a84bd8e495646213ec3a7b341798a6164dcc1561e93477f28'

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
	console.log(req.query.token)
	if (req.query.token) {
		req.session.rawToken = req.query.token;  
		let tokenData = jwt.decode(req.query.token);
		req.session.token = tokenData;
		req.session.user = tokenData.displayName;
		res.redirect('/');
	  }
	  
	else {
		res.redirect(`${FBJS_URL}/oauth?redirectURL=${THIS_URL}`)
	}
})

app.get('/', isAuthenticated, async (req, res) => {
	console.log("Root")
  
	try {
	  const response = await fetch(`${FBJS_URL}/api/me`, {
		method: 'GET',
		headers: {
		  'API': API_KEY,
		  'Authorization': `Bearer ${req.query.token || req.session.rawToken}`, 
		  'Content-Type': 'application/json'
		}
	  });
  
	  const data = await response.json();
	  res.send(data);
  
	} catch (error) {
	  res.send(error.message);
	}
  });
  

app.listen(3000, () => {
	console.log('running on http://localhost:3000')
})