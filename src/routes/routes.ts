import express from 'express';

const router = express.Router();
require('dotenv').config();

// Write the middleware code here

const getDataFromFFS = async(req, res, next) => {

    next();
}

router
  .route('/post')
  .get(getDataFromFFS);

module.exports = router;