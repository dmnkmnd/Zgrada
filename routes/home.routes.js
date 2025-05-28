var express = require('express');
var router = express.Router();
const pool = require('../infobaza/connect');


router.get('/', function(req, res, next){
    if(req.session.color === undefined || req.session.color != "red"){
        res.render('pocetni', {
            see: "ne"
        });
    } else {
        req.session.color = "green";
        res.render('pocetni', {
            see: "da"
        });
    };
});

router.get('/newuser', function(req, res, next){
    if (req.session.taken === undefined || req.session.taken=="false" ){
        res.render('newuser', {
            see: "ne"
        });
    } else {
        res.render('newuser', {
            see: "da"
        });
    }
});

router.get('/logoff', function(req, res, next){
    req.session.color = "green";
    req.session.login = "false";
    res.redirect("/");
});


router.get('/forgotten', function(req, res, next){
    res.render('forgotten', {
        
    });
});


router.post('/login', async (req, res, next)  =>  {
    let pass;

    try {
        const client = await pool.connect();
        
        try {
            const result = await client.query('SELECT password FROM osoba WHERE email = $1', [req.body.email]);
            
            if (result.rows.length > 0) {
                pass = result.rows[0].password;
            } else {
                console.log("Email nije pronađen.");
            }
        } finally {
            client.release();  // Vraća konekciju nazad u pool
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška u bazi podataka.");
    }
    
    if (req.body.password == pass) {
        
        if(req.session.login === undefined){
            req.session.login = true;
            req.session.email = req.body.email;
        } else {
            req.session.login = true;
            req.session.email = req.body.email;
        };

        res.redirect('/log');

    } else {
        req.session.login = false;
        req.session.color = "red";
        res.redirect('/');
    }
});



// SignUp
router.post('/signup', async (req, res, next)  =>  {
    var uredno=false;
    try {
        const client = await pool.connect();
        
        try {
            const result = await client.query('SELECT password FROM osoba WHERE email = $1', [req.body.email]);
            
            if (result.rows.length > 0) {
                console.log("Email već unesen u sutav.");

            } else {
                client.query('INSERT INTO osoba (ulica, kucnibr, grad, drzava, email, ime, prezime, brtelefon, password) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);',
                    [req.body.ulica, req.body.kucniBr, req.body.grad, req.body.drzava, req.body.email, req.body.ime, req.body.prezime, req.body.brTelefon, req.body.password ]);
                uredno = true;
            } 
        } finally {
            client.release();  // Vraća konekciju nazad u pool
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška u bazi podataka.");
    }

    if(uredno!=true){
        req.session.taken = "true";
        res.redirect('/newuser');
    } else {
        req.session.taken = "false";
        res.redirect('/');
    }
});


module.exports = router;

