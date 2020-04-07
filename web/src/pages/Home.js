import './Home.css'
import React, { Component } from 'react'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import { getApiDaiSupplyRate } from '../util/compoundMethods'
import { formatPercentage, ellipsisCenterOfUsername, getNetworkName, CHAIN_ID } from '../util/constants'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import FaqItem from '../partials/FaqItem'
import { faqData } from '../util/faq'
import Accordion from 'react-bootstrap/Accordion'
import { error } from '../util/sweetalert'

class Home extends Component {

  constructor(props) {
    super(props)
    this.isMobile = window.innerWidth < 768
    this.state = {
      supplyRate: null,
      headerTextAnimation: (this.isMobile ? "" : " unshown "),
      headerImgAnimation: (this.isMobile ? "" : " unshown "),
      bodyTextDepositAnimation: (this.isMobile ? "" : " unshown "),
      bodyImgDepositAnimation: (this.isMobile ? "" : " unshown "),
      bodyTextInterestAnimation: (this.isMobile ? "" : " unshown "),
      bodyImgInterestAnimation: (this.isMobile ? "" : " unshown "),
      bodyTextCryptoAnimation: (this.isMobile ? "" : " unshown "),
      bodyImgCryptoAnimation: (this.isMobile ? "" : " unshown "),
      bodyTextPortfolioAnimation: (this.isMobile ? "" : " unshown "),
      bodyImgPortfolioAnimation: (this.isMobile ? "" : " unshown "),
      whyAnimation: (this.isMobile ? "" : " unshown "),
      buildAnimation: (this.isMobile ? "" : " unshown "),
      faqAnimation: (this.isMobile ? "" : " unshown "),
      footerBtnAnimation: ""
    }
  }

  componentWillUnmount() {
    document.removeEventListener("scroll", () => {})
  }

