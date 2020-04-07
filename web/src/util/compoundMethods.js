import { cDaiAddress, compoundApiUrl, getNetworkName, CHAIN_ID } from './constants'
import { getWeb3 } from './web3Methods'
import { cTokenABI } from './cTokenABI'
import Axios from 'axios'

export function checkDaiSupplyRate() {
    return new Promise(function(resolve, reject){
        const _web3 = getWeb3()
        const cDaiContract = new _web3.eth.Contract(cTokenABI, cDaiAddress)
        cDaiContract.methods.supplyRatePerBlock().call().then(rate => {
            var calculatedAnnualRate = Math.pow(1+rate*1e-18, 2102400)-1
            resolve(calculatedAnnualRate)
        })
    })
}

export function getApiDaiSupplyRate() {
    return new Promise(function(resolve,reject){
        Axios.get(compoundApiUrl.replace("{CDAI_ADDRESS}", cDaiAddress).replace("{NETWORK}", getNetworkName(CHAIN_ID)))
        .then(res => {
            resolve(res && res.data && res.data.cToken && res.data.cToken.length > 0 && res.data.cToken[0] && res.data.cToken[0].supply_rate && res.data.cToken[0].supply_rate.value)
        })
        .catch(err => reject(err));
    })
}