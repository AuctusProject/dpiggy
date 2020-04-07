import { formatFixedDecimals, formatSignificant } from '@uniswap/sdk';
import Web3Utils from 'web3-utils'

export const cDaiAddress = process.env.REACT_APP_CDAI_ADDRESS; 
export const daiAddress = process.env.REACT_APP_DAI_ADDRESS; 
export const aucAddress = process.env.REACT_APP_AUC_ADDRESS;
export const dPiggyAddress = process.env.REACT_APP_DPIGGY_ADDRESS; 
export const CHAIN_ID = process.env.REACT_APP_CHAIN_ID; 
export const availableCoins = JSON.parse(process.env.REACT_APP_AVAILABLE_COINS); 
export const daiInfo = JSON.parse(process.env.REACT_APP_DAI_INFO);
export const etherscanUrl = process.env.REACT_APP_ETHERSCAN_URL;

export const ethTransactionTolerance = 0.01;
export const coingeckoApiUrl = "https://api.coingecko.com/api/v3/simple/price?ids={COINGECKO_IDS}&vs_currencies=usd";
export const compoundApiUrl = "https://api.compound.finance/api/v2/ctoken?addresses={CDAI_ADDRESS}&network={NETWORK}";
export const cDAI_CODE = "cDAI";
export const GAS_LIMIT_FOR_EACH_TOKEN_DEPOSIT = 900000;
export const ONE_SECOND = 1000;
export const ONE_MINUTE = ONE_SECOND * 60;

export function formatPercentage(percentage, decimals = 2) {
    return (percentage * 100).toFixed(decimals) + "%"
}

export function getUnixNow() {
    return parseInt(new Date().getTime()/ONE_SECOND)
}

export function formatBigNumberToDecimals(bigNumber, decimals, decimalPlaces = 4) {
    return formatFixedDecimals(bigNumber, decimals, { decimalPlaces: decimalPlaces })
}

export function convertBigNumberToFloat(bigNumber) {
    if (typeof bigNumber == "object") {
        return parseFloat(Web3Utils.fromWei(bigNumber.toString(), 'ether'))
    }
    return parseFloat(bigNumber)
}

export function convertBigNumberToString(bigNumber) {
    if (typeof bigNumber == "object") {
        return Web3Utils.fromWei(bigNumber.toString(), 'ether')
    }
    return bigNumber
}

export function formatWithSignificantDigits(bigNumber, significantDigits = 4, round = false) {
    if (typeof bigNumber == "object") {
        return convertBigNumberToString(bigNumber)
    }
    else {
        if (bigNumber < 0.01) {
            return formatSignificant(bigNumber, { significantDigits: significantDigits })
        }
        else {
            if (round) {
                return (Math.round(bigNumber * 100) / 100).toFixed(2)
            }
            else {
                return (Math.floor(bigNumber * 100) / 100).toFixed(2)
            }
        }
    }
}

export function convertBigNumberToDecimals(bigNumber, decimals) {
    return parseInt(bigNumber)/Math.pow(10, decimals)
}

export function getNetworkName(chainId) {
    if (chainId === "4") {
        return "rinkeby"
    }
    return "mainnet"
}

export const getDecimalSeparator = () => {
    var decSep = ".";
    try {
        var sep = parseFloat(0.5).toLocaleString().substring(1,2);
        if (sep === '.' || sep === ',') {
            decSep = sep;
        }
    } catch(e){}
    return decSep;
}

export const getThousandSeparator = () => {
    var decSep = getDecimalSeparator()
    if (decSep === ',') {
        return '.'
    }
    return ','
}

export const formattedFloatValue = (number, digits = 18) => {
    var roundFactor = 1
    for (var i = 0; i < digits; ++i) {
        roundFactor = roundFactor * 10
    }
    return (Math.round(number * roundFactor) / roundFactor)
}

export const formattedValue = (number, prefix = "$", digits = 0, maximumDigits = 18, hideThousandSeparators = false) => {
    var formattedValue = formattedFloatValue(number, maximumDigits)
    var negativePrefix = ""
    if (formattedValue < 0) {
        negativePrefix = "-"
        formattedValue = Math.abs(formattedValue)
    }
    var result = negativePrefix + prefix + formattedValue.toLocaleString(undefined, {minimumFractionDigits: digits, maximumFractionDigits: maximumDigits})
    if (hideThousandSeparators) { 
        var thousandSep = getThousandSeparator()
        while (result.includes(thousandSep)) {
            result = result.replace(thousandSep, "")
        }
    }
    return result
}

export const ellipsisCenterOfUsername = (username) => {
    if (username && username.length > 10) {
      return username.substring(0, 6) + "..." + username.substring(username.length - 4, username.length)
    }
    return username
}