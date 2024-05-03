const express=require('express');
const jwt=require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config();
const app=express();
const PORT=process.env.PORT || 3000;
app.use(express.static('static'));
app.use(cookieParser());
app.use(express.json());

function getUsers() {
    return new Promise((resolve, reject) => {
        let users = [];
        fs.createReadStream('users.csv')
            .pipe(csv())
            .on('data', (row) => {
                users.push(row);
            })
            .on('end', () => {
                resolve(users);
            })
            .on('error', reject);
    });
}

app.post('/api/auth/signup',async (req, res) => {
    const { email, password } = req.body;
    const users = await getUsers();
    const user = users.find(u => u.email === email);
    if (user) {
        return res.status(400).send({ status: -1, message: 'User already exists' });
    }
    const maxId = Math.max(...users.map(u => parseInt(u.id)), 0);
    const newUser = { id: maxId + 1, email, password };
    fs.appendFileSync('users.csv', `\n${newUser.id},${newUser.email},${newUser.password}`);
    const token = jwt.sign({ id: newUser.id, email: newUser.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.cookie('token', 'Bearer ' + token, { httpOnly: true, secure: true });
    res.json({ status: 1, jwt: token });
});
app.post('/api/auth/signin',async (req, res) => {
    const { email, password } = req.body;
	const users = await getUsers();
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.cookie('token', 'Bearer ' + token, { httpOnly: true, secure: true });
        res.json({ status: 1, jwt: token });
    } else {
        res.status(401).send({ status: -1, jwt: 'Invalid credentials' });
    }
});

app.get('/api/auth/signout', (req, res) => {
    res.clearCookie('token');
    res.json({ status: 1, message: 'User signed out' });
});

app.get('/api/auth/signin', (req, res) => {
    res.sendFile(__dirname + '/static/auth/signin.html');
});

app.get('/',(req, res) => {
	const bearerHeader = req.headers['authorization'];
	console.log(bearerHeader);
	if(!bearerHeader){
		const token = req.cookies.token;
		console.log(token);
	}
	res.send('Welcome to our website');
});

app.get('/members', verifyToken, (req, res) => {
	res.send('Welcome to the members\' area of our website');
});

app.get('/profile', verifyToken, (req, res) => {
	const user = users.find(u => u.id === req.user.id);
	if (user) {
		res.json({ id: user.id, username: user.username });
	} else {
		res.status(404).send('User not found');
	}
});

function verifyToken(req, res, next) {
	let bearerHeader = req.headers['authorization'];
	if(!bearerHeader){
		bearerHeader= req.cookies.token;
	}
	if (typeof bearerHeader !== 'undefined') {
		const bearerToken = bearerHeader.split(' ')[1];
		jwt.verify(bearerToken, process.env.JWT_SECRET, (err, authData) => {
			if (err) {
				res.sendStatus(403);
			} else {
				req.user = authData;
				next();
			}
		});
	} else {
		res.sendStatus(403);
	}
}


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
