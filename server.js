const express = require('express');

const app = express();
const path = require('path');

const session = require("express-session");

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({
    extended: true
}));

// moj kod do kraja


app.use('/styles', express.static(__dirname + '/public/css'));

app.use(session({
    secret: 'FER WiM', 
    resave: false, 
    saveUninitialized: true, 
   }))

const homeRouter = require('./routes/home.routes');
app.use('/', homeRouter);

const logRouter = require('./routes/log.routes');
app.use('/log', logRouter);

// korisnici
app.use(express.json());


   
// kraj 

const PORT = 8080;
app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}!`);
})