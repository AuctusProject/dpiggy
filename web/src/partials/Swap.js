import './Swap.css'
import React, { Component } from 'react'
import { faArrowDown, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { getEthToDaiExchangeData, getEthToAucExchangeData, swap } from '../util/uniswapMethods'
import { TRADE_EXACT } from '@uniswap/sdk'
import { checkTransactionIsMined } from '../util/web3Methods'
import DecimalInput from './DecimalInput'
import { convertBigNumberToString } from '../util/constants'

class Swap extends Component {
  constructor(props) {
    super(props)
    this.state = {
      inputAmount: "",
      outputAmount: "",
      rate: "",
      swapStatus: null
    }
  }

  componentDidUpdate = (prevProps) => {
    if (prevProps.ethBalance !== this.props.ethBalance) {
      this.componentDidMount()
    }
  }

  componentDidMount = () => {
    if (this.props.outputValue) {
      this.setOutputAmount(this.props.outputValue)
    }
  }

  onInputChange = (e) => {
    var inputAmount = e
    this.setInputAmount(inputAmount)
  }

  getEthExchangeData = (amount, type) => {
    if (this.props.coin.code === "AUC") {
      return getEthToAucExchangeData(amount, type)
    }
    return getEthToDaiExchangeData(amount, type)
  }

  setInputAmount = (inputAmount) => {
    this.setState({ inputAmount: inputAmount, loading: true },
      () => {
        if (inputAmount) {
          this.getEthExchangeData(inputAmount, TRADE_EXACT.INPUT).then(data => {
            if (data.userInputEthValue === this.state.inputAmount) {
              this.setState({ outputAmount: data.outputAmount, rate: data.rate, tradeDetails: data.tradeDetails, loading: false })
            }
          })
        }
        else {
          this.setState({ outputAmount: "", rate: null, tradeDetails: null, loading: false })
        }
      })
  }

  onOutputChange = (e) => {
    var outputAmount = e
    this.setOutputAmount(outputAmount)
  }

  setOutputAmount = (outputAmount) => {
    this.setState({ outputAmount: outputAmount, loading: true },
      () => {
        if (outputAmount) {
          this.getEthExchangeData(outputAmount, TRADE_EXACT.OUTPUT).then(data => {
            if (data.userInputEthValue === this.state.outputAmount) {
              this.setState({ inputAmount: data.inputAmount, rate: data.rate, tradeDetails: data.tradeDetails, loading: false })
            }
          })
        }
        else {
          this.setState({ inputAmount: "", rate: null, tradeDetails: null, loading: false })
        }
      })
  }

  onSwapClick = (e) => {
    var self = this
    self.setState({ swapStatus: 1 }, () =>
      swap(self.props.selectedAccount, self.state.tradeDetails, self.state.inputAmount, self.state.outputAmount).then(result => {
        if (result) {
          self.setState({ swapStatus: 2 })
          checkTransactionIsMined(result).then((success) => {
            if (success) {
              self.props.onSwapConfirmed()
            }
          })
        }
        else {
          self.setState({ swapStatus: 0 })
        }
      }))
  }

  buyMaxClick = () => {
    if (!(this.props.outputValue > 0)) {
      var ethBalance = convertBigNumberToString(this.props.ethBalance)
      this.setInputAmount(ethBalance)
    }
  }

  formatValue = (value, decimals) => {
    if (value != null) {
      return value.toFixed(decimals)
    }
    return ""
  }

  render() {
    return (
      <div>
        <div className="swap-container text-center">
          <div className="deposit-input-wrapper">
            <div className="input-container">
              <div className="coin-container">
                <img src="/images/eth_icon.png" className="coin-icon" alt="ETH" />
              </div>
              <DecimalInput decimals={18} placeholder="Enter ETH amount" disabled={this.props.outputValue > 0} className="input-value" value={this.state.inputAmount} onChange={this.onInputChange} />
            </div>
            <div className={"max-label " + (this.props.outputValue > 0 ? "" : "clickable")} onClick={this.buyMaxClick}>(Max:&nbsp;{convertBigNumberToString(this.props.ethBalance)} ETH)</div>
          </div>
          <FontAwesomeIcon icon={faArrowDown} />
          <div className="deposit-input-wrapper">
            <div className="input-container">
              <div className="coin-container">
                <img src={"/images/" + this.props.coin.icon} className="coin-icon" alt="Coin" />
              </div>
              <DecimalInput decimals={18} disabled={this.props.outputValue > 0} placeholder={"Enter " + this.props.coin.code + " amount"} className="input-value" value={this.state.outputAmount} onChange={this.onOutputChange} />
            </div>
            <div className="max-label">(Balance:&nbsp;{convertBigNumberToString(this.props.tokenBalance)} {this.props.coin.code})</div>
          </div>
          {this.state.inputAmount > 0 && this.state.outputAmount > 0 && <div className="exchange-rate">Exchange Rate: 1 ETH = {this.formatValue(this.state.rate, 8)} {this.props.coin.code}</div>}
          <a href="https://uniswap.exchange/swap" target="_blank" rel="noreferrer noopener" className="powered-link">Powered by <span role="img" aria-label="unicorn">🦄</span>Uniswap</a>
          <div className="swap-wrapper">
            {!this.state.swapStatus && this.state.loading && <button className="dpiggy-btn action-btn disabled"><FontAwesomeIcon icon={faSpinner} className="fa-spin" /> Swap</button>}
            {!this.state.swapStatus && !this.state.loading && !this.state.tradeDetails && <button className="dpiggy-btn action-btn disabled">Swap</button>}
            {!this.state.swapStatus && !this.state.loading && this.state.tradeDetails && <button className="dpiggy-btn action-btn" onClick={this.onSwapClick}>Swap</button>}
            {this.state.swapStatus === 1 && <button className="dpiggy-btn action-btn"><FontAwesomeIcon icon={faSpinner} className="fa-spin" /> Please confirm the transaction in your wallet.</button>}
            {this.state.swapStatus === 2 && <button className="dpiggy-btn action-btn"><FontAwesomeIcon icon={faSpinner} className="fa-spin" /> Waiting for transaction confirmation.</button>}
          </div>

        </div>
      </div>)
  }
}
export default Swap