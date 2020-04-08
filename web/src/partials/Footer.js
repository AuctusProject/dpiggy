import './Footer.css'
import React, { Component } from 'react'
import { withRouter, NavLink } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTelegramPlane, faTwitter, faGithub } from '@fortawesome/free-brands-svg-icons'


class Footer extends Component {
  constructor(props) {
    super(props)
    this.state = { }
  }

  render() {
    return (
      <footer className="text-muted">
          <div className="container footer-container">
            <div className="row">
              <div className="col-4">
                <div className="row">
                  <div className="col-12">
                    <a className="clickable footer-link" href="/#how-it-works">How it works?</a>
                  </div>
                  <div className="col-12">
                    <a className="clickable footer-link" href="/#why">Why use dPiggy?</a>
                  </div>
                  <div className="col-12">
                    <a className="clickable footer-link" href="/#faq">FAQ</a>
                  </div>
                  <div className="col-12 mt-2">
                    <NavLink className="clickable footer-link legal mr-1" to="/terms">Terms</NavLink>
                    <span className="vr"></span>
                    <NavLink className="clickable footer-link legal ml-1" to="/privacy">Privacy</NavLink>
                  </div>
                </div>
              </div>
              <div className="col-4 text-center">
                <div className="footer-icon">
                  <NavLink className="clickable" to="/"><img src="/images/logo_icon.png" alt="" /></NavLink> 
                  <div className="footer-copyright">All rights reserved. Copyrights © 2020</div>
                </div>
              </div>
              <div className="col-4 social-icons">
                <a target="_blank" rel="noopener noreferrer" href="https://github.com/AuctusProject/dpiggy"><FontAwesomeIcon icon={faGithub} /></a>
                <a target="_blank" rel="noopener noreferrer" href="https://t.me/AuctusProject"><FontAwesomeIcon icon={faTelegramPlane} /></a>
                <a target="_blank" rel="noopener noreferrer" href="https://twitter.com/dPiggyDAO"><FontAwesomeIcon icon={faTwitter} /></a>
              </div>
            </div>
          </div>
      </footer>)
  }
}
export default withRouter(Footer)