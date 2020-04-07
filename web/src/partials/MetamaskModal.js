import './MetamaskModal.css'
import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { withRouter } from 'react-router-dom'
import { connectMetamask } from '../util/web3Methods'
import Modal from 'react-bootstrap/Modal'

class MetamaskModal extends Component {
  constructor(props){
    super(props)
		this.state = {
      connecting: false
    }
  }

  onMetamaskClick = () => {
    this.setState({ connecting: true })
    connectMetamask().then(() => {
      window.localStorage.setItem('METAMASK_ACCOUNTS_AVAILABLE', '1')
      this.props.onHide(true)
    }).finally(() =>
      this.setState({ connecting: false })
    )
  }

  render() {
    var hasMetamask = this.context && this.context.web3 && this.context.web3.hasMetamask
    var username = this.context && this.context.web3 && this.context.web3.selectedAccount
    if (username) {
      this.props.history.push('/dashboard/start')
      this.props.onHide()
    }
    return (
      <Modal className="metamask-modal" centered={true} size="md" show={true} onHide={(e) => this.props.onHide()}>
        <Modal.Header closeButton>
        </Modal.Header>
        <Modal.Body>
          <div className="row">
            <div className="col-md-12">
              <div className="metamask-container text-center">
                <img className="logo-img" src="/logo_txt.png" alt="dPiggy"/>
                <div className="blue-title metamask-modal-title">Connect Wallet</div>
                <div className="metamask-modal-subtitle">To start using dPiggy</div>
                {hasMetamask &&
                  <div>
                    {!this.state.connecting && <div className="dpiggy-btn action-btn metamask-btn" onClick={this.onMetamaskClick}>Connect with Metamask</div>}
                    {this.state.connecting && <div className="dpiggy-btn action-btn metamask-btn">Connecting...</div>}
                  </div>
                }
                {!hasMetamask && 
                  <a className="dpiggy-btn action-btn metamask-btn" href="https://metamask.io/download.html" target="_blank" rel="noopener noreferrer">Install Metamask</a>
                }
                <div>By connecting, I accept dPiggy's <a href="/terms" target="_blank">Terms of Service</a></div>
              </div>
            </div>
          </div>
        </Modal.Body>
      </Modal>)   
  }
}
MetamaskModal.contextTypes = {
  web3: PropTypes.object
}
export default withRouter(MetamaskModal)
