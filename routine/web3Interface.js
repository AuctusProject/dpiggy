const Web3Utils = require('web3-utils');
const Axios = require('axios');
const email = require('./email.js');
const EthereumTx = require('ethereumjs-tx').Transaction;

let web3Id = 0;

const callEthereum = (method, methodData, secondParam = "latest") => {
  return new Promise((resolve, reject) => {
    Axios.post("https://" + process.env.CHAIN + ".infura.io/v3/" + process.env.INFURA_ID, 
      {
        "jsonrpc":"2.0",
        "id": ++web3Id,
        "method": method,
        "params": (!!secondParam ? [methodData, secondParam] : [methodData])
      }, 
      {headers: {"Content-Type": "application/json"}})
      .then((response) =>
      {
        if (response && response.data) {
          if (response.data.error) {
            reject(method + " " + methodData + " " + JSON.stringify(response.data.error));
          } else {
            resolve(response.data.result);
          }
        } else {
          resolve(null);
        }
      })
      .catch((err) => reject(method + " " + methodData + " " + err.stack));
  });
};

const sendRawTransaction = (data, gasLimit) => {
  return new Promise((resolve, reject) => {
    getGasPrice().then((gasPriceGwei) => {
      getTransactionCount().then((nonce) => {
        const txParams = {
          nonce: Web3Utils.toHex(nonce),
          gasPrice: Web3Utils.toHex(gasPriceGwei * 1e9),
          gasLimit: Web3Utils.toHex(gasLimit),
          to: process.env.DPIGGY,
          value: '0x0',
          data: data
        };
        const tx = new EthereumTx(txParams, { chain: process.env.CHAIN });
        tx.sign(Buffer.from(process.env.ADDRESS_PK, 'hex'));
        const serializedTx = '0x' + tx.serialize().toString('hex');
        callEthereum("eth_sendRawTransaction", serializedTx, null).then((transactionHash) => {
          monitorTransaction(transactionHash).then(() => resolve()).catch((err) => reject(err));
        }).catch((err) => reject(err));
      }).catch((err) => reject(err));
    }).catch((err) => reject(err));
  });
};

const monitorTransaction = (transactionHash) => {
  return new Promise((resolve, reject) => {
    checkTransaction(transactionHash, resolve, reject);
  });
};

const checkTransaction = (transactionHash, onMined, onError, attempt = 0) => {
  if (attempt > 10) {
    onError("Timeout waiting transaction: " + transactionHash);
  } else {
    setTimeout(() => {
      getTransaction(transactionHash).then((transaction) => {
        if (transaction) {
          if (Web3Utils.hexToNumber(transaction.status) > 0) {
            onMined(transaction);
          } else {
            onError("Transaction error " + transactionHash);
          }
        } else {
          checkTransaction(transactionHash, onMined, onError, ++attempt);
        }
      }).catch((err) => onError(err));
    }, 5000);
  }
};

const getTransaction = (transactionHash) => {
  return new Promise((resolve, reject) => {
    callEthereum("eth_getTransactionReceipt", transactionHash, null).then((result) => {
      if (result && result.blockNumber) {
        resolve(result);
      } else {
        resolve(null);
      }
    }).catch((err) => reject(err));
  });
};

const getTransactionCount = () => {
  return new Promise((resolve, reject) => {
    callEthereum("eth_getTransactionCount", process.env.ADDRESS).then((result) => {
      if (result) {
        resolve(Web3Utils.hexToNumber(result));
      } else {
        reject("Cannot read getTransactionCount");
      }
    }).catch((err) => reject(err));
  });
}; 