  componentDidMount = () => {
    getApiDaiSupplyRate().then(supplyRate => this.setState({ supplyRate: supplyRate }))

    if (!this.isMobile) {
      document.addEventListener("scroll", () => this.setAnimations(), false)
      setTimeout(() => this.setAnimations(), 10)
    }

    if (!!window.location.hash) {
      var element = document.getElementById(window.location.hash.substring(1))
      if (element) {
        window.scrollTo({ top: element.getBoundingClientRect().top, behavior: 'smooth' })
      }
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  setAnimations = () => {
    this.setHeaderAnimations()
    this.setBodyAnimations()
    this.setWhyAnimations()
    this.setBuildAnimations()
    this.setFaqAnimations()
    this.setFooterAnimations()
  }

  setFaqAnimations = () => {
    this.setState({faqAnimation: (this.isVisible(this.faqRef) ? " show-animation" : " unshown")})
  }

  setFooterAnimations = () => {
    this.setState({footerBtnAnimation: (this.isVisible(this.footerBtnRef) ? " bounce-animation" : "")})
  }

  setWhyAnimations = () => {
    this.setAnimation(this.isVisible(this.whyRef), "whyAnimation", "slide-up")
  }

  setBuildAnimations = () => {
    this.setAnimation(this.isVisible(this.buildRef), "buildAnimation", "slide-up")
  }
 
  setBodyAnimations = () => {
    this.setAnimation(this.isVisible(this.bodyTextDepositRef), "bodyTextDepositAnimation", "slide-up")
    this.setAnimation(this.isVisible(this.bodyTextInterestRef), "bodyTextInterestAnimation", "slide-up")
    this.setAnimation(this.isVisible(this.bodyTextCryptoRef), "bodyTextCryptoAnimation", "slide-up")
    this.setAnimation(this.isVisible(this.bodyTextPortfolioRef), "bodyTextPortfolioAnimation", "slide-up")
    this.setAnimation(this.isVisible(this.bodyImgDepositRef), "bodyImgDepositAnimation", "slide-left")
    this.setAnimation(this.isVisible(this.bodyImgInterestRef), "bodyImgInterestAnimation", "slide-right")
    this.setAnimation(this.isVisible(this.bodyImgCryptoRef), "bodyImgCryptoAnimation", "slide-left")
    this.setAnimation(this.isVisible(this.bodyImgPortfolioRef), "bodyImgPortfolioAnimation", "slide-right")
  }

  setHeaderAnimations = () => {
    let isVisible = this.isVisible(this.headerRef)
    this.setAnimation(isVisible, "headerTextAnimation", "slide-up", false)
    this.setAnimation(isVisible, "headerImgAnimation", "slide-left", false)
  }

  setAnimation = (isVisible, stateName, animationName, removable = true) => {
    if (removable || (isVisible && this.state[stateName].indexOf("unshown") >= 0)) {
      var newState = this.state
      newState[stateName] = (isVisible ? (" base-animation " + animationName) : " unshown ")
      this.setState(newState)
    }
  }

  isVisible = (element) => {
    if (!element) return false
    else {
      const rect = element.getBoundingClientRect()
      return (rect.top >= 0 && rect.top <= window.innerHeight) || 
        (rect.bottom >= 0 && rect.bottom <= window.innerHeight)
    }
  }

  onClickGetStart() {
    if (this.context && this.context.web3 && this.context.web3.hasMetamask && !this.context.web3.validNetwork) {
      error("Please connect to the "+ getNetworkName(CHAIN_ID) + ".", "Wrong Network")
    }
    else {
      this.props.signIn()
    }
  }

  render() {
    var username = this.context && this.context.web3 && this.context.web3.selectedAccount
    var validNetwork = this.context && this.context.web3 && this.context.web3.validNetwork
    username = ellipsisCenterOfUsername(username)
    return <div className="home">
      <section>
        <div className="container">
          <div className="top-bar">
            <div className="d-none d-md-flex justify-content-center align-content-center width100">
              <a className="clickable" href="/#how-it-works">HOW IT WORKS?</a>
              <a className="clickable" href="/#why">WHY USE DPIGGY?</a>
              <a className="clickable" href="/#faq">FAQ</a>
            </div>
            <div className="top-btn">
                {username && validNetwork &&
                    <div className="dpiggy-btn outline-btn" onClick={() => this.onClickGetStart()}>GO TO DASHBOARD</div>
                }
                {username && !validNetwork &&
                    <div className="user-nav-container">
                        <div className="user-nav-wrap">
                            <img src="/images/icon_metamask.png" alt=""></img>
                            <div>
                                <span className="wallet-address">{username}</span>
                                {validNetwork && <span className="connected-label">Connected</span>}
                                {!validNetwork && <span className="invalid-network-label">Incorrect Network</span>}
                            </div>
                        </div>
                    </div>

                }
                {!username &&
                    <div className="dpiggy-btn outline-btn" onClick={() => this.onClickGetStart()}>SIGN IN</div>
                }
            </div>
          </div>
        </div>
      </section>
      <section>
        <div className="container">
          <div className="row" ref={(ref) => this.headerRef = ref}>
            <div className="col-md-6">
              <img src="/logo_txt.png" alt="" />
              <div className={("header-title" + this.state.headerTextAnimation)}>NO-LOSS CRYPTO INVESTING</div>
              <div className={("header-subtitle" + this.state.headerTextAnimation)}>
                Earn <span className="header-subtitle-highlight">{this.state.supplyRate == null ? <FontAwesomeIcon icon={faSpinner} className="fa-spin"></FontAwesomeIcon> : formatPercentage(this.state.supplyRate, 2)}</span> interest on your DAI and buy crypto of your choice solely with the interest earned
              </div>
              <button className="dpiggy-btn action-btn" onClick={() => this.onClickGetStart()}>GET STARTED<FontAwesomeIcon icon={faChevronRight}/></button>
            </div>
            <div className="col-md-6 d-none d-md-block">
              <img src="/images/img1.png" alt="" className={this.state.headerImgAnimation} />
            </div>
          </div>
          <div className="separator"></div>
        </div>
      </section>
      <section id="how-it-works">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="defi-title">DeFi made delightfully easy</div>
              <div className="defi-subtitle">dPiggy is simple &amp; easy-to-use</div>
            </div>
          </div>
          <div className="row defi-item">
            <div className="col-md-6">
              <div className={("defi-text-column" + this.state.bodyTextDepositAnimation)} ref={(ref) => this.bodyTextDepositRef = ref}>
                <div className="defi-item-title">Deposit DAI</div>
                <div className="defi-item-subtitle">dPiggy will automatically relay them into Compound and you’ll start earning interest instantly.</div>
              </div>
            </div>
            <div className="col-md-6 mb-2 mt-1 mb-md-0 mt-md-0">
              <img src="/images/img2.png" alt="" className={this.state.bodyImgDepositAnimation} ref={(ref) => this.bodyImgDepositRef = ref} />
            </div>
          </div>
          <div className="row defi-item">
            <div className="col-md-6 d-none d-md-block">
              <img src="/images/img3.png" alt="" className={this.state.bodyImgInterestAnimation} ref={(ref) => this.bodyImgInterestRef = ref} />
            </div>
            <div className="col-md-6">
              <div className={("defi-text-column" + this.state.bodyTextInterestAnimation)} ref={(ref) => this.bodyTextInterestRef = ref}>
                <div className="defi-item-title">Choose where your interest goes</div>
                <div className="defi-item-subtitle">You decide which percentage share of your interest earned you want to invest on each crypto.</div>
              </div>
            </div>
            <div className="col-md-6 d-md-none mb-2 mt-1">
              <img src="/images/img3.png" alt="" />
            </div>
          </div>
          <div className="row defi-item">
            <div className="col-md-6">
              <div className={("defi-text-column" + this.state.bodyTextCryptoAnimation)} ref={(ref) => this.bodyTextCryptoRef = ref}>
                <div className="defi-item-title">Interest earned will automatically flow into crypto</div>
                <div className="defi-item-subtitle">At the end of each month, the interest earned will automatically be used to purchase crypto.</div>
              </div>
            </div>
            <div className="col-md-6 mb-2 mt-1 mb-md-0 mt-md-0">
              <img src="/images/img4.png" alt="" className={this.state.bodyImgCryptoAnimation} ref={(ref) => this.bodyImgCryptoRef = ref} />
            </div>
          </div>
          <div className="row defi-item">
            <div className="col-md-6 d-none d-md-block">
              <img src="/images/img5.png" alt="" className={this.state.bodyImgPortfolioAnimation} ref={(ref) => this.bodyImgPortfolioRef = ref} />
            </div>
            <div className="col-md-6">
              <div className={("defi-text-column" + this.state.bodyTextPortfolioAnimation)} ref={(ref) => this.bodyTextPortfolioRef = ref}>
                <div className="defi-item-title">Sit back and watch your portfolio grow.</div>
                <div className="defi-item-subtitle">Watch your crypto portfolio grow over time knowing that you’ll always get back the same amount of DAI invested.</div>
              </div>
            </div>
            <div className="col-md-6 d-md-none mb-2 mt-1">
              <img src="/images/img5.png" alt="" />
            </div>
          </div>
        </div>
      </section>
      <section className="why-section" id="why">
        <img className="why-background" src="/images/img_dpiggy.png" alt=""/>
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="why-title">Why use dPiggy?</div>
              <div className="why-subtitle">100% DAI Principal Protection</div>
            </div>
          </div>
          <div className="row" ref={(ref) => this.whyRef = ref}>
            <div className={("col-md-3 why-item" + this.state.whyAnimation)}>
              <img src="/images/icon_non_custodial.png" alt=""></img>
              <div className="why-item-title">Non-Custodial</div>
              <div className="why-item-subtitle">You’re always in control of all of your funds</div>
            </div>
            <div className={("col-md-3 why-item" + this.state.whyAnimation)}>
              <img src="/images/icon_withdraw.png" alt=""></img>
              <div className="why-item-title">Withdraw anytime</div>
              <div className="why-item-subtitle">No lockup, meaning you can withdraw anytime without penalty</div>
            </div>
            <div className={("col-md-3 why-item" + this.state.whyAnimation)}>
              <img src="/images/icon_dollar_cost.png" alt=""></img>
              <div className="why-item-title">Dollar-cost averaging</div>
              <div className="why-item-subtitle">Reduce risk by investing regularly to capitalise on purchasing when the market is down</div>
            </div>
            <div className={("col-md-3 why-item" + this.state.whyAnimation)}>
              <img src="/images/icon_cost.png" alt=""></img>
              <div className="why-item-title">Cost Efficient</div>
              <div className="why-item-subtitle">Transparent 0.50% per year fee, which covers all Ethereum gas costs for rebalancing.</div>
            </div>
          </div>
        </div>
      </section>
      <section className="built-on-section" id="build-on">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="built-on-title">Built on Top Of</div>
            </div>
          </div>
          <div className="row" ref={(ref) => this.buildRef = ref}>
            <div className={("col-md-4 built-on-item" + this.state.buildAnimation)}>
              <img src="/images/logo_compound.png" alt=""></img>
            </div>
            <div className={("col-md-4 built-on-item" + this.state.buildAnimation)}>
              <img src="/images/logo_uniswap.png" alt=""></img>
            </div>
            <div className={("col-md-4 built-on-item" + this.state.buildAnimation)}>
              <img src="/images/logo_ethereum.png" alt=""></img>
            </div>
          </div>
        </div>
      </section>
      <section className="faq-section" id="faq">
        <div className={("container" + this.state.faqAnimation)} ref={ref => this.faqRef = ref}>
          <div className="row">
            <div className="col-12">
              <div className="faq-title">Frequently Asked Questions</div>
            </div>
          </div>
          <Accordion>
            {faqData.map(faq => (
                <FaqItem key={faq.id} {...faq}></FaqItem>
              ))}
          </Accordion>
        </div>
      </section>
      <section className="ready-section">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="ready-title">Ready to see the magic of DeFi?</div>
            </div>
          </div>
          <div className="row text-center"  ref={(ref) => this.footerBtnRef = ref}>
            <button className={("dpiggy-btn action-btn" + this.state.footerBtnAnimation)} onClick={() => this.onClickGetStart()}>GET STARTED<FontAwesomeIcon icon={faChevronRight}/></button>
          </div>
        </div>
      </section>
    </div>
  }
}

Home.contextTypes = {
  web3: PropTypes.object
}
export default withRouter(Home)