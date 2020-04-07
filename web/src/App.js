import './App.css'
import React, { Component } from 'react'
import { Switch, Route } from 'react-router-dom'
import Home from './pages/Home'
import NavBar from './partials/NavBar'
import { withRouter } from 'react-router-dom'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Footer from './partials/Footer'
import Web3Provider from './util/Web3Provider'
import Dashboard from './pages/Dashboard'
import MetamaskModal from './partials/MetamaskModal'
import { checkAucBalanceOf, checkDaiBalanceOf, checkEthBalanceOf, getWeb3 } from './util/web3Methods'
import { checkDaiSupplyRate } from './util/compoundMethods'
import { ethTransactionTolerance } from './util/constants'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExclamationCircle, faSpinner } from '@fortawesome/free-solid-svg-icons'
import Web3Utils from 'web3-utils'

class App extends Component {
  constructor() {
    super()
    this.state = {
      showSignIn: false,
      daiBalance: null, 
      aucBalance: null, 
      ethBalance: null,
      loading: true
    }
  }

  refreshAnnualRate = () => {
    if (getWeb3()) {
      checkDaiSupplyRate().then(annualRate => this.setState({annualRate: annualRate}))
    }
  }

  signOut() {
    window.localStorage.setItem('METAMASK_ACCOUNTS_AVAILABLE', '0')
  }

  showSignInModal = () => {
    this.setState({showSignIn: true})
  }

  onCloseSignIn = (navigate) => {
    this.setState({showSignIn: false})
  }

  onChangeAccount = (account) => {
    if (!account) {
      this.setState({ daiBalance: null, aucBalance: null, ethBalance: null })
      this.props.history.push('/')
    }
    else {
      this.refreshBalances(account)
      if (this.needNavigate()) {
        this.props.history.push('/dashboard/start')
      }
    }
  }
  
  needNavigate = () => {
    return window.location.pathname.indexOf("privacy") < 0 && 
      window.location.pathname.indexOf("terms") < 0 &&
      (window.location.pathname !== "/" || !window.location.hash) 
  }

  refreshBalances = (account) => {
    checkAucBalanceOf(account).then(balance => this.setState({aucBalance: balance}))
    checkDaiBalanceOf(account).then(balance => this.setState({daiBalance: balance}))
    checkEthBalanceOf(account).then(balance => {
      var tolerance = new Web3Utils.BN((ethTransactionTolerance * Math.pow(10, 18)).toString())
      var ethBalance = (balance > tolerance) ? (balance.sub(tolerance)) : 0
      this.setState({ethBalance: ethBalance})
    })
    this.refreshAnnualRate()
  }

  onLoaded = () => {
    this.setState({loading: false})
  }

  render() {
    var showNavbar = window.location.pathname !== "/"
    var showBetaAlert = window.location.pathname.indexOf("dashboard") !== -1
    return (
      <Web3Provider onChangeAccount={this.onChangeAccount} onLoaded={this.onLoaded}>
        {this.state.loading ? 
        <div className="initial-loading">
          <img src="/logo.png" alt="" />
          <div className="mt-3">
            <FontAwesomeIcon icon={faSpinner} className="fa-spin"></FontAwesomeIcon>&nbsp;
            Loading dPiggy...
          </div>
        </div> :
        <main role="main">
          {showNavbar && <NavBar signOut={() => this.signOut()} signIn={() => this.showSignInModal()}/>}
          {showBetaAlert && <div className="beta-alert"><FontAwesomeIcon icon={faExclamationCircle}></FontAwesomeIcon>This project is in beta. Use at your own risk.</div>}
          <div className="app-content">
            <Switch>
              <Route 
                path={`/privacy`}
                render={ routeProps => <Privacy {...routeProps} /> }
              />
              <Route 
                path={`/terms`}
                render={ routeProps => <Terms {...routeProps} /> }
              />
              <Route 
                path={`/dashboard/:action?`}
                render={ routeProps => <Dashboard 
                  {...routeProps}
                  daiBalance={this.state.daiBalance}
                  aucBalance={this.state.aucBalance}
                  ethBalance={this.state.ethBalance}
                  annualRate={this.state.annualRate}
                  refreshBalances={this.refreshBalances}
                /> }
              />             
              <Route 
                path={`/`}
                render={ routeProps => <Home signIn={this.showSignInModal} {...routeProps}/> }
              />
            </Switch>
          </div>
          <Footer />
          {this.state.showSignIn && <MetamaskModal onHide={(navigate) => this.onCloseSignIn(navigate)}/>}
        </main>}
      </Web3Provider>
    );
  }
}
export default withRouter(App)