const getGasPrice = () => {
  return new Promise((resolve, reject) => {
    if (!!process.env.FORCE_GWEI && process.env.FORCE_GWEI > 0) {
      if (process.env.FORCE_GWEI > process.env.MAX_GWEI) {
        reject("Force gas price too expensive: " + process.env.FORCE_GWEI + "Gwei");
      } else {
        resolve(process.env.FORCE_GWEI);
      }
    } else {
      Axios.get(process.env.GAS_API).then((response) => {
        if (response && response.data && response.data[process.env.GWEI_TYPE]) {
          let gasPrice = Math.ceil(response.data[process.env.GWEI_TYPE] / 10.0);
          if (gasPrice > process.env.MAX_GWEI) {
            reject("Gas price too expensive: " + gasPrice + "Gwei");
          } else {
            resolve(gasPrice);
          }
        } else {
          email.sendEmail("Cannot read getGasPrice '" + process.env.GWEI_TYPE +"' from: " + process.env.GAS_API).finally(() => resolve(process.env.MAX_GWEI / 2));
        }
      }).catch((err) => email.sendEmail("Cannot read getGasPrice from: " + process.env.GAS_API + " " + err.stack).finally(() => resolve(process.env.MAX_GWEI / 2)));
    }
  });
};

const assetToData = (asset) => {
  return asset.substring(2).padStart(64, '0');
};

const numberToData = (num) => {
  return num.toString(16).padStart(64, '0');
};

const getCompoundRedeemData = (assets) => {
  let data = "0xdd1ba3090000000000000000000000000000000000000000000000000000000000000020";
  data += numberToData(assets.length);
  for (let i = 0; i < assets.length; ++i) {
    data += assetToData(assets[i]);
  }   
  return data;
};

const getEstimatedGas = (data) => {   
  return new Promise((resolve, reject) => { 
    return callEthereum("eth_estimateGas", {"from": process.env.ADDRESS, "to": process.env.DPIGGY, "data": data}, null).then((result) => {
      if (result) {
        resolve(parseInt(Web3Utils.hexToNumber(result) * process.env.GAS_AJUSTMENT));
      } else {
        reject("Cannot read eth_estimateGas from: " + data);
      }
    }).catch((err) => reject(err));
  });
};

const processCompoundRedeem = (assets, isEachAssetExecution = false) => {
  return new Promise((resolve, reject) => { 
    const compoundData = getCompoundRedeemData(assets);
    getEstimatedGas(compoundData).then((gasLimit) => 
    {
      if (gasLimit < process.env.MAX_GAS_LIMIT) {
        sendRawTransaction(compoundData, gasLimit).then(() => resolve(true)).catch((err) => email.sendEmail(err).finally(() => reject(err)));
      } else if (assets.length === 1) {
        const msg = "Impossible to process the asset " + assets[0] + " with gas limit " + gasLimit;
        if (isEachAssetExecution) {
          email.sendEmail(msg).finally(() => reject(msg));
        } else {
          reject(msg);
        }
      } else {
        resolve(false);
      }
    }).catch((err) => reject(err));
  });
};

const processEachAssetCompoundRedeem = (assets) => {
  let p = Promise.resolve();
  for (let i = 0; i < assets.length; ++i) {
    p = p.then(() => processCompoundRedeem([assets[i]], true)); 
  }
  return p;
};

const getAssets = () => {
  return new Promise((resolve, reject) => { 
    getNumberOfAssets().then((assetQty) => {
      const assetPromises = [];
      for (let assetIndex = 0; assetIndex < assetQty; ++assetIndex) {
        assetPromises.push(getAsset(assetIndex));
      }
      Promise.all(assetPromises.map(p => p.catch(e => e))).then((assets) =>
      {
        const assetsData = [];
        let assetsError = "";
        for (let i = 0; i < assetQty; ++i) {
          if (assets[i] && !(assets[i] instanceof Error)) {
            assetsData.push(assets[i]);
          } else {
            assetsError += "<br/>Error on search asset " + i + ": " + ((assets[i] instanceof Error) ? assets[i].stack : assets[i]);      
          }
        }
        if (!!assetsError) {
          email.sendEmail(assetsError).finally(() => resolve(assetsData));
        } else {
          resolve(assetsData);
        }
      });
    }).catch((err) => reject(err));
  });
};

