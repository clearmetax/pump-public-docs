import React, { useState } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import '@solana/wallet-adapter-react-ui/styles.css';
import { SolanaProvider } from './contexts/SolanaProvider';
import Buy from './features/Buy';
import Sell from './features/Sell';
import Create from './features/Create';
import Deposit from './features/Deposit';
import Withdraw from './features/Withdraw';
import CollectFees from './features/CollectFees';
import SetParams from './features/SetParams';
import Admin from './features/Admin';
import AmmBuy from './features/AmmBuy';
import AmmSell from './features/AmmSell';
import CreatePool from './features/CreatePool';
import History from './features/History';
import './App.css';

function App() {
  // Connect to Solana mainnet
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = clusterApiUrl(network);
  
  // Initialize wallet adapters
  const wallets = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ];
  
  // State for navigation
  const [activeTab, setActiveTab] = useState<string>('buy');
  
  // Navigation tabs
  const tabs = [
    { id: 'buy', label: 'Buy', component: Buy },
    { id: 'sell', label: 'Sell', component: Sell },
    { id: 'ammBuy', label: 'AMM Buy', component: AmmBuy },
    { id: 'ammSell', label: 'AMM Sell', component: AmmSell },
    { id: 'create', label: 'Create Token', component: Create },
    { id: 'createPool', label: 'Create Pool', component: CreatePool },
    { id: 'deposit', label: 'Deposit', component: Deposit },
    { id: 'withdraw', label: 'Withdraw', component: Withdraw },
    { id: 'collectFees', label: 'Collect Fees', component: CollectFees },
    { id: 'history', label: 'History', component: History },
    { id: 'admin', label: 'Admin Panel', component: Admin },
    { id: 'setParams', label: 'Global Config', component: SetParams },
  ];
  
  // Get active component
  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || Buy;

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <SolanaProvider>
            <div className="App">
              <header className="App-header">
                <h1>Pump Protocol Frontend</h1>
                <WalletMultiButton />
              </header>
              
              <nav className="App-nav">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    className={activeTab === tab.id ? 'active' : ''}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
              
              <main className="App-content">
                <ActiveComponent />
              </main>
              
              <footer className="App-footer">
                <p>Pump Protocol - Production Implementation</p>
              </footer>
            </div>
          </SolanaProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
