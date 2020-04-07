import './CoinDetails.css'
import React, { Component } from 'react'

class CoinDetails extends Component {
  render() {
    return <div className="coin-details">
      <img src={"/images/" + this.props.coin.icon} className="coin-icon" alt="Coin" />
      <div className="coin-name-code">
        <span className="coin-name">{this.props.coin.name}</span>
        <span className="coin-code">{this.props.coin.code}</span>
      </div>
    </div>
  }
}
export default CoinDetails