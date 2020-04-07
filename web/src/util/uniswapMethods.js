import { getWeb3, sendTransaction } from './web3Methods'
import { daiAddress, aucAddress, CHAIN_ID, formatBigNumberToDecimals, getUnixNow } from './constants'
import { getMarketDetails, getTradeDetails, getTokenReserves, BigNumber, EXCHANGE_ABI } from '@uniswap/sdk'

const exchangeABI = JSON.parse(EXCHANGE_ABI)


export function getEthToTokenExchangeData(userInputEthValue, inputType, tokenAddress) {
    return new Promise(function(resolve, reject){
        if (userInputEthValue > 0) {
            const _decimals = 18
            const tradeAmount = new BigNumber(userInputEthValue).multipliedBy(10 ** _decimals)
            getTokenReserves(tokenAddress, parseInt(CHAIN_ID)).then(reserves => {
                const marketDetails = getMarketDetails(undefined, reserves)
                const tradeDetails = getTradeDetails(inputType, tradeAmount, marketDetails)
                var inputAmount = formatBigNumberToDecimals(tradeDetails.inputAmount.amount, tradeDetails.inputAmount.token.decimals)
                var outputAmount = formatBigNumberToDecimals(tradeDetails.outputAmount.amount, tradeDetails.outputAmount.token.decimals)
                resolve({ userInputEthValue:userInputEthValue, inputAmount: inputAmount, outputAmount: outputAmount, rate: tradeDetails.executionRate.rate.toNumber(), tradeDetails: tradeDetails })
            })
        }
        else {
            resolve({ userInputEthValue:userInputEthValue, inputAmount: 0, outputAmount: 0 })
        }
    })
}

export function getEthToDaiExchangeData(userInputEthValue, inputType) {
    return getEthToTokenExchangeData(userInputEthValue, inputType, daiAddress)
}

export function getEthToAucExchangeData(userInputEthValue, inputType) {
    return getEthToTokenExchangeData(userInputEthValue, inputType, aucAddress)
}


export function swap(from, tradeDetails, eth, tokens) {
    const _web3 = getWeb3()
    var exchangeAddress = tradeDetails.marketDetailsPre.outputReserves.exchange.address
    const exchangeContract = new _web3.eth.Contract(exchangeABI, exchangeAddress)    
    var methodName = null
    if (tradeDetails.tradeExact === "INPUT") {
        methodName = "ethToTokenSwapInput"
    }
    else {
        methodName = "ethToTokenSwapOutput"
    }
    var amountParam = tradeDetails.outputAmount.amount.toFixed(0)
    var value = parseInt(tradeDetails.inputAmount.amount.toFixed(0))
    if (tradeDetails.tradeExact === "INPUT") {
        amountParam = parseInt(parseInt(amountParam) * 0.995).toString()
    }
    else {
        value = parseInt(value * 1.005)
    }
    var deadline = getUnixNow() + (15 * 60)
    var data = exchangeContract.methods[methodName](amountParam, deadline).encodeABI()
    return sendTransaction(null, null, from, exchangeAddress, value, data)
}