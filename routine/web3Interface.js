const Web3Utils = require('web3-utils');
const Axios = require('axios');
const email = require('./email.js');
const EthereumTx = require('ethereumjs-tx').Transaction;

const fromBlock = "0x" + parseInt(process.env.FROM_BLOCK).toString(16);

let web3Id = 0;

const callEthereum = (method, methodData, secondParam = "latest") => {
  return new Promise((resolve, reject) => {
    Axios.post("https://" + process.env.CHAIN + ".infura.io/v3/" + process.env.INFURA_ID, 
      {
        "jsonrpc":"2.0",
        "id": ++web3Id,
        "method": method,
        "params": ((secondParam !== null && secondParam !== undefined) ? [methodData, secondParam] : [methodData])
      }, 
      {headers: {"Content-Type": "application/json"}})
      .then((response) =>
      {
        if (response && response.data) {
          if (response.error) {
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

const addressToData = (address) => {
  return address.substring(2).padStart(64, '0');
};

const numberToData = (num) => {
  return num.toString(16).padStart(64, '0');
};

const getCompoundRedeemData = (assets) => {
  let data = "0xdd1ba3090000000000000000000000000000000000000000000000000000000000000020";
  data += numberToData(assets.length);
  for (let i = 0; i < assets.length; ++i) {
    data += addressToData(assets[i]);
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

const getAssetsProxy = (assets) => {
  return new Promise((resolve, reject) => { 
      const assetPromises = [];
      for (let assetIndex = 0; assetIndex < assets.length; ++assetIndex) {
        assetPromises.push(getAssetProxy(assets[assetIndex]));
      }
      Promise.all(assetPromises.map(p => p.catch(e => e))).then((proxies) =>
      {
        const proxiesData = [];
        const allProxiesPromise = [];
        let proxiesError = "";
        for (let i = 0; i < assets.length; ++i) {
          if (proxies[i] && !(proxies[i] instanceof Error)) {
            proxiesData.push({asset: assets[i], proxy: proxies[i]});
            allProxiesPromise.push(getAllProxies(proxies[i]));
          } else {
            proxiesError += "<br/>Error on search asset proxy " + assets[i] + ": " + ((proxies[i] instanceof Error) ? proxies[i].stack : proxies[i]);      
          }
        }
        Promise.all(allProxiesPromise).then((proxies) => {
          for (let j = 0; j < allProxiesPromise.length; ++j) {
            proxiesData[j].all = proxies[j];
          }
          if (!!proxiesError) {
            email.sendEmail(proxiesError).finally(() => resolve(proxiesData));
          } else {
            resolve(proxiesData);
          }
        }).catch((err) => reject(err));
      });
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

const getEthBalance = (address) => {    
  return new Promise((resolve, reject) => {
    callEthereum("eth_getBalance", address).then((result) => {
      if (result) {
        resolve(BigInt(result));
      } else {
        resolve(BigInt(0));
      }
    }).catch((err) => reject(err));
  });
};

const getTokenBalance = (token, address) => {    
  return new Promise((resolve, reject) => {
    callEthereum("eth_call", {"to": token, "data": "0x70a08231" + addressToData(address)}).then((result) => {
      if (result) {
        resolve(BigInt(result));
      } else {
        resolve(BigInt(0));
      }
    }).catch((err) => reject(err));
  });
};

const checkExecutorEthBalance = () => {    
  return new Promise((resolve, reject) => {
    getEthBalance(process.env.ADDRESS).then((result) => {
      if (result) {
        var value = parseFloat(Web3Utils.fromWei(Web3Utils.toBN("0x" + result.toString(16)).toString(), 'ether'));
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

const getAssetProxy = (asset) => {   
  return new Promise((resolve, reject) => { 
    return callEthereum("eth_call", {"to": process.env.DPIGGY, "data": "0x35558e9b" + addressToData(asset)}).then((result) => {
      if (result && result.length > 66) {
        resolve("0x" + result.substring(26, 66));
      } else {
        reject("Cannot read getAssetProxy from: " + process.env.DPIGGY + " asset " + asset);
      }
    }).catch((err) => reject(err));
  });
};

const getPreviousProxies = (proxy, proxies) => {
  return new Promise((resolve, reject) => {
    getLastProxy(proxy).then((result) =>
    {
      if (result) {
        proxies.unshift(result);
        resolve(getPreviousProxies(result, proxies));
      } else {
        resolve(proxies);
      }
    }).catch((err) => reject(err));
  });
};

const getAllProxies = (proxy) => {
  let proxies = [proxy];
  return getPreviousProxies(proxy, proxies);
};

const getLastProxy = (proxy) => {   
  return new Promise((resolve, reject) => { 
    return callEthereum("eth_getLogs", {"address": [proxy], "fromBlock": fromBlock, "topics": ["0xc00a27945a4c0dbeb22e4acdf6e3db57385e6519565e884cb505d1dc95d196b6"]}, null).then((result) => {
      if (result && result.length > 0) {
        resolve("0x" + result[0].data.substring(26));
      } else {
        resolve(null);
      }
    }).catch((err) => reject(err));
  });
};

const getUserProxyData = (proxies) => {   
  return new Promise((resolve, reject) => { 
    Promise.all([getUserDepositData(proxies), getUserRedeemData(proxies), getUserFinishData(proxies)]).then((result) => {
      let data = [];
      for (let i = 0; i < result.length; ++i) {
        data = data.concat(result[i]);
      }
      resolve(data);
    }).catch((err) => reject(err));
  });
};

const getUserDepositData = (proxies) => {   
  return new Promise((resolve, reject) => { 
    return callEthereum("eth_getLogs", {"address": proxies, "fromBlock": fromBlock, "topics": ["0x7162984403f6c73c8639375d45a9187dfd04602231bd8e587c415718b5f7e5f9"]}, null).then((result) => {
      const response = [];
      const promises = [];
      let indexes = {};
      for (let i = 0; i < result.length; ++i) {
        const uints = parseDataToUint256(result[i].data);
        const blockNumber = parseInt(result[i].blockNumber, 16);
        response.push({
          blockNumber: blockNumber, 
          transactionIndex: parseInt(result[i].transactionIndex, 16), 
          logIndex: parseInt(result[i].logIndex, 16), 
          user: "0x" + result[i].topics[1].substring(26), 
          type: "deposit", 
          amount: uints[0], 
          rate: uints[1], 
          baseExecutionId: uints[2], 
          baseExecutionAmountForFee: uints[3]
        }); 
        if (!indexes[blockNumber.toString()]) {
          indexes[blockNumber.toString()] = promises.length;
          promises.push(getBlockTimestamp(blockNumber));
        }
      }
      Promise.all(promises).then((times) =>
      {
        for (let j = 0; j < response.length; ++j) {
          response[j].time = times[indexes[response[j].blockNumber.toString()]];
        }
        resolve(response);
      }).catch((err) => reject(err));
    }).catch((err) => reject(err));
  });
};

const getUserRedeemData = (proxies) => {   
  return new Promise((resolve, reject) => { 
    return callEthereum("eth_getLogs", {"address": proxies, "fromBlock": fromBlock, "topics": ["0x222838db2794d11532d940e8dec38ae307ed0b63cd97c233322e221f998767a6"]}, null).then((result) => {
      const response = [];
      for (let i = 0; i < result.length; ++i) {
        const uints = parseDataToUint256(result[i].data);
        response.push({
          blockNumber: parseInt(result[i].blockNumber, 16), 
          transactionIndex: parseInt(result[i].transactionIndex, 16), 
          logIndex: parseInt(result[i].logIndex, 16), 
          user: "0x" + result[i].topics[1].substring(26), 
          type: "redeem", 
          amount: uints[0]
        }); 
      }
      resolve(response);
    }).catch((err) => reject(err));
  });
};

const getUserFinishData = (proxies) => {   
  return new Promise((resolve, reject) => { 
    return callEthereum("eth_getLogs", {"address": proxies, "fromBlock": fromBlock, "topics": ["0xe2d3355730bcec47e085f9e5b21d716ee4562116e0ed10e577695c7468910659"]}, null).then((result) => {
      const response = [];
      for (let i = 0; i < result.length; ++i) {
        const uints = parseDataToUint256(result[i].data);
        response.push({
          blockNumber: parseInt(result[i].blockNumber, 16), 
          transactionIndex: parseInt(result[i].transactionIndex, 16), 
          logIndex: parseInt(result[i].logIndex, 16), 
          user: "0x" + result[i].topics[1].substring(26), 
          type: "finish", 
          totalRedeemed: uints[0], 
          yield: uints[1], 
          fee: uints[2], 
          totalAucBurned: uints[3]
        }); 
      }
      resolve(response);
    }).catch((err) => reject(err));
  });
};

const getBlockTimestamp = (block) => {
  return new Promise((resolve, reject) => {
    return callEthereum("eth_getBlockByNumber", "0x" + block.toString(16), false).then((result) => resolve(BigInt(result.timestamp))).catch((err) => reject(err)); 
  });
};

const getLastExecutionId = (proxy) => {   
  return new Promise((resolve, reject) => {
    return callEthereum("eth_call", {"to": proxy, "data": "0x76ce2dad"}).then((result) => {
      resolve(parseInt(result, 16));
    }).catch((err) => reject(err)); 
  });
};

const getExecutionData = (proxy, id) => {   
  return new Promise((resolve, reject) => {
    return callEthereum("eth_call", {"to": proxy, "data": "0xf76c9229" + numberToData(id)}).then((result) => {
      const uints = parseDataToUint256(result);
      resolve({
        time: uints[0],
        rate: uints[1],
        totalDai: uints[2],
        totalRedeemed: uints[3],
        totalBought: uints[4],
        totalBalance: uints[5],
        totalFeeDeduction: uints[6],
        feeAmount: uints[7]
      });
    }).catch((err) => reject(err)); 
  });
};

const getExecutions = (proxy, proxies) => {   
  return new Promise((resolve, reject) => {
    return callEthereum("eth_getLogs", {"address": proxies, "fromBlock": fromBlock, "topics": ["0x5b60a66f83b2a5d38f756162682c5b2cb62350d695d99f01d667b27d0050f66d"]}, null).then((result) => {
      const response = [];
      const promises = [];
      for (let i = 0; i < result.length; ++i) {
        const id = parseInt(result[i].topics[1], 16);
        const uints = parseDataToUint256(result[i].data);
        response.push({
          blockNumber: parseInt(result[i].blockNumber, 16), 
          transactionIndex: parseInt(result[i].transactionIndex, 16), 
          logIndex: parseInt(result[i].logIndex, 16), 
          id: id, 
          proxy: result[i].address,
          type: "execution",
          rate: uints[0], 
          totalBalance: uints[1], 
          totalRedeemed: uints[2], 
          feeAmount: uints[3], 
          totalBought: uints[4], 
          totalAucBurned: uints[5]
        }); 
        promises.push(getExecutionData(proxy, id));
      }
      Promise.all(promises).then((data) =>
      {
        for (let j = 0; j < data.length; ++j) {
          response[j].totalDai = data[j].totalDai;
          response[j].totalFeeDeduction = data[j].totalFeeDeduction;
          response[j].time = data[j].time;
        }
        resolve(response);
      }).catch((err) => reject(err));
    }).catch((err) => reject(err));
  });
};

const getEscrows = () => {   
  return new Promise((resolve, reject) => { 
    return callEthereum("eth_getLogs", {"address": process.env.DPIGGY, "fromBlock": fromBlock, "topics": ["0x09899d3bc411b2ff72f6d9cba531694b14492852d1611cddc40e67ba1dfc74a8"]}, null).then((result) => {
      const response = [];
      for (let i = 0; i < result.length; ++i) {
        response.push({
          blockNumber: parseInt(result[i].blockNumber, 16), 
          transactionIndex: parseInt(result[i].transactionIndex, 16), 
          logIndex: parseInt(result[i].logIndex, 16), 
          user: "0x" + result[i].topics[1].substring(26),
          type: "addEscrow"
        }); 
      }
      callEthereum("eth_getLogs", {"address": process.env.DPIGGY, "fromBlock": fromBlock, "topics": ["0x64e00bc52c721070900f2a4b11fd4664631f826e922140bb894b9968ab4bd4b9"]}, null).then((result) => {
        for (let i = 0; i < result.length; ++i) {
          response.push({
            blockNumber: parseInt(result[i].blockNumber, 16), 
            transactionIndex: parseInt(result[i].transactionIndex, 16), 
            logIndex: parseInt(result[i].logIndex, 16), 
            user: "0x" + result[i].topics[1].substring(26),
            type: "removeEscrow"
          }); 
        }
        resolve(response);
      }).catch((err) => reject(err));
    }).catch((err) => reject(err));
  });
};

const getCurrentDailyFee = () => {   
  return new Promise((resolve, reject) => { 
    return callEthereum("eth_call", {"to": process.env.DPIGGY, "data": "0x9306fd3d"}).then((result) => {
      const uints = parseDataToUint256(result);
      resolve(uints[0]);
    }).catch((err) => reject(err)); 
  });
};

const getCurrentTimeBetweenExecutions = (proxy) => {   
  return new Promise((resolve, reject) => { 
    return callEthereum("eth_call", {"to": proxy, "data": "0x5c7c6a92"}).then((result) => {
      const uints = parseDataToUint256(result);
      resolve(uints[0]);
    }).catch((err) => reject(err)); 
  });
};

const getCurrentUserData = (proxy, user) => {   
  return new Promise((resolve, reject) => { 
    return callEthereum("eth_call", {"to": proxy, "data": "0x0560ab69" + addressToData(user)}).then((result) => {
      const uints = parseDataToUint256(result);
      resolve({
        baseExecutionId: Number(uints[0]),
        baseExecutionAvgRate: uints[1],
        baseExecutionAccumulatedAmount: uints[2],
        baseExecutionAccumulatedWeightForRate: uints[3],
        baseExecutionAmountForFee: uints[4],
        currentAllocated: uints[5],
        previousAllocated: uints[6],
        previousProfit: uints[7],
        previousAssetAmount: uints[8],
        previousFeeAmount: uints[9],
        redeemed: uints[10]
      });
    }).catch((err) => reject(err)); 
  });
};

const getUserProfitsAndFeeAmount = (proxy, user) => {   
  return new Promise((resolve, reject) => { 
    return callEthereum("eth_call", {"to": proxy, "data": "0x7bf9ebe9" + addressToData(user)}).then((result) => {
      const uints = parseDataToUint256(result);
      resolve({
        userProfit: uints[0],
        userAssetProfit: uints[1],
        userFeeAmount: uints[2]
      });
    }).catch((err) => reject(err)); 
  });
};

const getPercentagePrecision = () => {   
  return new Promise((resolve, reject) => { 
    return callEthereum("eth_call", {"to": process.env.DPIGGY, "data": "0x18952383"}).then((result) => {
      const uints = parseDataToUint256(result);
      resolve(uints[0]);
    }).catch((err) => reject(err)); 
  });
};

const getDailyFees = () => {   
  return new Promise((resolve, reject) => { 
    return callEthereum("eth_getLogs", {"address": process.env.DPIGGY, "fromBlock": fromBlock, "topics": ["0xbea8678570aa50766eede67aba74adbe8d97b991e55e0ab5ff747f5352bc6ac5"]}, null).then((result) => {
      const response = [];
      for (let i = 0; i < result.length; ++i) {
        const uints = parseDataToUint256(result[i].data);
        if (i == 0) {
          response.push({
            blockNumber: parseInt(fromBlock, 16), 
            transactionIndex: 0, 
            logIndex: 0, 
            value: uints[1],
            type: "fee"
          }); 
        }
        response.push({
          blockNumber: parseInt(result[i].blockNumber, 16), 
          transactionIndex: parseInt(result[i].transactionIndex, 16), 
          logIndex: parseInt(result[i].logIndex, 16), 
          value: uints[0],
          type: "fee"
        }); 
      }
      if (response.length == 0) {
        getCurrentDailyFee().then((result) => {
          resolve([{
            blockNumber: parseInt(fromBlock, 16), 
            transactionIndex: 0, 
            logIndex: 0, 
            value: result,
            type: "fee"
          }]); 
        }).catch((err) => reject(err)); 
      } else {
        resolve(response);
      }
    }).catch((err) => reject(err));
  });
};

const getTimesBetweenExecutions = (proxy, proxies) => {   
  return new Promise((resolve, reject) => { 
    return callEthereum("eth_getLogs", {"address": proxies, "fromBlock": fromBlock, "topics": ["0x02cdaecda588a94496925494b34a2e5229092cc4a25a39cbdd8f7951bae8deeb"]}, null).then((result) => {
      const response = [];
      for (let i = 0; i < result.length; ++i) {
        const uints = parseDataToUint256(result[i].data);
        if (i == 0) {
          response.push({
            blockNumber: parseInt(fromBlock, 16), 
            transactionIndex: 0, 
            logIndex: 0, 
            value: uints[1],
            type: "timeBetweenExecutions"
          }); 
        }
        response.push({
          blockNumber: parseInt(result[i].blockNumber, 16), 
          transactionIndex: parseInt(result[i].transactionIndex, 16), 
          logIndex: parseInt(result[i].logIndex, 16), 
          value: uints[0],
          type: "timeBetweenExecutions"
        }); 
      }
      if (response.length == 0) {
        getCurrentTimeBetweenExecutions(proxy).then((result) => {
          resolve([{
            blockNumber: parseInt(fromBlock, 16), 
            transactionIndex: 0, 
            logIndex: 0, 
            value: result,
            type: "timeBetweenExecutions"
          }]); 
        }).catch((err) => reject(err)); 
      } else {
        resolve(response);
      }
    }).catch((err) => reject(err));
  });
};

const getCreationAssetTime = (asset) => {   
  return new Promise((resolve, reject) => { 
    return callEthereum("eth_getLogs", {"address": process.env.DPIGGY, "fromBlock": fromBlock, "topics": ["0xbee54d4e64c43aa227bfbfa0f46c56a830f0fd66482f623b827711b319edc8a0","0x"+addressToData(asset)]}, null).then((result) => {
      getBlockTimestamp(parseInt(result[0].blockNumber, 16)).then((time) => resolve(time)).catch((err) => reject(err));
    }).catch((err) => reject(err));
  });
};

const isCompoundProxy = (proxy) => {   
  return new Promise((resolve, reject) => {
    return callEthereum("eth_call", {"to": proxy, "data": "0x1dc7a314"}).then((result) => {
      const uints = parseDataToUint256(result);
      resolve(uints[0] === BigInt(1));
    }).catch((err) => reject(err)); 
  });
};

const parseDataToUint256 = (data) => {
  const pureData = data.substring(2);
  const size = 64;
  const numChunks = Math.ceil(pureData.length / size);
  const uints = [];
  for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
    uints[i] = BigInt("0x" + pureData.substring(o, o + size));
  }
  return uints;
};

const getMinimumTimeForNextExecution = (asset) => {   
  return new Promise((resolve, reject) => { 
    return callEthereum("eth_call", {"to": process.env.DPIGGY, "data": "0x5a5cd6eb" + addressToData(asset)}).then((result) => {
      if (result) {
        resolve(Web3Utils.hexToNumber(result));
      } else {
        reject("Cannot read getMinimumTimeForNextExecution from: " + process.env.DPIGGY + " asset " + asset);
      }
    }).catch((err) => reject(err));
  });
};

const compareTo = (a, b) => {
  if (a.blockNumber > b.blockNumber) return 1;
  else if (a.blockNumber < b.blockNumber) return -1;
  else if (a.transactionIndex > b.transactionIndex) return 1;
  else if (a.transactionIndex < b.transactionIndex) return -1;
  else if (a.logIndex > b.logIndex) return 1;
  else if (a.logIndex < b.logIndex) return -1;
  else return 0;
};

const checkProxy = (asset, proxy, allProxies, percentagePrecision, dailyFees, escrows) => {
  return new Promise((resolve, reject) => { 
    Promise.all([
      isCompoundProxy(proxy), 
      getCreationAssetTime(asset),
      getTimesBetweenExecutions(proxy, allProxies), 
      getUserProxyData(allProxies), 
      getExecutions(proxy, allProxies)
    ]).then((result) => {
      const isCompound = result[0]; 
      const data = result[2].concat(result[3]).concat(result[4]).concat(dailyFees).concat(escrows);
      data.sort((a, b) => compareTo(a, b));
      let dailyFee = BigInt(0);
      let timeBetweenExecutions = BigInt(0);
      let totalBalance = BigInt(0);
      let totalEscrowed = BigInt(0);
      let executions = [{
        time: result[1],
        rate: percentagePrecision,
        totalDai: BigInt(0),
        totalRedeemed: BigInt(0),
        totalBalance: BigInt(0),
        totalFeeDeduction: BigInt(0),
        feeAmount: BigInt(0)
      }];
      let userData = {};
      let userEscrow = {};
      let totalBalanceDifferenceNormalized = {};
      let feeDifferenceNormalized = {};
      let feeExemption = {};
      let remainingValue = {};
      let msg = [("<h1>ASSET " + asset + "</h1>")];
      for (let i = 0; i < data.length; ++i) {
        let executionId = executions.length - 1;
        let lastExecution = executions[executionId];
        if (data[i].type == "fee") {
          dailyFee = data[i].value;
        } else if (data[i].type == "timeBetweenExecutions") {
          timeBetweenExecutions = data[i].value;
        } else if (data[i].type == "deposit") {
          let normalizedDifference = _getNormalizedDifference(data[i].amount, data[i].rate, lastExecution.rate);
          let currentWeight = data[i].amount * percentagePrecision / data[i].rate;
          
          let baseExecutionAmountForFee = BigInt(0);
          if (userEscrow[data[i].user]) {
            totalEscrowed += data[i].amount;
            _setValueOnMap(feeDifferenceNormalized, true, executionId+1, normalizedDifference);
          } else {
            baseExecutionAmountForFee = _getNextExecutionFeeProportion(data[i].amount, timeBetweenExecutions, lastExecution.time, data[i].time, dailyFee, percentagePrecision);
            _setValueOnMap(feeExemption, true, executionId+1, data[i].amount - baseExecutionAmountForFee);
            _setValueOnMap(feeDifferenceNormalized, true, executionId+1, _getNormalizedDifference(data[i].amount - baseExecutionAmountForFee, data[i].rate, lastExecution.rate));
          }
          _assertValues(msg, data[i].user + " deposit", "baseExecutionAmountForFee", baseExecutionAmountForFee, data[i].baseExecutionAmountForFee);

          if (!userData[data[i].user]) {
            userData[data[i].user] = {
              previousProfit: BigInt(0),
              previousAssetAmount: BigInt(0),
              previousFeeAmount: BigInt(0),
              previousAllocated: BigInt(0),
              currentAllocated: data[i].amount,
              baseExecutionAmountForFee: baseExecutionAmountForFee,
              baseExecutionAccumulatedAmount: data[i].amount,
              baseExecutionAccumulatedWeightForRate: currentWeight,
              baseExecutionAvgRate: data[i].rate,
              baseExecutionId: executionId,
              redeemed: BigInt(0)
            };
          } else if (userData[data[i].user].baseExecutionId == executionId) {
            userData[data[i].user].baseExecutionAmountForFee += baseExecutionAmountForFee;
            userData[data[i].user].baseExecutionAccumulatedAmount += data[i].amount;
            userData[data[i].user].baseExecutionAccumulatedWeightForRate += currentWeight;
            userData[data[i].user].baseExecutionAvgRate = userData[data[i].user].baseExecutionAccumulatedAmount * percentagePrecision / userData[data[i].user].baseExecutionAccumulatedWeightForRate;
            userData[data[i].user].currentAllocated += data[i].amount;
          } else {
            userData[data[i].user].baseExecutionAmountForFee = baseExecutionAmountForFee;
            userData[data[i].user].baseExecutionAccumulatedAmount = data[i].amount;
            userData[data[i].user].baseExecutionAccumulatedWeightForRate = currentWeight;
            userData[data[i].user].baseExecutionAvgRate = data[i].rate;
            userData[data[i].user].baseExecutionId = executionId;
            userData[data[i].user].previousAllocated = userData[data[i].user].currentAllocated;
            userData[data[i].user].currentAllocated += data[i].amount;
          }

          _setValueOnMap(totalBalanceDifferenceNormalized, true, executionId+1, normalizedDifference);
          totalBalance += data[i].amount;

        } else if (data[i].type == "addEscrow") {
          userEscrow[data[i].user] = true;
          if (userData[data[i].user]) {
            totalEscrowed += userData[data[i].user].currentAllocated;

            if (userData[data[i].user].baseExecutionId == executionId) {
              const amountWithFeeExemption = userData[data[i].user].baseExecutionAccumulatedAmount - userData[data[i].user].baseExecutionAmountForFee;
              const currentFeeNormalized = _getNormalizedDifference(amountWithFeeExemption, userData[data[i].user].baseExecutionAvgRate, lastExecution.rate);
              const allAmountNormalized = _getNormalizedDifference(userData[data[i].user].baseExecutionAccumulatedAmount, userData[data[i].user].baseExecutionAvgRate, lastExecution.rate)
              
              _setValueOnMap(feeExemption, false, executionId+1, amountWithFeeExemption);
              _setValueOnMap(feeDifferenceNormalized, true, executionId+1, allAmountNormalized - currentFeeNormalized);
              userData[data[i].user].baseExecutionAmountForFee = BigInt(0); 
            }
          }
        } else if (data[i].type == "removeEscrow") {
          userEscrow[data[i].user] = false;
        } else if (data[i].type == "redeem") {
          if (userData[data[i].user].previousAssetAmount > 0) {
            let amount = userData[data[i].user].previousAssetAmount - userData[data[i].user].redeemed;
            userData[data[i].user].redeemed += amount;
            _assertValues(msg, data[i].user + " reddem", "amount", amount, data[i].amount);
          }
        } else if (data[i].type == "execution") {
          let nextId = executionId + 1;
          
          _assertValues(msg, nextId + " execution", "totalBalance", totalBalance, data[i].totalBalance);

          let totalFeeDeduction = totalEscrowed + _getValueOnMap(feeExemption, nextId);
          _assertValues(msg, nextId + " execution", "totalFeeDeduction", totalFeeDeduction, data[i].totalFeeDeduction);

          let rate = _getRateForExecution(data[i].totalDai, lastExecution, isCompound, totalBalance, remainingValue, totalBalanceDifferenceNormalized, nextId);
          _assertValues(msg, nextId + " execution", "rate", rate, data[i].rate);

          let totalRedeemed = data[i].totalDai - totalBalance;
          let remainingProfit = BigInt(0);
          if (isCompound) {
            remainingProfit = _getRemainingExecutionProfit(lastExecution, remainingValue, nextId);
            totalRedeemed -= remainingProfit;
          }
          
          let amountWithFee = totalBalance - totalFeeDeduction;
          let feeAmount = BigInt(0);
          if (amountWithFee > 0) {
            feeAmount = amountWithFee * _executionFee(data[i].time - lastExecution.time, dailyFee, percentagePrecision) / percentagePrecision;
            if (totalFeeDeduction > 0) {
              let amountNoFee = totalFeeDeduction + remainingProfit;
              let feeAmountRate = amountNoFee * lastExecution.rate / (amountNoFee - _getValueOnMap(feeDifferenceNormalized, nextId));
              let maxFeeAmount = totalRedeemed - _calculatetAccruedInterest(amountNoFee, rate, feeAmountRate);
              if (feeAmount > maxFeeAmount) {
                feeAmount = maxFeeAmount;
              }
            } else if (feeAmount > totalRedeemed) {
              feeAmount = totalRedeemed;
            }
          }
          _assertValues(msg, nextId + " execution", "feeAmount", feeAmount, data[i].feeAmount);

          let totalRedeemedToCheck = totalRedeemed;
          if (isCompound) {
            totalRedeemed = feeAmount;
          }
          _assertValues(msg, nextId + " execution", "totalRedeemed", totalRedeemed, data[i].totalRedeemed);

          executions.push({
            time: data[i].time,
            rate: rate,
            totalDai: data[i].totalDai,
            totalRedeemed: totalRedeemed,
            totalBalance: totalBalance,
            totalFeeDeduction: totalFeeDeduction,
            feeAmount: feeAmount
          });

          let totalProfit = BigInt(0);
          let totalFee = BigInt(0);
          let totalAssetProfit = BigInt(0);
          if (data[i].totalDai > 0) {
            for (let user in userData) {
              let remainingBalance = BigInt(0);
              if (isCompound) {
                remainingBalance = userData[user].previousProfit - userData[user].previousFeeAmount;
              }
              let userProfit = _getAccruedInterestForExecution(executionId, lastExecution.rate, rate, remainingBalance, userData[user]);
              userData[user].previousProfit += userProfit;
              totalProfit += userProfit;

              let userFeeAmount = BigInt(0);
              if (!userEscrow[user] && feeAmount > 0) {
                userFeeAmount = _getFeeAmountForExecution(userData[user].baseExecutionId == executionId, feeAmount, totalBalance - totalFeeDeduction, userData[user]);
                if (userFeeAmount > userProfit) {
                  userFeeAmount = userProfit;
                }
                userData[user].previousFeeAmount += userFeeAmount;
                totalFee += userFeeAmount;
              }

              if (isCompound) {
                remainingBalance += userProfit - userFeeAmount;
              }
            
              if ((totalRedeemed - feeAmount) > 0) {
                let userAssetProfit = (userProfit - userFeeAmount) * data[i].totalBought / (totalRedeemed - feeAmount);
                userData[user].previousAssetAmount += userAssetProfit;
                totalAssetProfit += userAssetProfit;
              }
            }
          }
          _assertValues(msg, nextId + " execution", "totalUsersProfit", totalProfit, totalRedeemedToCheck);
          _assertValues(msg, nextId + " execution", "totalUsersFeeAmount", totalFee, feeAmount);
          _assertValues(msg, nextId + " execution", "totalUsersAssetProfit", totalAssetProfit, data[i].totalBought);
        } else if (data[i].type == "finish") {
          if (isCompound) {
            _setValueOnMap(remainingValue, true, userData[data[i].user].previousProfit - userData[data[i].user].previousFeeAmount);
          }
          
          _assertValues(msg, data[i].user + " finish", "totalRedeemed", userData[data[i].user].currentAllocated + data[i].yield, data[i].totalRedeemed);
          
          totalBalance -= userData[data[i].user].currentAllocated;
          
          if (userData[data[i].user].baseExecutionId == executionId) {
            let normalizedDifference = _getNormalizedDifference(userData[data[i].user].baseExecutionAccumulatedAmount, userData[data[i].user].baseExecutionAvgRate, lastExecution.rate);
            _setValueOnMap(totalBalanceDifferenceNormalized, false, executionId+1, normalizedDifference);
            
            if (userEscrow[data[i].user]) {
              _setValueOnMap(feeDifferenceNormalized, false, executionId+1, normalizedDifference);
            } else {
              let amountWithFeeExemption = userData[data[i].user].baseExecutionAccumulatedAmount - userData[data[i].user].baseExecutionAmountForFee;
              _setValueOnMap(feeExemption, false, executionId+1, amountWithFeeExemption);
              _setValueOnMap(feeDifferenceNormalized, false, executionId+1, _getNormalizedDifference(amountWithFeeExemption, userData[data[i].user].baseExecutionAvgRate, lastExecution.rate));
            }
          }
          
          if (userEscrow[data[i].user]) {
            totalEscrowed -= userData[data[i].user].currentAllocated;
          }  

          delete userData[data[i].user];
        }
      }
      
      const userPromises = [];
      const userProfitsPromises = [];
      const users = Object.keys(userData);
      for (let j = 0; j < users.length; ++j) {
        userPromises.push(getCurrentUserData(proxy, users[j]));
        userProfitsPromises.push(getUserProfitsAndFeeAmount(proxy, users[j]));
      }
      Promise.all(userPromises).then((usersDataResponse) =>
      {
        Promise.all(userProfitsPromises).then((usersProfitResponse) =>
        {
          let calcTotalUsersAssetProfit = BigInt(0);
          for (let k = 0; k < users.length; ++k) {
            _assertValues(msg, users[k] + " userData", "previousAllocated", userData[users[k]].previousAllocated, usersDataResponse[k].previousAllocated);
            _assertValues(msg, users[k] + " userData", "baseExecutionAmountForFee", userData[users[k]].baseExecutionAmountForFee, usersDataResponse[k].baseExecutionAmountForFee);
            _assertValues(msg, users[k] + " userData", "baseExecutionAccumulatedAmount", userData[users[k]].baseExecutionAccumulatedAmount, usersDataResponse[k].baseExecutionAccumulatedAmount);
            _assertValues(msg, users[k] + " userData", "baseExecutionAccumulatedWeightForRate", userData[users[k]].baseExecutionAccumulatedWeightForRate, usersDataResponse[k].baseExecutionAccumulatedWeightForRate);
            _assertValues(msg, users[k] + " userData", "baseExecutionAvgRate", userData[users[k]].baseExecutionAvgRate, usersDataResponse[k].baseExecutionAvgRate);
            _assertValues(msg, users[k] + " userData", "baseExecutionId", userData[users[k]].baseExecutionId, usersDataResponse[k].baseExecutionId);
            _assertValues(msg, users[k] + " userData", "redeemed", userData[users[k]].redeemed, usersDataResponse[k].redeemed);

            _assertValues(msg, users[k] + " userProfitsAndFee", "profit", userData[users[k]].previousProfit, usersProfitResponse[k].userProfit);
            _assertValues(msg, users[k] + " userProfitsAndFee", "assetProfit", userData[users[k]].previousAssetAmount, usersProfitResponse[k].userAssetProfit);
            _assertValues(msg, users[k] + " userProfitsAndFee", "feeAmount", userData[users[k]].previousFeeAmount, usersProfitResponse[k].userFeeAmount);

            calcTotalUsersAssetProfit += userData[users[k]].previousAssetAmount - userData[users[k]].redeemed;
          }

          if (asset == "0x0000000000000000000000000000000000000000") {
            getEthBalance(proxy).then((balance) => {
              _assertValues(msg, "asset balance", "ether", calcTotalUsersAssetProfit, balance);
              resolve(msg.join(""));
            }).catch((err) => reject(err));
          } else if (!isCompound) {
            getTokenBalance(asset, proxy).then((balance) => {
              _assertValues(msg, "asset balance", "token", calcTotalUsersAssetProfit, balance);
              resolve(msg.join(""));
            }).catch((err) => reject(err));
          } else {
            resolve(msg.join(""));
          }
        }).catch((err) => reject(err));
      }).catch((err) => reject(err));
    }).catch((err) => reject(err));
  });
};

const _assertValues = (msg, type, name, calculated, storage) => {
  const tolerance = BigInt(process.env.DIFFERENCE_TOLERANCE);
  const difference = calculated - storage;
  if (difference > tolerance || difference < (tolerance * -BigInt(1))) {
    msg.push("<p><b>" + type + "</b> => " + name + "<br/><table><tbody><tr><td>calculated</td><td>" + calculated.toString(10) + "</td></tr><tr><td>storaged</td><td>" + storage.toString(10) + "</td></tr><tr><td>difference</td><td>" + difference.toString(10) + "</td></tr></tbody></table></p>");
  }
};

const _setValueOnMap = (map, commit, executionId, value) => {
  const id = executionId.toString();
  if (!map[id]) {
    if (!commit) throw Error("Invalid data to set on map");
    map[id] = value;
  } else if (commit) {
    map[id] += value;
  } else {
    map[id] -= value;
  }
};

const _getValueOnMap = (map, executionId) => {
  const id = executionId.toString();
  if (!map[id]) {
    return BigInt(0);
  } else  {
    return map[id];
  }
};

const _getNormalizedDifference = (totalAmount, currentRate, previousRate) => {
  if (currentRate > previousRate) {
      return totalAmount - (totalAmount * previousRate / currentRate);
  } else {
      return BigInt(0);
  }
};

const _calculatetAccruedInterest = (amount, currentRate, previousRate) => {
  if (currentRate > previousRate) {
    return (amount * currentRate / previousRate) - amount;
  } else {
    return BigInt(0);
  }
};

const _getFeeAmountForExecution = (isBaseMonth, multiplier, denominator, userData) => {
  let regardedAmountWithFee = BigInt(0);
  if (isBaseMonth) {
    regardedAmountWithFee = userData.previousAllocated + userData.baseExecutionAmountForFee;
  } else {
    regardedAmountWithFee = userData.currentAllocated;
  }
  return regardedAmountWithFee * multiplier / denominator; 
};

const _getAccruedInterestForExecution = (lastExecutionId, lastExecutionRate, currentRate, compoundRemainingBalance, userData) => {
  let userAccruedInterest = BigInt(0);
  if (userData.baseExecutionId == lastExecutionId) {
    userAccruedInterest = _calculatetAccruedInterest(userData.baseExecutionAccumulatedAmount, currentRate, userData.baseExecutionAvgRate);
    if (userData.previousAllocated > 0) {
      userAccruedInterest = userAccruedInterest + _calculatetAccruedInterest(compoundRemainingBalance + userData.previousAllocated, currentRate, lastExecutionRate);
    }
  } else {
    userAccruedInterest = _calculatetAccruedInterest(compoundRemainingBalance + userData.currentAllocated, currentRate, lastExecutionRate);
  }
  return userAccruedInterest;
};

const _getRateForExecution = (amount, lastExecution, isCompound, totalBalance, remainingValue, totalBalanceDifferenceNormalized, nextId) => {
  let remainingBalance = BigInt(0);
  if (isCompound && lastExecution.totalDai > 0) {
    remainingBalance = _getRemainingExecutionProfit(lastExecution, remainingValue, nextId);
  }
  return amount * lastExecution.rate / (totalBalance + remainingBalance - _getValueOnMap(totalBalanceDifferenceNormalized, nextId));
};

const _getRemainingExecutionProfit = (lastExecution, remainingValue, nextId) => {
  return lastExecution.totalDai - lastExecution.totalBalance - lastExecution.totalRedeemed - _getValueOnMap(remainingValue, nextId);
};

const _getNextExecutionFeeProportion = (amount, timeBetweenExecutions, lastExecutionTime, currentTime, dailyFee, percentagePrecision) => {
  const nextExecutionTime = lastExecutionTime + timeBetweenExecutions;
  if (nextExecutionTime > currentTime) {
    const fullFee = _executionFee(nextExecutionTime - lastExecutionTime, dailyFee, percentagePrecision);
    if (fullFee > 0) {
      const proportionalFee = _executionFee(nextExecutionTime - currentTime, dailyFee, percentagePrecision);
      return proportionalFee * amount / fullFee;
    }
  }
  return BigInt(0);
};

const _executionFee = (baseTime, dailyFee, percentagePrecision) => {
  const daysAmount = Number(baseTime / BigInt(process.env.DAY_SECONDS));
  if (daysAmount == 0) {
    return BigInt(0);
  } else {
    let pow = percentagePrecision + dailyFee;
    const base = pow;
    for (let i = 1; i < daysAmount; ++i) {
      pow = (base * pow / percentagePrecision);
    }
    return pow - percentagePrecision;
  }
};

module.exports.executeCompoundRedeem = () => {   
  return new Promise((resolve, reject) => { 
    getAssets().then((assets) => {
      if (assets.length > 0) {
        getAssetsToProcess(assets).then((assetsToProcess) => {
          if (assetsToProcess.length > 0) {
            checkExecutorEthBalance().then(() => {
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

module.exports.check = () => {   
  return new Promise((resolve, reject) => { 
    getAssets().then((assets) => {
      if (assets.length > 0) {
        getAssetsProxy(assets).then((proxies) => {
          if (proxies.length > 0) {
            Promise.all([getPercentagePrecision(), getDailyFees(), getEscrows()]).then((result) => {
              const promises = [];
                for (let i = 0; i < proxies.length; ++i) {
                  promises.push(checkProxy(proxies[i].asset, proxies[i].proxy, proxies[i].all, result[0], result[1], result[2]));
                }
              Promise.all(promises).then((response) => resolve("<html><body>"+ response.join("<br/><br/>") + "</body></html>")).catch((err) => reject(err)); 
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