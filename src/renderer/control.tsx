import React from 'react'
import ReactDOM from 'react-dom/client'
import { ControlWindow } from './windows/control/ControlWindow'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ControlWindow />
  </React.StrictMode>
)
