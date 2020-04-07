import './WithdrawModal.css'
import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { withRouter } from 'react-router-dom'
import Modal from 'react-bootstrap/Modal'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircle, faDotCircle } from '@fortawesome/free-regular-svg-icons'
import CoinDetails from './CoinDetails'
import { availableCoins } from '../util/constants'

class WithdrawModal extends Component {
  constructor(props){
    super(props)
		this.state = {
      onlyInterest: null
    }
  }

  onWithdrawClick = () => {
    if (this.state.onlyInterest != null) {
      this.props.onHide(true, this.state.onlyInterest)
    }
  }

  selectWithdrawOption = (onlyInterest) => () => {
    this.setState({onlyInterest: onlyInterest})
  }

  render() {
    return (
      <Modal className="withdraw-modal" centered={true} size="md" show={true} onHide={(e) => this.props.onHide()}>
        <Modal.Header closeButton>
        </Modal.Header>
        <Modal.Body>
          <div className="row">
            <div className="col-md-12">
              <div className="withdraw-container text-center">
                <div className="blue-title withdraw-modal-title">Withdraw</div>
                <CoinDetails coin={availableCoins[this.props.coin]}></CoinDetails>
                <div className="withdraw-options">
                  {this.props.data && this.props.data.assetProfit > 0 && <div className="withdraw-option" onClick={this.selectWithdrawOption(true)}>
                  {!(this.state.onlyInterest != null && this.state.onlyInterest) && <FontAwesomeIcon icon={faCircle}></FontAwesomeIcon>}
                  {this.state.onlyInterest != null && this.state.onlyInterest && <FontAwesomeIcon icon={faDotCircle}></FontAwesomeIcon>}
                    Only {this.props.coin}
                  </div>}
                  <div className="withdraw-option" onClick={this.selectWithdrawOption(false)}>
                  {!(this.state.onlyInterest != null && !this.state.onlyInterest) && <FontAwesomeIcon icon={faCircle}></FontAwesomeIcon>}
                  {this.state.onlyInterest != null && !this.state.onlyInterest && <FontAwesomeIcon icon={faDotCircle}></FontAwesomeIcon>}
                    DAI + {this.props.coin}
                  </div>
                </div>
                <div className={"dpiggy-btn action-btn withdraw-btn " + (this.state.onlyInterest == null ? "disabled" : "")} disabled={this.state.onlyInterest == null} onClick={this.onWithdrawClick}>Withdraw</div>
              </div>
            </div>
          </div>
        </Modal.Body>
      </Modal>)
  }
}
WithdrawModal.contextTypes = {
  web3: PropTypes.object
}
export default withRouter(WithdrawModal)
