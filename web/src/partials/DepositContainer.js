import './DepositContainer.css'
import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { error } from '../util/sweetalert'
import { availableCoins, formatPercentage, formatWithSignificantDigits, convertBigNumberToFloat, convertBigNumberToString } from '../util/constants'
import CoinDetails from './CoinDetails'
import { allowDpiggySpendDai, getPercentagePrecision, sendDeposit, getMinimumDeposit } from '../util/dpiggyMethods'
import { checkTransactionIsMined, getNextNonce } from '../util/web3Methods'
import DecimalInput from './DecimalInput'

class DepositContainer extends Component {
  constructor(props) {
    super(props)
    this.state = {
      showDestination: false,
      depositAmount: "",
      coinPercentages: this.initCoinPercentages(),
      loadingMessage: ""
    }
  }

  initCoinPercentages = () => {
    var percentages = {}
    Object.keys(availableCoins).map((coin) => percentages[coin] = 0)
    return percentages
  }

  componentDidUpdate = (prevProps) => {
    if (prevProps.daiBalance !== this.props.daiBalance) {
      this.componentDidMount()
    }
  }

  componentDidMount = () => {
    getMinimumDeposit().then(minimumDeposit => this.setState({minimumDeposit: minimumDeposit}))
  }

  onInputChange = (inputValue) => {
    var value = parseFloat(inputValue)
    if (!(typeof value === "number" && value >= 0)) {
      value = ""
      this.setState({depositAmount: value})
    }
    else {
      this.setState({depositAmount: inputValue})
    }
    
  }

  getTotalWeight = () => {
    var totalWeight = 0

    Object.keys(availableCoins).forEach((coin) => {
      if (this.state.coinPercentages[coin]) {
        totalWeight += this.state.coinPercentages[coin]
      }
    })
    return totalWeight
  }

  onDepositClick = (e) => {
    if (!this.state.loading) {
      if (this.getTotalWeight() !== 100) {
        error("The sum of percentages must be 100%");
        return;
      }
      else {
        this.deposit()
      }
    }
  }

  validateMinimumValue = () => {
    for (var coinIdx in availableCoins) {
      var coin = availableCoins[coinIdx]
      if (this.state.coinPercentages[coin.code]) {
        var floatDepositAmount = convertBigNumberToFloat(this.state.depositAmount)
        if ((this.state.coinPercentages[coin.code]/100 * floatDepositAmount) < this.state.minimumDeposit) {
          error("The minimum deposit value is "+this.state.minimumDeposit + " DAI. Please change the percentage of "+coin.code+".")
          return false
        }
      }
    }
    return true
  }

  deposit = () => {
    if (this.validateMinimumValue()) {
      this.allowSpendDai()
    }
  }

  allowSpendDai = () => {
    getNextNonce(this.context.web3.selectedAccount).then(nextNonce => {
      this.setState({loading: true, loadingMessage: "Please confirm the first transaction"})
      allowDpiggySpendDai(this.context.web3.selectedAccount, this.state.depositAmount, nextNonce).then(result => {
        if (result) {
          this.setState({loading: true, loadingMessage: "Please confirm the second transaction"})
          this.sendDeposit(nextNonce + 1)
        }
        else {
          error("You need to confirm the transaction to deposit DAI.")
          this.setState({loading: false})
        }
      })
    })    
  }

  sendDeposit = (nonce) => {
    getPercentagePrecision().then(precision => {
      var tokens = []
      var percentages = []
      Object.values(availableCoins).forEach((coin) => {
        if (this.state.coinPercentages[coin.code]) {
          tokens.push(coin.address)
          percentages.push(parseInt(this.state.coinPercentages[coin.code] * precision / 100).toString())
        }
      })
      sendDeposit(this.context.web3.selectedAccount, tokens, percentages, nonce).then(result => {
        if (result) {
          this.setState({loading: true, loadingMessage: "Waiting for transaction confirmation..."})
          checkTransactionIsMined(result).then((success) => {
            this.setState({loading: false})
            if (success) {
              this.props.loadDashboardData()
              this.props.history.push("/dashboard")              
            }
          })
        }
        else {
          this.setState({loading: false})
        }
      })
    })    
  }

