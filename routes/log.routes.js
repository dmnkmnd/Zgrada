var express = require('express');
var router = express.Router();
const pool = require('../infobaza/connect');
/*const usersData = require('../users');*/

router.get('/', async(req, res, next) => {
    if(req.session.login === undefined || req.session.login != true){
        res.status(401).json({ message: 'Invalid credentials' });
    } else {
        let data;
        let asset;
        let susjedi=[];
        
        let najamsusjedi=[];
        let najamni;

        // zahtjevi za prikaz Na = najam, Vl=vlasnik, Un = unio, Od = odobrva
        let zahtjevVlUn = [];
        let zahtjevNaUn = [];
        let zahtjevOd = [];

        try {
            const client = await pool.connect();
            
            try {
                const result = await client.query('SELECT * FROM osoba WHERE email = $1', [req.session.email]);
    
                if (result.rows.length > 0) {
                    data = result.rows[0];

                    // podati o stanovima (najam i vlasnistvo)
                    asset = await client.query('SELECT povrsina, kat, ulica, kucnibr, grad, drzava, iznospricuve, koefpricuve, idnekretnine, idzgrade, brUkucana FROM jevlasnik NATURAL JOIN jedinica NATURAL JOIN zgrada WHERE email=$1', [req.session.email]);
                    najamni = await client.query('SELECT povrsina, kat, ulica, kucnibr, grad, drzava, iznospricuve, koefpricuve, idnekretnine, idzgrade, brUkucana FROM jedinica NATURAL JOIN zgrada NATURAL JOIN jeunajmu WHERE emailnajam = $1', [req.session.email]);

                    // podatci o zahtjevima (koje treba odobriti)
                    zahtjevOd = await client.query( 'SELECT * from ZAHTJEV NATURAL JOIN jeodobren NATURAL JOIN zgrada WHERE email = $1 AND odluka = 0', [req.session.email]);


                    // podatci o susjedima (vlasnika) te podnesenim zahtjevima (uz svaku nekretninu)
                    for (let element of asset.rows) {
                        const susjedResult = await client.query(
                            ` 
                            SELECT vlas.email, ime, prezime
                                FROM JEVLASNIK AS vlas NATURAL JOIN jedinica AS jed NATURAL JOIN osoba
                                WHERE jed.idZgrade = (SELECT idZgrade FROM JEVLASNIK NATURAL JOIN jedinica WHERE idNekretnine= $1 AND email= $2)
                            UNION 
                            SELECT naj.emailnajam, ime, prezime
                                FROM jeUNajmu AS naj NATURAL JOIN jedinica AS jed JOIN osoba ON emailNajam = email
                                WHERE jed.idZgrade = (SELECT idZgrade FROM JEVLASNIK NATURAL JOIN jedinica WHERE idNekretnine= $1 AND email= $2)
                            UNION 
                            SELECT emailGlav, ime, prezime
	                            FROM zgrada JOIN osoba ON emailGlav=email
	                            WHERE zgrada.idZgrade = (SELECT idZgrade FROM JEVLASNIK NATURAL JOIN jedinica WHERE idNekretnine= $1 AND email= $2)
                            `,
                            [element.idnekretnine, req.session.email]
                        );
                        susjedi.push(susjedResult.rows); // spremamo rezultat za svakog susjeda

                        const zahtjev1Result = await client.query( 'SELECT * from ZAHTJEV WHERE idnekretnine = $1 AND aktivan = 1', [element.idnekretnine]);
                        zahtjevVlUn.push(zahtjev1Result.rows);
                        
                    }

                    // podatci o susjedima (najamnika) te podnesenim zahtjevima (uz svaku nekretninu)
                    for (let element of najamni.rows) {
                        const susjedNajamResult = await client.query(
                            ` 
                            SELECT vlas.email, ime, prezime
                                FROM JEVLASNIK AS vlas NATURAL JOIN jedinica AS jed NATURAL JOIN osoba
                                WHERE jed.idZgrade = (SELECT idZgrade FROM JEUNAJMU NATURAL JOIN jedinica WHERE idNekretnine= $1 AND emailnajam= $2)
                            UNION 
                            SELECT naj.emailnajam, ime, prezime
                                FROM jeUNajmu AS naj NATURAL JOIN jedinica AS jed JOIN osoba ON emailNajam = email
                                WHERE jed.idZgrade = (SELECT idZgrade FROM JEUNAJMU NATURAL JOIN jedinica WHERE idNekretnine= $1 AND emailnajam= $2)
                            UNION 
                            SELECT emailGlav, ime, prezime
	                            FROM zgrada JOIN osoba ON emailGlav=email
	                            WHERE zgrada.idZgrade = (SELECT idZgrade FROM JEUNAJMU NATURAL JOIN jedinica WHERE idNekretnine= $1 AND emailnajam= $2)
                            `,
                            [element.idnekretnine, req.session.email]
                        );
                        najamsusjedi.push(susjedNajamResult.rows); // spremamo rezultat za svakog susjeda
                    
                        const zahtjev1Result = await client.query( 'SELECT * from ZAHTJEV WHERE idnekretnine = $1 AND aktivan = 1', [element.idnekretnine]);
                        zahtjevNaUn.push(zahtjev1Result.rows);
                    }

                    // podatci o aktualnim zahtjevima 
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

       

        res.render('home', {
            userData: JSON.stringify(data),
            assetData: JSON.stringify(asset.rows),
            najamData: JSON.stringify(najamni.rows),
            susjediData: JSON.stringify(susjedi),
            susjediNajamData: JSON.stringify(najamsusjedi),

            zahtjevVlUnData : JSON.stringify(zahtjevVlUn),
            zahtjevNaUnData : JSON.stringify(zahtjevNaUn),
            zahtjevOdData: JSON.stringify(zahtjevOd.rows)
        });
    };
});

router.post('/zahtjev', async (req, res, next)  =>  {
    if( req.body.email !== undefined ){
        var idZahtjev;
        let stanari;
    
        try {
            const client = await pool.connect();
            
            try {
                // regularno glasnje 
                if(req.body.email != 'svi'){
                    idZahtjev = await client.query('INSERT INTO zahtjev (zapispocetka, opis,  kratakopis, idNekretnine, emailpodnositelj, idzgrade) VALUES (CURRENT_TIMESTAMP, $1, $2, $3, $4, $5) RETURNING idZahtjeva;',
                    [req.body.opis, req.body.kratakopis, req.body.idnekretnine, req.session.email, req.body.idzgrade]);
                    
                    if(Array.isArray(req.body.email)){
                        for (let jedan of req.body.email) {
                            client.query('INSERT INTO jeodobren (email, idZahtjeva) VALUES ($1,$2);',
                                [jedan, idZahtjev.rows[0].idzahtjeva]);
                                
                        }
                    } else {
                        client.query('INSERT INTO jeodobren (email, idZahtjeva) VALUES ($1,$2);',
                                [req.body.email, idZahtjev.rows[0].idzahtjeva]);
                    }
                } else {
                    // kvadraturno glasnje 

                    idZahtjev = await client.query('INSERT INTO zahtjev (zapispocetka, opis, kratakopis, kvadraturno, emailpodnositelj, idzgrade) VALUES (CURRENT_TIMESTAMP, $1, $2, 1, $3, $4) RETURNING idZahtjeva;',
                        [req.body.opis, req.body.kratakopis, req.session.email, req.body.idzgrade]);

                    stanari = await client.query('SELECT DISTINCT email FROM jeVlasnik NATURAL JOIN jedinica WHERE idZgrade = $1;',
                        [req.body.idzgrade]);
                    
                    for (let jedan of stanari.rows) {
                        client.query('INSERT INTO jeodobren (email, idZahtjeva) VALUES ($1,$2);',
                            [jedan.email, idZahtjev.rows[0].idzahtjeva]);                     
                    }
                }
                
            } finally {
                client.release();  // Vraća konekciju nazad u pool
            }
        } catch (err) {
            console.error(err);
            res.status(500).send("Greška u bazi podataka.");
        }

        res.redirect(req.get('referer'));

    } else {
        res.status(401).json({ message: 'Niste stavili bar jednu uključenu osobu, vratite se natrag znakom na traci!' });
    }

});

router.get('/userInfo', async(req, res, next) => {
    if(req.session.login === undefined || req.session.login != true){
        res.status(401).json({ message: 'Invalid credentials' });
    } else {

        let personal;

        try {
            const client = await pool.connect();
            
            try {
                const result = await client.query('SELECT * FROM osoba WHERE email = $1', [req.session.email]);
    
                if (result.rows.length > 0) {
                    //podatci o korisniku
                    personal = result.rows[0];

                } else {
                    console.log("Podatci za trazenu osobu (email) nisu pronadjeni");
                }
            } finally {
                client.release();  // Vraća konekciju nazad u pool
            }
        } catch (err) {
            console.error(err);
            res.status(500).send("Greška u bazi podataka.");
        }
        

        res.render('personal', {
            userData: JSON.stringify(personal)
        });

    }
});

router.post('/promjena', async (req, res, next)  =>  {
        try {
            const client = await pool.connect();
            
            try {
                client.query('UPDATE osoba SET (ulica, kucnibr, grad, drzava, ime, prezime, brtelefon) = ($1, $2, $3, $4, $5, $6, $7) WHERE email=$8;',
                    [req.body.ulica, req.body.kucnibr, req.body.grad, req.body.drzava, req.body.ime, req.body.prezime, req.body.brtelefon, req.session.email]);
            } finally {
                client.release();  // Vraća konekciju nazad u pool
            }
        } catch (err) {
            console.error(err);
            res.status(500).send("Greška u bazi podataka.");
        }
        res.redirect('/log/userInfo');
});

router.post('/odluka', async (req, res, next)  =>  {

    if(req.body.odluka!==undefined){
        try {
            const client = await pool.connect();
            
            try {
                client.query('UPDATE jeodobren SET odluka = $1 WHERE email = $2 AND idzahtjeva = $3 ', [req.body.odluka, req.session.email, req.body.idzahtjeva]);
            } finally {
                client.release();  // Vraća konekciju nazad u pool
            }
        } catch (err) {
            console.error(err);
            res.status(500).send("Greška u bazi podataka.");
        }
    }
    res.redirect('/log');
   
});


router.get('/sviZahtjeviPrikaz', async(req, res, next) => {
    var zadao;
    var zadali;

    try {
        const client = await pool.connect();
        
        try {
            zadao = await client.query('SELECT * FROM ZAHTJEV NATURAL LEFT JOIN jedinica NATURAL JOIN zgrada where emailPodnositelj = $1 ORDER BY zapisPocetka DESC', [ req.session.email]);
            zadali = await client.query('SELECT * FROM zahtjev NATURAL JOIN jeodobren NATURAL LEFT JOIN jedinica NATURAL JOIN zgrada WHERE email = $1 ORDER BY zapispocetka DESC', [req.session.email]);
            
        } finally {
            client.release();  // Vraća konekciju nazad u pool
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška u bazi podataka.");
    }

    res.render('zahtjevi', {
        zadaoData: JSON.stringify(zadao.rows),
        zadaliData: JSON.stringify(zadali.rows)
    });

});

router.get('/upravitelj', async(req, res, next) => {
    var podUpravom;
    var stanariVlas = [];
    var zahtjevi = [];
    var stanariNajam = [];
    
    try {
        const client = await pool.connect();
        
        try {
            podUpravom = await client.query('SELECT * FROM zgrada WHERE emailglav = $1', [ req.session.email]);
            
        } finally {
            client.release();  // Vraća konekciju nazad u pool
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška u bazi podataka.");
    }

        try {
            const client = await pool.connect();
            
            try {
                for (let element of podUpravom.rows) {
                    var stanariVlasTren = await client.query('SELECT * FROM zgrada NATURAL JOIN jedinica NATURAL JOIN jeVlasnik WHERE emailglav=$1 AND idZgrade=$2 ORDER BY kat ASC', [req.session.email, element.idzgrade]);
                    var stanariNajamTren = await client.query('SELECT * FROM zgrada NATURAL JOIN jedinica NATURAL JOIN jeUNajmu WHERE emailglav=$1 AND idZgrade=$2 ORDER BY kat ASC', [req.session.email, element.idzgrade]);
                    var zahtjeviTren = await client.query('SELECT * FROM zahtjev WHERE aktivan=$1 AND idZgrade=$2 ORDER BY zapisPocetka DESC', [ 1, element.idzgrade]);
                    
                    zahtjevi.push(zahtjeviTren.rows);
                    stanariVlas.push(stanariVlasTren.rows);
                    stanariNajam.push(stanariNajamTren.rows);
                }
            } finally {
                client.release();  // Vraća konekciju nazad u pool
            }

        } catch (err) {
            console.error(err);
            res.status(500).send("Greška u bazi podataka.");
        }
    
    res.render('upravitelj', {
        podUpravomData: JSON.stringify(podUpravom.rows),
        stanariVlasData: JSON.stringify(stanariVlas),
        stanariNajamData: JSON.stringify(stanariNajam),
        zahtjeviData: JSON.stringify(zahtjevi)
    });
});

router.post('/zgradaPodatci', async (req, res, next)  =>  {
    var ok= false;
    if(req.session.email == req.body.emailProv ){
        try {

            const client = await pool.connect();
            
            try {
                var tren = await client.query('SELECT * FROM osoba WHERE email = $1  ', [req.body.emailglav]);
                console.log(tren.rows.length);
                if(tren.rows.length == 1){
                    ok = true;
                    await client.query('UPDATE zgrada SET (emailglav, iznospricuve) = ($1, $2) WHERE idzgrade = $3 ', [req.body.emailglav, parseFloat(req.body.iznospricuve), req.body.idzgrade]);
                } else {
                    res.status(401).json({ message: 'Navedeni, vratite se natrag znakom na traci!' });
                }
                
            } finally {
                client.release();  // Vraća konekciju nazad u pool
            }

        } catch (err) {
            console.error(err);
            res.status(500).send("Greška u bazi podataka.");
        }
    }
    if(ok==true){
        res.redirect('/log/upravitelj');
    }
});

router.post('/novaJedinica', async (req, res, next)  =>  {
    var ok = 0;
    var i = 0;
    var idnekretnine;
    if(req.session.email == req.body.emailProv ){
        try {
            
            const client = await pool.connect();
            
            try {
                if(Array.isArray(req.body.email)){
                    for (let element of req.body.email) {
                        var tren = await client.query('SELECT * FROM osoba WHERE email = $1  ', [element]);

                        if(tren.rows.length != 1){
                            ok = ok+1;
                        }
                    }   
                } else {
                    var tren = await client.query('SELECT * FROM osoba WHERE email = $1  ', [req.body.email]);

                    if(tren.rows.length != 1){
                        ok = ok+1;
                    }
                }
                
                if(ok == 0){
                    idnekretnine = await client.query('INSERT INTO jedinica (povrsina, kat, koefPricuve, nacinKoristenja, idZgrade, brukucana) VALUES ($1, $2, $3, $4, $5, $6) RETURNING idnekretnine',
                        [req.body.povrsina, req.body.kat, req.body.koefpricuve, req.body.nacinkoristenja, req.body.idzgrade, req.body.brukucana]);

                    if(Array.isArray(req.body.email)){
                        for (let element of req.body.email) {
                            await client.query('INSERT INTO jevlasnik (email, idnekretnine, udio) VALUES ($1, $2, $3); ', [element, idnekretnine.rows[0].idnekretnine, req.body.udio[i]]);
                            i++;
                        }   
                    } else {
                        await client.query('INSERT INTO jevlasnik (email, idnekretnine, udio) VALUES ($1, $2, $3); ', [req.body.email, idnekretnine.rows[0].idnekretnine, req.body.udio]);
                    }

                } else {
                    res.status(401).json({ message: ' Jedan od mavedenih email-a nije unesen u sustav, vratite se natrag znakom na traci!' });
                }

            } finally {
                client.release();  // Vraća konekciju nazad u pool
            }

        } catch (err) {
            console.error(err);
            res.status(500).send("Greška u bazi podataka.");
        }
    }
    if(ok==0){
        res.redirect('/log/upravitelj');
    }
});

router.post('/upravljanjeNajmom', async (req, res, next)  =>  {
    var nekretnina;
    var najmoprimci;

        try {
            const client = await pool.connect();
            
            try {
                nekretnina = await client.query('SELECT * FROM jedinica NATURAL JOIN jevlasnik NATURAL JOIN zgrada WHERE idnekretnine = $1 AND email = $2', [req.body.idnekretnine, req.session.email]);
                najmoprimci = await client.query('SELECT * FROM jeunajmu JOIN osoba ON emailnajam=email WHERE idnekretnine = $1  ', [req.body.idnekretnine]);
              
            } finally {
                client.release();  // Vraća konekciju nazad u pool
            }

        } catch (err) {
            console.error(err);
            res.status(500).send("Greška u bazi podataka.");
        }

        res.render('opcije', {
            nekretninaData: JSON.stringify(nekretnina.rows),
            najmoprimciData: JSON.stringify(najmoprimci.rows)
        });
       
});

router.post('/otkaziNajam', async (req, res, next)  =>  {
    
    try {
        const client = await pool.connect();
            
        try {
            if(req.body.udio >= 0.5){
                await client.query('DELETE FROM jeUNajmu WHERE idnekretnine = $1  ', [req.body.idnekretnine]);
            
            } else {
                var ostali = await client.query('SELECT email FROM jevlasnik WHERE idnekretnine = $1', [req.body.idnekretnine]);
                var idZahtjev = await client.query('INSERT INTO zahtjev (zapispocetka, opis,  kratakopis, idNekretnine, emailpodnositelj, idzgrade, kvadraturno) VALUES (CURRENT_TIMESTAMP, $1, $2, $3, $4, $5, 2) RETURNING idZahtjeva;',
                    ['Glasanje o prekidu najma nad navedenom jedinicom. Automatski generiran opis (ZGRADA(c))', 'Prekid-Najama[SUSTAV]', req.body.idnekretnine, req.session.email, req.body.idzgrade]);
                
                for (let jedan of ostali.rows) {
                    client.query('INSERT INTO jeodobren (email, idZahtjeva) VALUES ($1,$2);',
                        [jedan.email, idZahtjev.rows[0].idzahtjeva]);
                }
            }

        } finally {
            client.release();  // Vraća konekciju nazad u pool
        }

    } catch (err) {
        console.error(err);
        res.status(500).send("Greška u bazi podataka.");
    }

    res.send(`
        <html>
            <body>
                <form id="redirectForm" action="/log/upravljanjeNajmom" method="POST">
                    <input type="hidden" name="idnekretnine" value="${req.body.idnekretnine}">
                </form>
                <script type="text/javascript">
                    document.getElementById('redirectForm').submit();
                </script>
            </body>
        </html>
    `);
});


router.post('/dodajNajam', async (req, res, next)  =>  {
    
    try {
        const client = await pool.connect();
            
        try {
            if(req.body.udio >= 0.5){
                await client.query('INSERT INTO jeUnajmu (emailnajam, idnekretnine) VALUES ($1, $2)', [req.body.emailnajam, req.body.idnekretnine]);
                var idZahtjev = await client.query('INSERT INTO zahtjev (zapispocetka, opis,  kratakopis, idNekretnine, emailpodnositelj, idzgrade, kvadraturno) VALUES (CURRENT_TIMESTAMP, $1, $2, $3, $4, $5, -1) RETURNING idZahtjeva;',
                    ['Potvrda o promjeni broja stanara na:' + req.body.brukucana + '. Automatski generiran opis (ZGRADA(c))', 'br_stanara[SUSTAV]'+ req.body.brukucana, req.body.idnekretnine, req.session.email, req.body.idzgrade]);
                await client.query('INSERT INTO jeodobren (email, idZahtjeva) VALUES ($1,$2);',
                    [req.body.emailglav, idZahtjev.rows[0].idzahtjeva]);

            } else {
                var ostali = await client.query('SELECT email FROM jevlasnik WHERE idnekretnine = $1', [req.body.idnekretnine]);
                var idZahtjev = await client.query('INSERT INTO zahtjev (zapispocetka, opis,  kratakopis, idNekretnine, emailpodnositelj, idzgrade, kvadraturno) VALUES (CURRENT_TIMESTAMP, $1, $2, $3, $4, $5, 3) RETURNING idZahtjeva;',
                    ['Glasanje o početku najma nad navedenom jedinicom osobi:' + req.body.emailnajam + '. Automatski generiran opis (ZGRADA(c))', 'Pocetak-Najama[SUSTAV]', req.body.idnekretnine, req.body.emailnajam, req.body.idzgrade]);
                
                for (let jedan of ostali.rows) {
                    client.query('INSERT INTO jeodobren (email, idZahtjeva) VALUES ($1,$2);',
                        [jedan.email, idZahtjev.rows[0].idzahtjeva]);
                }

                var idZahtjev = await client.query('INSERT INTO zahtjev (zapispocetka, opis,  kratakopis, idNekretnine, emailpodnositelj, idzgrade, kvadraturno) VALUES (CURRENT_TIMESTAMP, $1, $2, $3, $4, $5, -1) RETURNING idZahtjeva;',
                    ['Potvrda o promjeni broja stanara na:' + req.body.brukucana + '. Automatski generiran opis (ZGRADA(c))', 'br_stanara[SUSTAV]'+ req.body.brukucana, req.body.idnekretnine, req.session.email, req.body.idzgrade]);
                await client.query('INSERT INTO jeodobren (email, idZahtjeva) VALUES ($1,$2);',
                    [req.body.emailglav, idZahtjev.rows[0].idzahtjeva]);

            }

        } finally {
            client.release();  // Vraća konekciju nazad u pool
        }

    } catch (err) {
        console.error(err);
        res.status(500).send("Greška u bazi podataka.");
    }

    res.send(`
        <html>
            <body>
                <form id="redirectForm" action="/log/upravljanjeNajmom" method="POST">
                    <input type="hidden" name="idnekretnine" value="${req.body.idnekretnine}">
                </form>
                <script type="text/javascript">
                    document.getElementById('redirectForm').submit();
                </script>
            </body>
        </html>
    `);
});


router.post('/promjenaBrStanara', async (req, res, next)  =>  {
    try {
        const client = await pool.connect();
            
        try {
            var idZahtjev = await client.query('INSERT INTO zahtjev (zapispocetka, opis,  kratakopis, idNekretnine, emailpodnositelj, idzgrade, kvadraturno) VALUES (CURRENT_TIMESTAMP, $1, $2, $3, $4, $5, -1) RETURNING idZahtjeva;',
                ['Potvrda o promjeni broja stanara na:' + req.body.brukucana + '. Automatski generiran opis (ZGRADA(c))', 'br_stanara[SUSTAV]'+ req.body.brukucana, req.body.idnekretnine, req.session.email, req.body.idzgrade]);
            await client.query('INSERT INTO jeodobren (email, idZahtjeva) VALUES ($1,$2);',
                [req.body.emailglav, idZahtjev.rows[0].idzahtjeva]);
        } finally {
            client.release();  // Vraća konekciju nazad u pool
        }

    } catch (err) {
        console.error(err);
        res.status(500).send("Greška u bazi podataka.");
    }

    res.send(`
        <html>
            <body>
                <form id="redirectForm" action="/log/upravljanjeNajmom" method="POST">
                    <input type="hidden" name="idnekretnine" value="${req.body.idnekretnine}">
                </form>
                <script type="text/javascript">
                    document.getElementById('redirectForm').submit();
                </script>
            </body>
        </html>
    `);
});


router.post('/promjenaVlasnika', async (req, res, next)  =>  {
    try {
        const client = await pool.connect();
            
        try {
            var idZahtjev = await client.query('INSERT INTO zahtjev (zapispocetka, opis,  kratakopis, idNekretnine, emailpodnositelj, idzgrade, kvadraturno) VALUES (CURRENT_TIMESTAMP, $1, $2, $3, $4, $5, -2) RETURNING idZahtjeva;',
                ['Potvrda o promjeni (udjela) vlasništva nad nekrtninom id-a: ' + req.body.idnekretnine + ' iz vlasništva ' + req.session.email + ' u vlasništvo ' + req.body.emailnovi +'. Automatski generiran opis (ZGRADA(c))', 
                 req.body.emailnovi, req.body.idnekretnine, req.session.email, req.body.idzgrade]);
            await client.query('INSERT INTO jeodobren (email, idZahtjeva) VALUES ($1,$2);',
                [req.body.emailglav, idZahtjev.rows[0].idzahtjeva]);

        } finally {
            client.release();  // Vraća konekciju nazad u pool
        }

    } catch (err) {
        console.error(err);
        res.status(500).send("Greška u bazi podataka.");
    }

    res.send(`
        <html>
            <body>
                <form id="redirectForm" action="/log/upravljanjeNajmom" method="POST">
                    <input type="hidden" name="idnekretnine" value="${req.body.idnekretnine}">
                </form>
                <script type="text/javascript">
                    document.getElementById('redirectForm').submit();
                </script>
            </body>
        </html>
    `);
});

router.get('/tvrtkaUpravitelj', async (req, res, next)  =>  {
    var zgrade;
    var stanovi = [];
    var predstavnik = [];
    var firma;

    try {
        const client = await pool.connect();
            
        try {
            zgrade = await client.query('SELECT * FROM zgrada NATURAL JOIN jezaposlen WHERE email = $1', [req.session.email]);
            firma = await client.query('SELECT * FROM tvrtkaupravitelj NATURAL JOIN jezaposlen WHERE email = $1', [req.session.email]);


            for (let element of zgrade.rows) {
                var uno = await client.query('SELECT jedinica.*, jevlasnik.* FROM jedinica NATURAL JOIN zgrada NATURAL JOIN jevlasnik WHERE idzgrade = $1', [element.idzgrade]);
                var duo = await client.query('SELECT * FROM osoba WHERE email = $1', [element.emailglav]);
                stanovi.push(uno.rows);
                predstavnik.push(duo.rows);
            }

        } finally {
            client.release();  // Vraća konekciju nazad u pool
        }

    } catch (err) {
        console.error(err);
        res.status(500).send("Greška u bazi podataka.");
    }
    

    res.render('tvrtka', {
        zgradeData: JSON.stringify(zgrade.rows),
        stanoviData:  JSON.stringify(stanovi),
        predstavnikData:  JSON.stringify(predstavnik),
        firmaData: JSON.stringify(firma.rows)
    });

});

/* podatci za tvrtku koja upravlja nekretninom (predstavnika stanara*/

router.post('/tvr/zgradaPodatci', async (req, res, next)  =>  {
    try {
        const client = await pool.connect();
            
        try {
            await client.query('UPDATE zgrada SET (namjena, iznosPricuve, eMailGlav, ulica, kucniBr, grad, drzava) = ($1, $2, $3, $4, $5, $6, $7) WHERE idZgrade =$8', 
                [req.body.namjena, req.body.iznospricuve, req.body.emailglav, req.body.ulica, req.body.kucnibr, req.body.grad, req.body.drzava, req.body.idzgrade]);

        } finally {
            client.release();  // Vraća konekciju nazad u pool
        }

    } catch (err) {
        console.error(err);
        res.status(500).send("Greška u bazi podataka.");
    }

    res.redirect('/log/tvrtkaUpravitelj')

  
});

router.post('/tvr/zahtjev', async (req, res, next)  =>  {
    try {
        const client = await pool.connect();
        
        try {
            // regularno glasnje 
            if(req.body.email != 'svi'){
                idZahtjev = await client.query('INSERT INTO zahtjev (zapispocetka, opis,  kratakopis, idNekretnine, emailpodnositelj, idzgrade) VALUES (CURRENT_TIMESTAMP, $1, $2, $3, $4, $5) RETURNING idZahtjeva;',
                [req.body.opis, req.body.kratakopis, req.body.idnekretnine, req.body.email, req.body.idzgrade]);
                
                if(Array.isArray(req.body.email)){
                    for (let jedan of req.body.email) {
                        client.query('INSERT INTO jeodobren (email, idZahtjeva) VALUES ($1,$2);',
                            [jedan, idZahtjev.rows[0].idzahtjeva]);
                            
                    }
                } else {
                    client.query('INSERT INTO jeodobren (email, idZahtjeva) VALUES ($1,$2);',
                            [req.body.email, idZahtjev.rows[0].idzahtjeva]);
                }
            } else {
                // kvadraturno glasnje 

                idZahtjev = await client.query('INSERT INTO zahtjev (zapispocetka, opis, kratakopis, kvadraturno, emailpodnositelj, idzgrade) VALUES (CURRENT_TIMESTAMP, $1, $2, 1, $3, $4) RETURNING idZahtjeva;',
                    [req.body.opis, req.body.kratakopis, req.session.email, req.body.idzgrade]);

                stanari = await client.query('SELECT DISTINCT email FROM jeVlasnik NATURAL JOIN jedinica WHERE idZgrade = $1;',
                    [req.body.idzgrade]);
                
                for (let jedan of stanari.rows) {
                    client.query('INSERT INTO jeodobren (email, idZahtjeva) VALUES ($1,$2);',
                        [jedan.email, idZahtjev.rows[0].idzahtjeva]);                     
                }
            }
            
        } finally {
            client.release();  // Vraća konekciju nazad u pool
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Greška u bazi podataka.");
    }

    res.redirect('/log/tvrtkaUpravitelj')

  
});



module.exports = router;