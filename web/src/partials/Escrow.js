import './Escrow.css'
import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { faExclamationTriangle, faSpinner, faSyncAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { checkAucEscrowValue, sendEscrow } from '../util/dpiggyMethods'
import Swap from './Swap'
import { availableCoins, convertBigNumberToString } from '../util/constants'
import { checkTransactionIsMined } from '../util/web3Methods'

class Escrow extends Component {
  constructor(props) {
    super(props)
    this.state = {
      escrowAmount: ""
    }
  }

  componentDidUpdate = (prevProps) => {
    if (prevProps.aucBalance !== this.props.aucBalance) {
      this.componentDidMount()
    }
  }

  componentDidMount = () => {
    checkAucEscrowValue().then(aucNeeded => {
      this.setState({aucNeeded:aucNeeded})
    })
  }

  onInputChange = (e) => {
    var value = parseFloat(e.target.value)
    if (!(typeof value === "number" && value >= 0)) {
      value = ""
    }
    this.setState({escrowAmount: value})
  }

  onEscrowClick = (e) => {
    this.setState({ loading: true, loadingMessage: "Please, confirm the transaction" })
    sendEscrow(this.context.web3.selectedAccount, this.state.aucNeeded.toString()).then(result => {
      if (result) {
        this.setState({ loading: true, loadingMessage: "Sending AUC to dPiggy..." })
        checkTransactionIsMined(result).then((success) => {
          this.setState({ loading: false })
          if (success) {
            this.props.loadDashboardData()
            this.props.history.push("/dashboard")
          }
        })
      }
      else {
        this.setState({ loading: false })
      }
    })
  }

  onBuyAucClick = () => {
    this.setState({buyauc: true})
  }

  onDismissBuyAucClick = () => {
    this.setState({buyauc: false})
  }

  onDismissEscrowClick = () => {
    this.props.history.push("/dashboard")
  }

  onSwapConfirmed = () => {
    this.setState({buyauc: false})
    this.props.refreshBalances(this.context.web3.selectedAccount)
  }

  onRefreshClick = () => {
    if (!this.state.refreshing) {
      this.setState({refreshing: true}, () =>
        this.props.loadDashboardData(true).then(() => this.setState({refreshing:false}))
      )
    }
  }
  
  render() {
    var needAuc = true
    if (!!this.state.aucNeeded && !!this.props.aucBalance) {
      var needed = this.state.aucNeeded.sub(this.props.aucBalance)
      needAuc = needed > 0
    }
    return (
      <div>
        <div className="deposit-container text-center">
          <div className="blue-title">Get 100% Discount on Fees</div>
          <div className="subtitle mb-2">Escrow {this.state.aucNeeded ? convertBigNumberToString(this.state.aucNeeded)+ " " : " "}AUC to stop paying dPiggy's fee.</div>
          {(this.props.aucBalance == null || this.state.aucNeeded == null) ?
          <div className="mb-4"><FontAwesomeIcon icon={faSpinner} className="fa-spin"></FontAwesomeIcon> Loading balances...</div>
          : !needAuc ?
            <div className="escrow-container">
              <div className="deposit-input-wrapper">            
                <div className="input-container">
                  <div className="coin-container">
                    <img src="/images/auc_icon.png" className="coin-icon" alt="AUC" />
                  </div>
                  <input className="input-value" value={convertBigNumberToString(this.state.aucNeeded)}/>
                </div>
              </div>
              <div className="button-wrapper">
                <button className="dpiggy-btn action-btn" disabled={this.state.loading} onClick={this.onEscrowClick}>
                  {this.state.loading && <FontAwesomeIcon icon={faSpinner} className="fa-spin"></FontAwesomeIcon>}
                  {this.state.loading && this.state.loadingMessage}
                  {!this.state.loading && "Send AUC"}
                </button>
              </div>
              <div className="back-link" onClick={this.onDismissEscrowClick}>Back</div>
            </div> :
            <div>
              {this.state.buyauc ?
                <div>
                  <Swap onSwapConfirmed={this.onSwapConfirmed} coin={availableCoins["AUC"]} outputValue={convertBigNumberToString(needed)} tokenBalance={this.props.aucBalance} ethBalance={this.props.ethBalance} selectedAccount={this.context.web3.selectedAccount}></Swap> 
                  <div className="back-link" onClick={this.onDismissBuyAucClick}>Back</div>
                </div>
                :
                <div className="no-dai-content">
                  <div className="no-dai-message"><FontAwesomeIcon icon={faExclamationTriangle} />&nbsp;
                  {this.props.aucBalance === 0 ? "You don't have any AUC in your Wallet" :
                  ("You need more "+convertBigNumberToString(needed)+" AUC in your Wallet")}
                  </div>
                  <div className="button-wrapper">
                    <div className={"refresh-link "+(this.state.refreshing ? "disabled" : "")} onClick={this.onRefreshClick}>
                      <FontAwesomeIcon icon={faSyncAlt} className={this.state.refreshing ? "fa-spin" : ""}></FontAwesomeIcon>
                      {this.state.refreshing ? "Updating..." : "Update values"}
                    </div>
                  </div>
                  <div>Click the button below to buy</div>
                  <div className="dpiggy-btn action-btn buy-dai-btn" onClick={this.onBuyAucClick}>Buy AUC</div>
                  <div className="back-link" onClick={this.onDismissEscrowClick}>Back</div>
                </div>}
            </div>
        } 
        </div>
      </div>)
  }
}

Escrow.contextTypes = {
  web3: PropTypes.object
}
export default Escrow