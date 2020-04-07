import './Deposit.css'
import React, { Component } from 'react'
import PropTypes from 'prop-types'
import DepositContainer from '../partials/DepositContainer'
import Swap from '../partials/Swap'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faExclamationTriangle, faSyncAlt } from '@fortawesome/free-solid-svg-icons'
import { daiInfo } from '../util/constants'

class Deposit extends Component {
  constructor(props) {
    super(props)
    this.state = { 
      buydai: false
    }
  }

  componentDidUpdate = (prevProps) => {
    if (prevProps.daiBalance !== this.props.daiBalance) {
      this.componentDidMount()
    }
  }

  componentDidMount = () => {
    if (!(this.context && this.context.web3 && this.context.web3.selectedAccount)) {
      this.props.history.push('/')
    }
  }

  onBuyDaiClick = () => {
    this.setState({buydai: true})
  }

  onDismissBuyDaiClick = () => {
    this.setState({buydai: false})
  }

  onSwapConfirmed = () => {
    this.props.refreshBalances(this.context.web3.selectedAccount)
    this.setState({buydai: false})
  }

  onDismissDepositClick = () => {
    this.props.history.push("/dashboard")
  }
  
  onRefreshClick = () => {
    if (!this.state.refreshing) {
      this.setState({refreshing: true}, () =>
        this.props.loadDashboardData(true).then(() => this.setState({refreshing:false}))
      )
    }
  }

  render() {
    var depositTitle = this.props.hasDPiggy ? "Deposit to your dPiggy" : "Create your dPiggy"
    return (
      <div className="deposit">
        <div className="blue-title">{depositTitle}</div>
        {this.props.daiBalance == null ?
          <div><FontAwesomeIcon icon={faSpinner} className="fa-spin"></FontAwesomeIcon> Loading balances...</div>
          : this.props.daiBalance > 0 && !this.state.buydai ?
            <DepositContainer {...this.props} onBuyDaiClick={this.onBuyDaiClick} daiBalance={this.props.daiBalance} selectedAccount={this.context.web3.selectedAccount} depositTitle={depositTitle}></DepositContainer> :
            <div>
              {this.state.buydai ?
                <div>
                  <Swap onSwapConfirmed={this.onSwapConfirmed} coin={daiInfo} tokenBalance={this.props.daiBalance} ethBalance={this.props.ethBalance} selectedAccount={this.context.web3.selectedAccount}></Swap> 
                  <div className="back-link" onClick={this.onDismissBuyDaiClick}>Back</div>
                </div>
                :
                <div className="no-dai-content">
                  <div className="no-dai-message"><FontAwesomeIcon icon={faExclamationTriangle} /> You don't have any DAI in your Wallet</div>            
                  <div className="button-wrapper">
                    <div className={"refresh-link "+(this.state.refreshing ? "disabled" : "")} onClick={this.onRefreshClick}>
                      <FontAwesomeIcon icon={faSyncAlt} className={this.state.refreshing ? "fa-spin" : ""}></FontAwesomeIcon>
                      {this.state.refreshing ? "Updating..." : "Update values"}
                    </div>
                  </div>
                  <div>Click the button below to buy some</div>
                  <div className="dpiggy-btn action-btn buy-dai-btn" onClick={this.onBuyDaiClick}>Buy DAI</div>
                  <div className="back-link" onClick={this.onDismissDepositClick}>Back</div>
                </div>}
            </div>
        }
      </div>)
  }
}

Deposit.contextTypes = {
  web3: PropTypes.object
}
export default Deposit