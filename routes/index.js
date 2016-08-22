var express = require('express');
var router = express.Router();

var db = require('../queries');


/* GET home page. */
router.get('/', db.dashboard);
router.get('/settings', db.listSettings);
router.post('/mint', db.mintTokens);
router.post('/spend', db.spendTokens);
router.post('/transfer', db.transfer_tokens);
router.post('/transfer_owner', db.transfer_tokens_from_owner);
router.post('/account_balance', db.get_account_balance);
router.post('/create_account', db.create_account);
// router.get('/history', db.transactionHistory);



router.get('/ping', function(req, res){
    res.status(200).send("pong!");
});

module.exports = router;