import React from 'react'
import ReactDOM from 'react-dom/client'
import { SubtitleWindow } from './windows/subtitle/SubtitleWindow'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SubtitleWindow />
  </React.StrictMode>
)
