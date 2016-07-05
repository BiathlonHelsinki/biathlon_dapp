var express = require('express');
var router = express.Router();

var db = require('../queries');


/* GET home page. */
router.get('/', db.dashboard);
router.get('/settings', db.listSettings);
router.post('/mint', db.mintTokens);
router.post('/spend', db.spendTokens);




router.get('/ping', function(req, res){
    res.status(200).send("pong!");
});

module.exports = router;