const getAssetsToProcess = (assets) => {
  return new Promise((resolve, reject) => { 
    const timePromises = [];
    for (let assetIndex = 0; assetIndex < assets.length; ++assetIndex) {
      timePromises.push(getMinimumTimeForNextExecution(assets[assetIndex]));
    }
    Promise.all(timePromises.map(p => p.catch(e => e))).then((times) =>
    {
      const assetsToProcess = [];
      let assetsError = "";
      const now = Math.round((new Date()).getTime() / 1000) - 60;
      for (let i = 0; i < assets.length; ++i) {
        if (times[i] && !(times[i] instanceof Error)) {
          if (now > times[i]) {
            assetsToProcess.push(assets[i]);
          }
        } else {
          assetsError += "<br/>Error on get asset " + assets[i] + " time: " + ((times[i] instanceof Error) ? times[i].stack : times[i]);
        }
      }
      if (!!assetsError) {
        email.sendEmail(assetsError).finally(() => resolve(assetsToProcess));
      } else {
        resolve(assetsToProcess);
      }
    });
  });
};

const checkEthBalance = () => {    
  return new Promise((resolve, reject) => {
    callEthereum("eth_getBalance", process.env.ADDRESS).then((result) => {
      if (result) {
        var value = parseFloat(Web3Utils.fromWei(Web3Utils.toBN(result).toString(), 'ether'));
        if (value < process.env.ETHER_ALERT) {
          email.sendEmail("Ether amount on address " + process.env.ADDRESS + " is low " + value).finally(() => resolve(value));
        } else {
          resolve(value);
        }
      } else {
        reject("No ether on address " + process.env.ADDRESS);
      }
    }).catch((err) => reject(err));
  });
};

const getNumberOfAssets = () => {    
  return new Promise((resolve, reject) => {
    callEthereum("eth_call", {"to": process.env.DPIGGY, "data": "0xedf49c09"}).then((result) => {
      if (result) {
        resolve(Web3Utils.hexToNumber(result));
      } else {
        reject("No asset found on contract: " + process.env.DPIGGY);
      }
    }).catch((err) => reject(err));
  });
};

const getAsset = (index) => {   
  return new Promise((resolve, reject) => { 
    return callEthereum("eth_call", {"to": process.env.DPIGGY, "data": "0xcf35bdd0" + numberToData(index)}).then((result) => {
      if (result && result.length == 66) {
        resolve("0x" + result.substring(26));
      } else {
        reject("Cannot read getAsset from: " + process.env.DPIGGY + " index " + index);
      }
    }).catch((err) => reject(err));
  });
};

const getMinimumTimeForNextExecution = (asset) => {   
  return new Promise((resolve, reject) => { 
    return callEthereum("eth_call", {"to": process.env.DPIGGY, "data": "0x5a5cd6eb" + assetToData(asset)}).then((result) => {
      if (result) {
        resolve(Web3Utils.hexToNumber(result));
      } else {
        reject("Cannot read getMinimumTimeForNextExecution from: " + process.env.DPIGGY + " asset " + asset);
      }
    }).catch((err) => reject(err));
  });
};

module.exports.executeCompoundRedeem = () => {   
  return new Promise((resolve, reject) => { 
    getAssets().then((assets) => {
      if (assets.length > 0) {
        getAssetsToProcess(assets).then((assetsToProcess) => {
          if (assetsToProcess.length > 0) {
            checkEthBalance().then(() => {
              processCompoundRedeem(assetsToProcess).then((status) =>
              {
                if (status) {
                  resolve("Compound redeem executed together.");
                } else {
                  processEachAssetCompoundRedeem(assets).then(() => {
                    resolve("Compound redeem executed separated.");
                  }).catch((err) => reject(err));
                }
              }).catch((err) => reject(err));
            }).catch((err) => reject(err));
          } else {
            resolve("No asset to process.");
          }
        }).catch((err) => reject(err));
      } else {
        resolve("No asset found.");
      }
    }).catch((err) => reject(err));
  });
};