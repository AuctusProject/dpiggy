import { getWeb3, allowDeposit, sendTransactionWithNonce, sendTransaction } from './web3Methods'
import { dPiggyAddress, availableCoins, getUnixNow, convertBigNumberToDecimals, daiInfo, daiAddress, GAS_LIMIT_FOR_EACH_TOKEN_DEPOSIT } from './constants';
import { dPiggyABI } from './dpiggyABI';
import { transferFrom } from './auctusMethods';
import Web3Utils from 'web3-utils'

var dPiggyContract = null
function getdPiggyContract() {
    if (dPiggyContract == null) {
        const _web3 = getWeb3()
        if (_web3) {
            dPiggyContract = new _web3.eth.Contract(dPiggyABI, dPiggyAddress)
        }
    }
    return dPiggyContract
}

export function checkAucEscrowValue() {
    return new Promise(function(resolve, reject){
        const dPiggyContract = getdPiggyContract()
        dPiggyContract.methods.minimumAucToFreeFee().call().then(result => {
            resolve(Web3Utils.toBN(result))
        })
    })
}

export function getUserEscrowStart(userAddress) {
    return new Promise(function(resolve, reject){
        const dPiggyContract = getdPiggyContract()
        dPiggyContract.methods.escrowStart(userAddress).call().then(result => {
            resolve(result)
        })
    })
}

export function getUserTotalInvested(assetCode, userAddress) {
    return new Promise(function(resolve, reject){
        const dPiggyContract = getdPiggyContract()
        const assetDetails = availableCoins[assetCode]
        dPiggyContract.methods.getUserTotalInvested(assetDetails.address, userAddress).call().then(result => {
            resolve(convertBigNumberToDecimals(result, daiInfo.decimals))
        })
    })
}

export function getUserEstimatedCurrentProfitWithoutFee(assetCode, userAddress) {
    return new Promise(function(resolve, reject){
        const dPiggyContract = getdPiggyContract()
        const assetDetails = availableCoins[assetCode]
        dPiggyContract.methods.getUserEstimatedCurrentProfitWithoutFee(assetDetails.address, userAddress).call().then(result => {
            resolve(convertBigNumberToDecimals(result, daiInfo.decimals))
        })
    })
}

export function getUserEstimatedCurrentFee(assetCode, userAddress) {
    return new Promise(function(resolve, reject){
        const dPiggyContract = getdPiggyContract()
        const assetDetails = availableCoins[assetCode]
        dPiggyContract.methods.getUserEstimatedCurrentFee(assetDetails.address, userAddress, getUnixNow()).call().then(result => {
            resolve(convertBigNumberToDecimals(result, daiInfo.decimals))
        })
    })
}

export function getUserProfitsAndFeeAmount(assetCode, userAddress) {
    return new Promise(function(resolve, reject){
        const dPiggyContract = getdPiggyContract()
        const assetDetails = availableCoins[assetCode]
        dPiggyContract.methods.getUserProfitsAndFeeAmount(assetDetails.address, userAddress).call().then(result => {
            resolve([convertBigNumberToDecimals(result[0], daiInfo.decimals), convertBigNumberToDecimals(result[1], assetDetails.decimals), convertBigNumberToDecimals(result[2], daiInfo.decimals)])
        })
    })
}

export function getUserAssetRedeemed(from, assetCode) {
    return new Promise(function(resolve, reject){
        const dPiggyContract = getdPiggyContract()
        const assetDetails = availableCoins[assetCode]
        dPiggyContract.methods.getUserAssetRedeemed(assetDetails.address, from).call().then(result => {
            resolve(convertBigNumberToDecimals(result, assetDetails.decimals))
        })
    })
}

export function getMinimumTimeForNextExecution(assetCode) {
    return new Promise(function(resolve, reject){
        const dPiggyContract = getdPiggyContract()
        const assetDetails = availableCoins[assetCode]
        dPiggyContract.methods.getMinimumTimeForNextExecution(assetDetails.address).call().then(result => {
            resolve(result)
        })
    })
}

export function getPercentagePrecision() {
    return new Promise(function(resolve, reject){
        const dPiggyContract = getdPiggyContract()
        dPiggyContract.methods.percentagePrecision().call().then(result => {
            resolve(result)
        })
    })
}

export function getMinimumDeposit() {
    return new Promise(function(resolve, reject){
        const dPiggyContract = getdPiggyContract()
        dPiggyContract.methods.getMinimumDeposit(availableCoins.ETH.address).call().then(result => {
            resolve(convertBigNumberToDecimals(result, daiInfo.decimals))
        })
    })
}

export function getDailyFee() {
    return new Promise(function(resolve, reject){
        const dPiggyContract = getdPiggyContract()
        var promises = []
        promises.push(getPercentagePrecision())
        promises.push(dPiggyContract.methods.dailyFee().call())
        Promise.all(promises).then(result => {
            resolve(result[1]/result[0])
        })
    })
}

export function allowDpiggySpendDai(from, value, nonce) {
    return allowDeposit(from, value, daiAddress, dPiggyAddress, nonce)
}

export function sendDeposit(from, token, percentage, nonce) {
    const dPiggyContract = getdPiggyContract()
    var data = dPiggyContract.methods.deposit(token, percentage).encodeABI()
    var gasLimit = token.length * GAS_LIMIT_FOR_EACH_TOKEN_DEPOSIT
    return sendTransactionWithNonce(null, gasLimit, from, dPiggyAddress, null, data, null, nonce)
}

export function estimateGasAndSendTransaction(method, tokenLength, from, data) {
    return new Promise((resolve, reject) => {
        method.estimateGas({from: from}).then(estimatedGas => {
            var gasLimit = parseInt((estimatedGas + (18000 * tokenLength)) * 1.5)
            sendTransaction(null, gasLimit, from, dPiggyAddress, null, data).then(result => resolve(result)).catch(e => reject(e))
        })
    })
}

export function redeem(from, token) {
    const dPiggyContract = getdPiggyContract()
    var redeemMethod = dPiggyContract.methods.redeem([token])
    var data = redeemMethod.encodeABI()
    return estimateGasAndSendTransaction(redeemMethod, 1, from, data)
    
}

export function finish(from, token) {
    const dPiggyContract = getdPiggyContract()
    var finishMethod = dPiggyContract.methods.finish([token])
    var data = finishMethod.encodeABI()
    return estimateGasAndSendTransaction(finishMethod, 1, from, data)
}

export function finishAll(from, investedTokensLength) {
    const dPiggyContract = getdPiggyContract()
    var finishAllMethod = dPiggyContract.methods.finishAll()
    var data = finishAllMethod.encodeABI()
    return estimateGasAndSendTransaction(finishAllMethod, investedTokensLength, from, data)
}

export function sendEscrow(from, value) {
    return transferFrom(from, dPiggyAddress, value)
}