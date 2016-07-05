var promise = require('bluebird');

var options = {
  // Initialization Options
  promiseLib: promise
};

var web3options = {
  debug: true
}
var pgp = require('pg-promise')(options);
var connectionString = 'postgres://localhost:5432/biathlon_api';
var db = pgp(connectionString);
var hstore = require('pg-hstore')();

var Web3 = require('web3');
var web3 = new Web3(web3options);

web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));
web3.eth.defaultAccount = web3.eth.accounts[0];

module.exports = {
  dashboard: dashboard,
  listAllAccounts: listAllAccounts,
  listSettings: listSettings,
  mintTokens: mintTokens,
  spendTokens: spendTokens
};

var connectToBlockchain = function() {
  return db.one("select options from settings") 
    .then(function(data) {
      return hstore.parse(data.options);
    }).then(function(config) {

      var biathlon = web3.eth.contract(JSON.parse(config.contract_abi));
      return biathlon.at(config.contract_address);
    })
    .catch(function(err) {
     console.log("ERROR:", err);
    });
}


function mintTokens(req, res, next) {
  req.body.tokens = parseInt(req.body.tokens);
  
  return connectToBlockchain().then(function(contract) {
    return contract.mintToken(req.body.recipient, req.body.tokens);
  }).then(function(txhash) {
    db.none('INSERT INTO transactions (txaddress, tx_type_id, recipient, value)' + 
    'VALUES(${txhash}, 1, ${recipient}, ${tokens} )',  {txhash: txhash, recipient: req.body.recipient, tokens: req.body.tokens})
    }).then(function() {
      res.status(200)
        .json({status: 'success',
          message: 'Minted ' + req.body.tokens + ' tokens to account ' + req.body.recipient
    })
  }).catch(function(err) {
       console.log("ERROR:", err);
  });
}


function spendTokens(req,res,next) {
  req.body.tokens = parseInt(req.body.tokens);
  return connectToBlockchain().then(function(contract) {
    return contract.spendToken(req.body.tokens, {from: req.body.sender});
  }).then(function(txhash) {
    db.none('INSERT INTO transactions (txaddress, tx_type_id, source, value)' + 
    'VALUES(${txhash}, 2, ${sender}, ${tokens} )',  {txhash: txhash, sender: req.body.sender, tokens: req.body.tokens})
    }).then(function() {
      res.status(200)
        .json({status: 'success',
          message: 'Spent ' + req.body.tokens + ' tokens from account ' + req.body.recipient
    })
  }).catch(function(err) {
       console.log("ERROR:", err);
  });
}

function listAllAccounts(req, res, next) {
  
}

function dashboard(req, res, next) {
  return connectToBlockchain().then(function (contract) {
    var totalSupply = contract.totalSupply();
    var accounts = {};
    web3.eth.accounts.forEach(function(acc) {
      accounts[acc] = {};
      accounts[acc]['ether'] = web3.fromWei(web3.eth.getBalance(acc), "ether");
      accounts[acc]['biathlon'] = contract.balanceOf(acc);
    });
    var hash = {};
    hash.totalSupply = totalSupply;
    hash.accounts = accounts;
    return hash;
  }).then(function(accounts) {
    res.status(200).json({status: 'success',
      data: accounts
    });
  });

}

function listSettings(req, res, next) {
  db.any('select * from settings')
    .then(function(data) {

      res.status(200)
        .json({
          status: 'success',
          data: data,
          message: 'Retrieved ALL settings'
        });
      })
      .catch(function(err) {
        return next(err)
      });

}