  onPercentageChange = (coin) => (e) => {
    var value = parseFloat(e)
    if (!(typeof value === "number" && value >= 0)) {
      value = ""
    }
    var coinPercentages = this.state.coinPercentages
    coinPercentages[coin] = value
    this.setState({coinPercentages: coinPercentages})
  }

  formatedPercentage = () => {
    return formatPercentage(this.props.annualRate, 2)
  }

  lendMaxClick = () => {
    var stringBalance = convertBigNumberToString(this.props.daiBalance)
    this.setState({depositAmount: stringBalance})
  }

  onNextClick = () => {
    var floatDepositAmount = convertBigNumberToFloat(this.state.depositAmount)
    if (floatDepositAmount >= this.state.minimumDeposit) {
      this.setState({loading: false, showDestination: true})
    }
    else {
      error("The minimum deposit value is "+this.state.minimumDeposit + " DAI")
    }
  }

  onBuyDaiClick = () => {
    this.props.onBuyDaiClick()
  }

  onDismissDepositClick = () => {    
    this.props.history.push("/dashboard")
  }

  render() {
    return (
      <div className="deposit-container width100">
        <div>Earn {this.props.annualRate ? this.formatedPercentage() : <FontAwesomeIcon icon={faSpinner} className="fa-spin"></FontAwesomeIcon>} APY on your DAI</div>
        <div className="deposit-input-wrapper">            
          <div className="input-container">
            <div className="coin-container">
              <img src="/images/dai_icon.png" className="coin-icon" alt="DAI" />
            </div>
            <DecimalInput placeholder="Enter DAI amount" disabled={this.state.loading} className="input-value" value={this.state.depositAmount} onChange={this.onInputChange} />
          </div>
          <div className="max-label clickable" onClick={this.lendMaxClick}>(Lend Max:&nbsp;{formatWithSignificantDigits(this.props.daiBalance)} DAI)</div>
          <div className="swap-eth-to-dai clickable" onClick={this.onBuyDaiClick}>Need DAI? Swap ETH to DAI</div>
        </div>
        {!this.state.showDestination && <div className="button-wrapper">
          <button className={"dpiggy-btn action-btn "+(this.state.loading ? "disabled" : "")} onClick={this.onNextClick}>Next</button>
        </div>}
        {!this.state.showDestination && this.props.hasDPiggy && <div className="back-link" onClick={this.onDismissDepositClick}>Back</div>}
        {this.state.showDestination && 
          <div className="destination-wrapper width100">
            <div className="black-title">Choose where your interest goes</div>
            <div className="assets-title">
              <div>Asset</div>
              <div className="vr"></div>
              <div>Allocation</div>
            </div>
            {Object.values(availableCoins).map(coin =>
              <div key={coin.code} className="allocation-item-container">
                <CoinDetails coin={coin}></CoinDetails>
                <DecimalInput decimals={0} disabled={this.state.loading} className="input-value" value={this.state.coinPercentages[coin.code]} onChange={this.onPercentageChange(coin.code)} />
              </div>
            )}
            <div className={"total-value" + (this.getTotalWeight() > 100 ? " total-value-error": "")}>{this.getTotalWeight()}%</div>
            <div className="total-message">Please make sure the total is 100%</div>
            <div className="button-wrapper">
              <button className="dpiggy-btn action-btn" disabled={this.state.loading} onClick={this.onDepositClick}>
                {this.state.loading && <FontAwesomeIcon icon={faSpinner} className="fa-spin"></FontAwesomeIcon>}
                {this.state.loading && this.state.loadingMessage}
                {!this.state.loading && this.props.depositTitle}
              </button>
            </div>
            {this.props.hasDPiggy && <div className="back-link" onClick={this.onDismissDepositClick}>Back</div>}
          </div>
        }
      </div>)
  }
}

DepositContainer.contextTypes = {
  web3: PropTypes.object
}
export default DepositContainer