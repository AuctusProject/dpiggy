import Web3Utils from 'web3-utils'
import { aucAddress } from './constants'
import { getWeb3, sendTransaction } from './web3Methods'
import { auctusABI } from './auctusABI'

export function transferFrom(from, to, value) {
    const _web3 = getWeb3()
    const aucContract = new _web3.eth.Contract(auctusABI, aucAddress)
    var weiValue = Web3Utils.toWei(value.toString(), 'wei')
    var data = aucContract.methods.transfer(to, weiValue, []).encodeABI()
    return sendTransaction(null, null, from, aucAddress, null, data)
}