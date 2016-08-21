var promise = require('bluebird');

var options = {
  // Initialization Options
  promiseLib: promise
};

var web3options = {
  debug: true,
  host: '/Users/fail/geth.ipc',
  ipc: true,
  personal: true, 
  admin: true,
}
var async = require('async');

var pgp = require('pg-promise')(options);
var connectionString = 'postgres://localhost:5432/biathlon_api';
var db = pgp(connectionString);
var hstore = require('pg-hstore')();

var web3_extended = require('web3_ipc');
var web3 = web3_extended.create(web3options);
web3.eth = promise.promisifyAll(web3.eth);
// web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));
// web3.setProvider(new web3.providers.IpcProvider());
// web3.eth.defaultAccount = web3.eth.getAccounts(function(error, result) {
//   return result[0]; });
//


module.exports = {
  dashboard: dashboard,
  listAllAccounts: listAllAccounts,
  listSettings: listSettings,
  mintTokens: mintTokens,
  spendTokens: spendTokens,
  get_account_balance: getAccountBalance,
  create_account: createAccount,
  transfer_tokens: transferTokens
  // transactionHistory: transactionHistory
};



function getSettings() {
  return db.one("select options from settings").then(function(data) {
    return hstore.parse(data.options);
  });
}

function getAccountBalance(req, res, next) {
  return connectToBlockchain().then(function (contract) {
    var bb = get_biathlon_balance(contract, req.body.account);
       return bb.then(function(value) {
         res.status(200)
           .json({
             status: 'success',
             data: value,
             message: 'Retrieved ALL settings'
           });
     });
  });
}


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

function createAccount(req, res, next) {
  return new promise(function(resolve, reject) {
    web3.personal.newAccount(req.body.password, function(err,data){
      if(err !== null) return reject(err);
      resolve(data);
    });
  }).then(function(data) {
    res.status(200)
      .json({status: 'success',
              data: data});
  });
}



function contract_mint(contract, receiver, tokens) {
  return new promise(function(resolve, reject) {
    var settings = getSettings();
    return settings.then(function(settings) {
      return contract.mintToken(receiver, tokens, {from: settings.coinbase}, function(err, data) {
        if(err !== null) return reject(err);
        resolve(data);
      });
    });
  });
}


function mintTokens(req, res, next) {
  req.body.tokens = parseInt(req.body.tokens);
  return connectToBlockchain().then(function(contract) {
    var mintorder = contract_mint(contract, req.body.recipient, req.body.tokens);
    return mintorder.then(function(txhash) { 
      db.none('INSERT INTO ethtransactions (txaddress, transaction_type_id, recipient_account, value, timeof, created_at, updated_at)' + 
      'VALUES(${txhash}, 1, ${recipient_account}, ${tokens}, now(), now(), now() )',  {txhash: txhash, recipient_account: req.body.recipient, tokens: req.body.tokens});      
      return txhash;
    }).then(function(txhash) {
        res.status(200)
          .json({status: 'success',
        data: txhash,
            message: 'Minted ' + req.body.tokens + ' tokens to account ' + req.body.recipient
            });
      });
    }).catch(function(err) {
         console.log("ERROR:", err);
  });
}



function spendTokens(req,res,next) {
  req.body.tokens = parseInt(req.body.tokens);
  return connectToBlockchain().then(function(contract) {
    var spendbill = contract_spend(contract, req.body.sender, req.body.tokens);
    return spendbill.then(function(txhash) {
      db.none('INSERT INTO ethtransactions (txaddress, transaction_type_id, source_account, value, timeof, created_at, updated_at)' + 
                'VALUES(${txhash}, 2, ${sender}, ${tokens}, now(), now(), now() )',  {txhash: txhash, sender: req.body.sender, tokens: req.body.tokens})
    }).then(function() {
      res.status(200)
        .json({status: 'success',
          message: 'Spent ' + req.body.tokens + ' tokens from account ' + req.body.sender
        })
    });
  }).catch(function(err) {
       console.log("ERROR:", err);
  });
}

function transferTokens(req,res,next) {
  req.body.tokens = parseInt(req.body.tokens);
  return connectToBlockchain().then(function(contract) {
    var spendbill = contract_transfer(contract, req.body.sender, req.body.recipient, req.body.tokens, req.body.unlock);
    return spendbill.then(function(txhash) {
      db.none('INSERT INTO ethtransactions (txaddress, transaction_type_id, source_account, recipient_account, value, timeof, created_at, updated_at)' + 
      'VALUES(${txhash}, 3, ${sender}, ${recipient}, ${tokens}, now(), now(), now() )',  {txhash: txhash, sender: req.body.sender, recipient: req.body.recipient, tokens: req.body.tokens});
      return txhash;
    }).then(function(txhash) {
      res.status(200)
      .json({status: 'success', data: txhash,
          message: 'Transfered ' + req.body.tokens + ' tokens from account ' + req.body.sender + ' to account ' + req.body.recipient
        })
    });
  }).catch(function(err) {
       console.log("ERROR:", err);
  });
}


