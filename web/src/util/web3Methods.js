import Web3Utils from 'web3-utils'
import Web3 from 'web3'
import { daiAddress, aucAddress } from './constants'
import { erc20ABI } from './erc20ABI'
import '@metamask/legacy-web3'

var _web3 = null
export function getWeb3() {
    if (_web3 == null && window.web3 && window.web3.currentProvider) {
        _web3 = new Web3(window.web3.currentProvider)
    }
    return _web3
}

export function connectMetamask() {
    return new Promise(function (resolve, reject) {
        const web3 = getWeb3()
        if (web3) {
            web3.currentProvider.enable()
                .then(accounts => resolve(accounts))
                .catch((err) => reject(err))
        }
        else {
            reject()
        }
    })
}

export function checkAucBalanceOf(address) {
    return getTokenBalance(aucAddress, address)
}

export function checkDaiBalanceOf(address) {
    return getTokenBalance(daiAddress, address)
}

export function checkEthBalanceOf(address) {    
    return new Promise(function (resolve, reject) {
        getWeb3().eth.getBalance(address, function (err, result) {
            if (result) {
                var tokensBN = Web3Utils.toBN(result)
                //var tokensEther = Web3Utils.fromWei(tokens, 'ether')
                resolve(tokensBN)
            }
            else {
                resolve(0)
            }
        })
    })
}

export function getTokenBalance(tknContractAddress, accountAddrs) {
    return new Promise(function (resolve, reject) {
        const _web3 = getWeb3()
        const exchangeContract = new _web3.eth.Contract(erc20ABI, tknContractAddress)
        var data = exchangeContract.methods.balanceOf(accountAddrs).encodeABI()
        _web3.eth.call({
            to: tknContractAddress,
            data: data
        }, function (err, result) {
            if (result) {
                var tokensBN = Web3Utils.toBN(result)
                // tokensBN.toString()
                // var tokensEther = Web3Utils.fromWei(tokens, 'ether')
                // var tokensBN = Web3Utils.toBN(tokensEther)
                resolve(tokensBN)
            }
            else {
                resolve(0)
            }
        })
    })
}

export function allowDeposit(from, value, token, to, nonce) {
    const _web3 = getWeb3()
    const tokenContract = new _web3.eth.Contract(erc20ABI, token)
    var weiValue = Web3Utils.toWei(value.toString(), 'ether')
    var data = tokenContract.methods.approve(to, weiValue).encodeABI()
    return sendTransactionWithNonce(null, null, from, token, null, data, null, nonce)
}

export function getNextNonce(from) {
    return new Promise(function (resolve, reject) {
        getWeb3().eth.getTransactionCount(from, (err, result) => {
            if (err) reject(err)
            else {
                resolve(result)
            }
        })
    })
}

export function sendTransaction(gasPrice, gasLimit, from, to, value, data, chainId) {
    return new Promise(function (resolve, reject) {
        getNextNonce(from).then(result => {
            sendTransactionWithNonce(gasPrice, gasLimit, from, to, value, data, chainId, result).then(result => resolve(result))
        })
    })
}

export function sendTransactionWithNonce(gasPrice, gasLimit, from, to, value, data, chainId, nonce) {
    const gasPriceWei = gasPrice ? Web3Utils.toWei(gasPrice.toString(), 'gwei') : null
    return new Promise(function (resolve, reject) {        
        var transactionObj = {
            nonce: Web3Utils.toHex(nonce),
            gasPrice: Web3Utils.toHex(gasPriceWei),
            gasLimit: Web3Utils.toHex(gasLimit),
            from: from,
            to: to,
            value: Web3Utils.toHex(value),
            data: data,
            chainId: Web3Utils.toHex(chainId)
        };

        getWeb3().eth.sendTransaction(transactionObj, function (err, result) {
            resolve(result);
        })
    })
}

function isTransactionMined(hash) {
    return new Promise(function (resolve, reject) {
        getWeb3().eth.getTransactionReceipt(hash, function (err, receipt) {
            if (receipt && receipt.blockNumber) {
                resolve(receipt)
            }
            else {
                resolve(null)
            }
        })
    })
}

function checkTransactionTimeout(transactionHash, onMined) {
    setTimeout(() => {
        isTransactionMined(transactionHash).then(result => {
            if (result) {
                setTimeout(() => onMined(result.status), 5000)
            }
            else {
                checkTransactionTimeout(transactionHash, onMined)
            }
        })
    }, 1000)
}

export function checkTransactionIsMined(transactionHash) {
    return new Promise(function(resolve, reject){
        checkTransactionTimeout(transactionHash, (result) => resolve(result))
    })
}