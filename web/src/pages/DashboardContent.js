import './DashboardContent.css'
import React, { Component } from 'react'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import { formatWithSignificantDigits, formatPercentage, availableCoins } from '../util/constants'
import CoinDetails from '../partials/CoinDetails'
import { redeem, finish, finishAll } from '../util/dpiggyMethods'
import ReactTimeAgo from 'react-time-ago'
import { checkTransactionIsMined } from '../util/web3Methods'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faCheck, faSyncAlt } from '@fortawesome/free-solid-svg-icons'
import WithdrawModal from '../partials/WithdrawModal'
import { confirm, success } from '../util/sweetalert'

class DashboardContent extends Component {
  constructor() {
    super()
    this.state = {withdrawModal: null, nextNonce: null, refreshing: false}
  }

  formatedPercentage = () => {
    return formatPercentage(this.props.annualRate, 2)
  }

  onNewDeposit = () => {
    this.props.history.push('/dashboard/deposit')
  }

  goToEscrow = () => {
    this.props.history.push('/dashboard/escrow')
  }

  withdrawCoin = (coinCode) => () => {
    this.setState({withdrawModal: coinCode, modalData: this.props[coinCode]})
  }

  withdrawAll = () => {
    confirm("You want to withdraw all and finish your dPiggy?", (confirm) => {
      if (confirm) {
        this.confirmWithdrawAll()
      }
    })
  }

  confirmWithdrawAll = () => {
    this.props.setLoadingWithdrawAll(true, "Waiting for transaction confirmation...")
    finishAll(this.context.web3.selectedAccount, this.getInvestedLength()).then(result => {
      if (result) {
        this.props.setLoadingWithdrawAll(true, "Finishing your dPiggy...")
        checkTransactionIsMined(result).then((isSuccess) => {
          this.props.setLoadingWithdrawAll(false)
          if (isSuccess) {
            success("Your dPiggy was finished successfully.").then(() => {
              this.props.loadDashboardData()
            })
          }
        })
      }
      else {
        this.props.setLoadingWithdrawAll(false)
      }
    })
  }

  confirmWithdrawCoin = (coinCode, method) => {
    this.props.setLoadingWithdrawAll(true, "Waiting for transaction confirmation...")
    method(this.context.web3.selectedAccount, availableCoins[coinCode].address).then(result => {
      if (result) {
        this.props.setLoadingWithdrawAll(true, "Waiting for transaction processing...")
        checkTransactionIsMined(result).then((success) => {
          this.props.setLoadingWithdrawAll(false)
          if (success) {
            this.props.loadDashboardData()
          }
        })
      }
      else {
        this.props.setLoadingWithdrawAll(false)
      }
    })
  }

  hasCryptoPurchased = (coinCode) => {
    return this.props[coinCode] && this.props[coinCode].assetProfit > 0
  }

  isLoading = (coinCode) => {
    return !this.props[coinCode] || this.props[coinCode].loadingData
  }

  isEmpty = (value) => {
    return !(value > 0)
  }

  showWithLoadingAndEmpty = (coinCode, value, prefix, sufix) => {
    return this.isLoading(coinCode) ? 
    <FontAwesomeIcon icon={faSpinner} className="fa-spin"></FontAwesomeIcon> : 
    (this.isEmpty(value()) ? "-" :
      (prefix + formatWithSignificantDigits(value()) + sufix)) 
  }

  onHideWithdraw = (confirm, onlyInterest) => {
    if (confirm) {
      this.confirmWithdrawCoin(this.state.withdrawModal, onlyInterest ? redeem : finish)
    }
    this.setState({withdrawModal: null})
  }

  onRefreshClick = () => {
    if (!this.state.refreshing) {
      this.setState({refreshing: true}, () =>
        this.props.loadDashboardData(true).then(() => this.setState({refreshing:false}))
      )
    }
  }

  getCodesSortedByInvestedDai = () => {
    var coins = Object.values(availableCoins)
    coins = coins.sort((a, b) => {
      return this.props[a.code].investedDai > this.props[b.code].investedDai ? -1 : 1
    })
    return coins
  }

  getInvestedLength = () => {
    var coins = Object.values(availableCoins)
    var invested = 0
    for (var i = 0; i < coins.length; i++) {
      if (this.props[coins[i].code].investedDai > 0) {
        invested++
      }
    }
    return invested
  }