function listAllAccounts(req, res, next) {
  
}

function get_balance(account) {
  return new promise(function(resolve,reject) {
    web3.eth.getBalance(account,function(err,data){
        if(err !== null) return reject(err);
        resolve(web3.toWei(data, 'ether'));
    });
  });
}

function contract_spend(contract, spender, tokens) {
  return new promise(function(resolve, reject) {
    var settings = getSettings();
    return settings.then(function(settings) {
      return contract.deleteToken(spender, tokens, {from: settings.coinbase}, function(err, data) {
        if(err !== null) return reject(err);
        resolve(data);
      });
    });
  });
}

function contract_transfer(contract, sender, recipient, tokens, password) {
  return new promise(function(resolve, reject) {
    var settings = getSettings();
    return settings.then(function(settings) {
      return new promise(function(resolve, reject) {
        web3.personal.unlockAccount(sender, password, 7000, function(err, data) {
          if(err !== null) return reject(err);
          resolve(data);
        });
      }).then(function(data) {
        return new promise(function(resolve, reject) {
          // get balance of sender so we can top up if under minimum
          web3.eth.getBalance(sender, function(err, sender_balance) {
            if(err !== null) return reject(err);
            resolve(sender_balance);
          });
        }).then(function(sender_balance) {
          return new promise(function(resolve, reject) {
            var difference = 4000000000000000 - sender_balance;
            web3.eth.sendTransaction({from: settings.coinbase, to: sender, value: difference}, function(err, data) {
              if(err !== null) return reject(err);
              resolve(data);
            });
          });
        });
      }).then(function(data) {
        return contract.transferFrom(sender, recipient, tokens, {from: sender}, function(err, data) {
          if(err !== null) return reject(err);
          resolve(data);
        });
      });
    });
  });
}

function get_biathlon_balance(contract, account) {
  return new promise(function(resolve,reject) {
    contract.balanceOf(account, function(err,data){
        if(err !== null) return reject(err);
        resolve(data);
    });
  });
}


function dashboard(req, res, next) {
  var accounts = {};
  accounts['accounts'] = {};
  accounts['totalSupply'] = 0;
  return connectToBlockchain().then(function (contract) {

    
    
    web3.eth.getAccounts(function(err, alist) {
      
      promise.map(alist, function(acc) {
        accounts['accounts'][acc] = {};
    
        var balance =  get_balance(acc);
        return balance.then(function(value) {
          accounts['accounts'][acc]['ether'] = value;

        }).then(function() {
          var bb = get_biathlon_balance(contract, acc);
          return bb.then(function(value) {
            accounts['accounts'][acc]['biathlon'] = value;
          });
        });

      }).then(function() {
          var ts = new promise(function(resolve,reject) {
            contract.totalSupply(function(err, data) {
              if(err !== null) return reject(err);
              resolve(data);
            });
          });
          return ts.then(function(totals) {
            
            accounts['totalSupply'] = totals;
          });
        }).then(function() {
            res.status(200).json({status: 'success',
                                  data: accounts });
        });
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


// function transactionHistory(req, res, next) {
//   // Get last checked block, or use zero if first time
//   var end = web3.eth.getBlock('latest').number;
//   return getSettings().then(function(settings) {
//     return settings.latest_block;
//   }).then(function(latestblock) {
//     return connectToBlockchain().then(function(contract) {
//         return contract.filter({fromBlock: latestblock, toBlock: end, address: contract.address});
//     }).then{function(filter) {
//       filter.watch(function(err, log) {
//           db.none('INSERT INTO ethtransactions (txaddress, source_account, recipient_account, value, created_at, updated_at)' +
//           ' SELECT ${transactionHash},  ${source_account}, ${recipient_account}, cast(${value} as integer), now(), now() ' +
//           ' WHERE NOT EXISTS (select * from ethtransactions where txaddress = ${transactionHash})', {transactionHash: log.transactionHash, source_account: log.args.from,
//             recipient_account: log.args.to, value: parseInt(log.args.value)});
//         });
//         var spendWatch =  contract.Spend({from: contract.owner()}, {fromBlock: latestblock, toBlock: end});
//
//         console.log('got here');
//         spendWatch.watch(function(err, log) {
//           console.log('log is ' + log);
//           db.none('INSERT INTO ethtransactions (txaddress, transaction_type_id, source_account, value, created_at, updated_at)' +
//           ' SELECT ${transactionHash}, 2, ${source_account}, cast(${value} as integer), now(), now() ' +
//           ' WHERE NOT EXISTS (select * from ethtransactions where txaddress = ${transactionHash})', {transactionHash: log.transactionHash, source_account: log.args.from,
//              value: parseInt(log.args.value)});
//         });
//       });
//     }).then(function() {
//       return db.none("UPDATE settings SET options = options || '\"latest_block\"=>${end}' :: hstore", {end: end});
//     }).then(function() {
//       res.status(200).json({status: 'success'
//     });
//   });
// }