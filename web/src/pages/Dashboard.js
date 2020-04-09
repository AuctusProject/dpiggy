import './Dashboard.css'
import React, { Component } from 'react'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import { availableCoins, ONE_SECOND, coingeckoApiUrl, cDAI_CODE } from '../util/constants'
import { getDailyFee, getUserTotalInvested, getUserEstimatedCurrentProfitWithoutFee, getUserEstimatedCurrentFee, getUserProfitsAndFeeAmount, getMinimumTimeForNextExecution, getUserAssetRedeemed, getUserEscrowStart } from '../util/dpiggyMethods'
import axios from 'axios';
import DashboardContent from './DashboardContent'
import Deposit from './Deposit'
import Escrow from '../partials/Escrow'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'

class Dashboard extends Component {
  constructor() {
    super()
    this.state = {loadingDashboard: true, totalBalance: null, loadingCoins: {}, loadingWithdrawAll: false, userHasEscrow: null}
  }

  componentDidMount = () => {
    if (!(this.context && this.context.web3 && this.context.web3.selectedAccount && this.context.web3.validNetwork)) {
      this.props.history.push('/')
    }
    else {
      this.loadDashboardData()
    }
  }

  componentDidUpdate = (prevProps) => {
    if (this.props.match.params.action === "start" && prevProps.match.params.action !== "start") {
      this.loadDashboardData()
    }
  }

  loadDashboardData = (dontShowLoading) => {
    return new Promise((resolve, reject) => {
      if (!dontShowLoading) {
        this.setState({loadingDashboard: true})
      }
      this.props.refreshBalances(this.context.web3.selectedAccount)
      getDailyFee().then(dailyFee => {
        var annualFee = (Math.pow(1+dailyFee, 365) - 1)
        this.setState({annualFee: annualFee})
      })
      getUserEscrowStart(this.context.web3.selectedAccount).then(escrowStart => {
        this.setState({userHasEscrow: escrowStart > 0})
      })
      var coingeckoIds = ""
      Object.keys(availableCoins).forEach(coin => {
        if (availableCoins[coin].coingeckoId) {
          coingeckoIds += availableCoins[coin].coingeckoId + ","
        }
      })
      this.getAssetsPrices(coingeckoIds.slice(0, coingeckoIds.length-1)).then(prices => {
        var promises = []
        Object.keys(availableCoins).forEach(coin => {
          this.setLoadingCoin(coin, true)
          promises.push(this.getCoinDetails(coin, prices))
        })      
        
        Promise.all(promises).then(result => {
          var invested = 0
          var accruedInterest = 0
          var cryptoValue = 0
          var nextExecutionDate = null
          for (var element in result) {
            invested += result[element].investedDai
            accruedInterest += result[element].accruedInterest
            cryptoValue += result[element].cryptoValue
            var resultExecutionDate = new Date(result[element].timeForNextExecution * ONE_SECOND)
            if (resultExecutionDate > new Date() && resultExecutionDate > nextExecutionDate) {
              nextExecutionDate = resultExecutionDate
            }
          }
          var totalBalance = invested + accruedInterest + cryptoValue
          this.setState({totalBalance: totalBalance, invested: invested, accruedInterest: accruedInterest, nextExecutionDate: nextExecutionDate, cryptoValue: cryptoValue, loadingDashboard: false})
  
          if (this.props.match.params.action === "start"){
            if (totalBalance === 0) {
              this.goToDeposit()
            }
            else {
              this.props.history.push('/dashboard')
            }
          }
          resolve()
        })
      })
    }) 
  }

  goToDeposit = () => {
    this.props.history.push('/dashboard/deposit')
  }

  setLoadingCoin = (coin, loading) => {
    var state = this.state
    if (!state[coin]) {
      state[coin] = {}
    }
    state[coin].loadingData = loading
    this.setState(state)
  }

  setLoadingCoinWithdraw = (coin, loading) => {
    var state = this.state
    if (!state[coin]) {
      state[coin] = {}
    }
    state[coin].loadingWithdraw = loading  
    this.setState(state)
  }

  setLoadingWithdrawAll = (loading, message) => {
    this.setState({loadingWithdrawAll: loading, withdrawAllMessage: message})
  }

  getAssetsPrices = (coingeckoIds) => {
    return new Promise(function (resolve, reject) {
      axios.get(coingeckoApiUrl.replace("{COINGECKO_IDS}", coingeckoIds))
        .then(res => {
          if (res) {
            res = res.data;
          }
          resolve(res)
        })
        .catch(err => reject(err));
    })
  }

  getCoinDetails = (coinCode, prices) => {
    var self = this
    return new Promise(function(resolve, reject){
      var promises = []
      promises.push(getUserTotalInvested(coinCode, self.context.web3.selectedAccount))
      promises.push(getUserEstimatedCurrentProfitWithoutFee(coinCode, self.context.web3.selectedAccount))
      promises.push(getUserEstimatedCurrentFee(coinCode, self.context.web3.selectedAccount))
      promises.push(getUserProfitsAndFeeAmount(coinCode, self.context.web3.selectedAccount))
      promises.push(getUserAssetRedeemed(self.context.web3.selectedAccount, coinCode))      
      promises.push(getMinimumTimeForNextExecution(coinCode))
      
      var coingeckoId = availableCoins[coinCode].coingeckoId
      var price = coingeckoId ? prices[coingeckoId].usd : 1

      Promise.all(promises).then(result => {
        var state = self.state
        var accruedInterest = (result[2] > result[1]) ? 0 : (result[1] - result[2])
        if (coinCode === cDAI_CODE) {
          accruedInterest += result[3][0] - result[3][2]
        }
        state[coinCode] = Object.assign(state[coinCode], {
          investedDai: result[0],
          accruedInterest: accruedInterest,
          assetProfit: result[3][1] - result[4],
          timeForNextExecution: result[5],
          cryptoValue: (result[3][1] - result[4]) * price,
          loadingData: false
        })
        self.setState(state)
        resolve(state[coinCode])
      })
    })
  }

  render() {
    var showDeposit = this.props.match.params.action === "deposit"
    var showEscrow = this.props.match.params.action === "escrow"
    return this.state.loadingDashboard ? 
      <div className="loading-withdraw-all">
        <FontAwesomeIcon icon={faSpinner} className="fa-spin"></FontAwesomeIcon>&nbsp;
        Loading your dPiggy info...
      </div>:
    (showDeposit ? <Deposit {...this.props} loadDashboardData={this.loadDashboardData} hasDPiggy={this.state.totalBalance > 0}></Deposit> :
      showEscrow ? <Escrow {...this.props} loadDashboardData={this.loadDashboardData} hasDPiggy={this.state.totalBalance > 0}></Escrow> :
    <DashboardContent 
      {...this.props} 
      {...this.state}
      loadDashboardData={this.loadDashboardData}
      setLoadingCoin={this.setLoadingCoin}
      setLoadingCoinWithdraw={this.setLoadingCoinWithdraw}
      setLoadingWithdrawAll={this.setLoadingWithdrawAll}>
    </DashboardContent>)
  }
}

Dashboard.contextTypes = {
  web3: PropTypes.object
}
export default withRouter(Dashboard)