  render() {
    var sortedCoins = this.getCodesSortedByInvestedDai() 
    return <div className="dashboard-container">
      {this.props.loadingWithdrawAll && 
        <div className="loading-withdraw-all">
          <FontAwesomeIcon icon={faSpinner} className="fa-spin"></FontAwesomeIcon>&nbsp;
          {this.props.withdrawAllMessage}
          
        </div>}
      <img className="logo" src="/logo_txt.png" alt="dPiggy" />
      <div className="blue-title">{this.props.totalBalance ? "$"+formatWithSignificantDigits(this.props.totalBalance) : "-"}</div>
      <div className="subtitle">Earning {this.formatedPercentage()} APY</div>
      <div className="action-buttons">
        <div className="dpiggy-btn outline-btn" onClick={this.onNewDeposit}>New Deposit</div>
        <div className="dpiggy-btn action-btn" onClick={this.withdrawAll}>Withdraw All</div>
      </div>
      <div className="button-wrapper">
        <div className={"refresh-link "+(this.state.refreshing ? "disabled" : "")} onClick={this.onRefreshClick}>
          <FontAwesomeIcon icon={faSyncAlt} className={this.state.refreshing ? "fa-spin" : ""}></FontAwesomeIcon>
          {this.state.refreshing ? "Updating..." : "Update values"}
        </div>
      </div>
      <div className="dashboard-data">
        <div className="container">
          <div className="dashboard-cards width100">
            <div className="dashboard-card">
              <div className="dashboard-card-label">Protected principal invested</div>
              <div className="dashboard-card-value">{this.props.invested} DAI</div>
            </div>
            <div className="dashboard-card">
              <div className="dashboard-card-label">Accrued interested since last rebalancing</div>
              <div className="dashboard-card-value">{this.props.accruedInterest ? (formatWithSignificantDigits(this.props.accruedInterest) + " DAI") : "-"}</div>
            </div>
            <div className="dashboard-card">
              <div className="dashboard-card-label">Next rebalance</div>
              <div className="dashboard-card-value">{this.props.nextExecutionDate ? <ReactTimeAgo date={this.props.nextExecutionDate}></ReactTimeAgo> : "-"}</div>
            </div>
            <div className="dashboard-card">
              <div className="dashboard-card-label">Crypto value</div>
              <div className="dashboard-card-value">{this.props.cryptoValue ? ("$"+formatWithSignificantDigits(this.props.cryptoValue)) : "-"}</div>
            </div>
            <div className="dashboard-card">
              <div className="dashboard-card-label">Fee</div>
              <div className="dashboard-card-value">
                <div>{formatWithSignificantDigits(this.props.annualFee * 100, 2, true)}% APR</div>                
                {this.props.userHasEscrow != null && !this.props.userHasEscrow && <div onClick={this.goToEscrow} className="dashboard-card-link clickable">Save fees</div>}
                {this.props.userHasEscrow != null && this.props.userHasEscrow && <div className="dashboard-card-link"><FontAwesomeIcon icon={faCheck}></FontAwesomeIcon> Saving fees</div>}
              </div>              
            </div>
          </div>
          <table className="dashboard-table width100 text-center">
            <thead>
              <tr className="spacer-row"><th colSpan="7"></th></tr>
              <tr className="title-row">
                <th>Assets</th>
                <th>DAI Principal</th>
                <th>Accrued Interest</th>
                <th>Crypto Purchased</th>
                <th>Crypto Value</th>
                <th>Total Value</th>
                <th>Action</th>
              </tr>
              <tr className="spacer-row"><th colSpan="7"></th></tr>
            </thead>
            <tbody>
              {sortedCoins.map(coin =>
                <tr key={coin.code}>
                  <td className="text-left"><CoinDetails coin={coin}></CoinDetails></td>
                  <td>{this.showWithLoadingAndEmpty(coin.code, 
                    () => {return this.props[coin.code].investedDai}, "", " DAI")}
                  </td>
                  <td>{this.showWithLoadingAndEmpty(coin.code, 
                    () => {return this.props[coin.code].accruedInterest}, "", " DAI")}
                  </td>
                  <td>
                    {this.showWithLoadingAndEmpty(coin.code, 
                      () => {return this.props[coin.code].assetProfit}, "", " "+coin.code)}
                  </td>
                  <td>
                    {this.showWithLoadingAndEmpty(coin.code, 
                      () => {return this.props[coin.code].cryptoValue}, "$", "")}
                  </td>
                  <td>
                    {this.showWithLoadingAndEmpty(coin.code, 
                      () => {return this.props[coin.code].investedDai + this.props[coin.code].accruedInterest + this.props[coin.code].cryptoValue}, "$", "")}
                  </td>
                  <td>{this.props[coin.code] && !this.props[coin.code].loadingData && this.props[coin.code].investedDai > 0 && 
                    <div className="dpiggy-btn action-btn btn-sm" disabled={this.props[coin.code].loadingWithdraw} onClick={this.withdrawCoin(coin.code)}>
                      {this.props[coin.code].loadingWithdraw && <FontAwesomeIcon icon={faSpinner} className="fa-spin"></FontAwesomeIcon>}
                      {this.props[coin.code].loadingWithdraw && "Loading..."}
                      {!this.props[coin.code].loadingWithdraw && "Withdraw"}                      
                    </div>}
                  </td>
                </tr>)}
            </tbody>
          </table>
        </div>
      </div>
      {this.state.withdrawModal && <WithdrawModal coin={this.state.withdrawModal} data={this.state.modalData} onHide={this.onHideWithdraw}></WithdrawModal>}
    </div>
  }
}

DashboardContent.contextTypes = {
  web3: PropTypes.object
}
export default withRouter(DashboardContent)