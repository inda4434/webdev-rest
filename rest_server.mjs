import * as path from 'node:path';
import * as url from 'node:url';

import { default as express } from 'express';
import { default as sqlite3 } from 'sqlite3';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const db_filename = path.join(__dirname, 'db', 'stpaul_crime.sqlite3');

const port = 8000;

let app = express();
app.use(express.json());

/********************************************************************
 ***   DATABASE FUNCTIONS                                         *** 
 ********************************************************************/
// Open SQLite3 database (in read-write mode)
let db = new sqlite3.Database(db_filename, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.log('Error opening ' + path.basename(db_filename));
    }
    else {
        console.log('Now connected to ' + path.basename(db_filename));
    }
});

// Create Promise for SQLite3 database SELECT query 
function dbSelect(query, params) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows);
            }
        });
    });
}

// Create Promise for SQLite3 database INSERT or DELETE query
function dbRun(query, params) {
    return new Promise((resolve, reject) => {
        db.run(query, params, (err) => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

/********************************************************************
 ***   REST REQUEST HANDLERS                                      *** 
 ********************************************************************/
// GET request handler for crime codes
app.get('/codes', (req, res) => {
    console.log(req.query); // query object (key-value pairs after the ? in the url)
    let query = "SELECT * FROM CODES";
    if (req.query.code) {
        query += " WHERE code IN (" + req.query.code + ")";
    }

    dbSelect(query).then((result) => {
        console.log(result);
        res.status(200).type('json').send({result}); // <-- you will need to change this
    });
});

// GET request handler for neighborhoods
app.get('/neighborhoods', (req, res) => {
    console.log(req.query); // query object (key-value pairs after the ? in the url)
    let query = "SELECT * FROM NEIGHBORHOODS"
    if (req.query.id) {
        query += " WHERE neighborhood_number IN (" + req.query.id + ")";
    }
    dbSelect(query).then((result) => {
        console.log(result);
        res.status(200).type('json').send({result}); // <-- you will need to change this
    });
});

// GET request handler for crime incidents
app.get('/incidents', (req, res) => {
    console.log(req.query); // query object (key-value pairs after the ? in the url)
    
    let query = 'SELECT case_number, strftime("%Y-%m-%d", date_time) AS date , strftime("%H:%M:%S", date_time) AS time, code, incident, police_grid, neighborhood_number, block FROM Incidents';
    let i = []; // incidents list
    let c = []; // count

    // add start_date - first date to include in results
    if (req.query.hasOwnProperty('start_date')) {
        query += ' WHERE date_time >= "' + req.query.start_date +'" ';
        c.push('1');
    }
    // add end_date - last date to include in results
    if (req.query.hasOwnProperty('end_date')) {
        if (c.length === 0) {
            query += ' WHERE date_time =< "' + req.query.end_date +'"';
        } 
        else {
            query += ' AND date_time =< "' + req.query.end_date +'"';
        }
        c.push('1');
    }
    // code - comma separated list of codes
    if (req.query.hasOwnProperty('code')) {
        if (c.length === 0) {
            query += ' WHERE code IN (' + req.query.code +')';
        } 
        else {
            query += ' AND code IN (' + req.query.code +')';
        }
        c.push('1');
    }
    // grid - comma separated list of grids
    if (req.query.hasOwnProperty('grid')) {
        if (c.length === 0) {
            query += ' WHERE police_grid IN (' + req.query.grid +')';
        } 
        else {
            query += ' AND police_grid IN (' + req.query.grid +')';
        }
        c.push('1');
    }
    // neighborhood - comma separated list of neighborhood numbers
    if (req.query.hasOwnProperty('neighborhood')) {
        if (c.length === 0) {
            query += ' WHERE neighborhood_number IN (' + req.query.neighborhood +')';
        } 
        else {
            query += ' AND neighborhood_number IN (' + req.query.neighborhood +')';
        }
        c.push('1');
    }
    // limit - max num of incidents, default 1000
    if (req.query.hasOwnProperty('limit')) {
        query += ' ORDER BY date_time DESC LIMIT ' + req.query.limit; 
    } else {
        query += ' ORDER BY date_time DESC LIMIT 1000' // default limit
    }

    console.log(query);
    dbSelect(query, i)
    .then ((rows) => {
        res.status(200).type('json').send(rows);
    })
    .catch((error) => {
        res.status(500).type('txt').send(error);
    })
});

// PUT request handler for new crime incident
app.put('/new-incident', (req, res) => {
    const incidentData = req.body;
    const queryCheckDuplicate = 'SELECT * FROM incidents WHERE case_number = ?';
    const paramsCheckDuplicate = [incidentData.case_number];

    dbSelect(queryCheckDuplicate, paramsCheckDuplicate)
    .then((result) => {
    // Check if case number already exists in database    
    if (result.length > 0) {
        res.status(500).send('Case number already exists in database, cannot be inserted');
    } else {
        const combinedDateTime = `${incidentData.date} ${incidentData.time}`;
        const query = 'INSERT INTO incidents (case_number, date_time, code, incident, police_grid, neighborhood_number, block) VALUES (?, ?, ?, ?, ?, ?, ?)';
        const params = [incidentData.case_number, combinedDateTime, incidentData.code, incidentData.incident, incidentData.police_grid, incidentData.neighborhood_number, incidentData.block];

        dbRun(query, params)
            .then(() => {
                res.status(200).type('txt').send('Case inserted successfully');
            })
            .catch((err) => {
                console.error(err);
                res.status(500).send(err.message);
            });
    }
});
});

// DELETE request handler for new crime incident
app.delete('/remove-incident', (req, res) => {
    const caseNumber = req.body.case_number;

    // Check if the case number exists
    dbSelect('SELECT * FROM incidents WHERE case_number = ?', [caseNumber])
    .then((rows) => {
        if (rows.length === 0) {
            // Case number does not exist, reject with status 500
            res.status(500).type('txt').send('Case number does not exist in the database');
        } else {
            // Case number exists, remove incident
            dbRun('DELETE FROM incidents WHERE case_number = ?', [caseNumber])
            .then(() => {
                console.log('Data deleted successfully');
                res.status(200).type('txt').send('Case deleted successfully');
            })
            .catch((err) => {
                console.error('Error deleting data:', err);
                res.status(500).type('txt').send('Internal Server Error: ' + err.message);
            });
        }
    })
    .catch((err) => {
        console.error('Error checking case number:', err);
        res.status(500).type('txt').send('Internal Server Error: ' + err.message);
    });
});

/********************************************************************
 ***   START SERVER                                               *** 
 ********************************************************************/
// Start server - listen for client connections
app.listen(port, () => {
    console.log('Now listening on port ' + port);
});
