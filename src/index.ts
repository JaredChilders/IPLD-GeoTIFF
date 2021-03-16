import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import compress from 'compression';
import helmet from 'helmet';

const PORT = 3000;
const NODE_ENV = 'development';
//import routes from './routes/index.js';

const app = express();

app.set('port', PORT);
app.set('env', NODE_ENV);
//app.use(bodyParser.json());

app.use('/', require(path.join(__dirname, 'routes')));

// no mount path. Function is executed at every request 
app.use((req, res, next) => {
    const err = new Error(`${req.method} ${req.url} Not Found`);
    next(err);
  });
  
  // no mount path. Function is executed at every request 
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500);
    res.json({
      error: {
        message: err.message,
      },
    });
  });

app.listen(PORT, () => {
    console.log(
      `Express Server started on Port ${app.get(
        'port'
      )} | Environment : ${app.get('env')}`
    );
  });

/**
 * TODO: 
 *  1) Figure out how the user will make a request 
 *  2) Setup Server
 *  3) Test the functionality 
 *  4) Design the API for the Server
 */