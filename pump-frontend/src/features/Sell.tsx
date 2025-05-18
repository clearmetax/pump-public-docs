import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSolana } from '../contexts/SolanaProvider';
import { PublicKey, Transaction, Connection } from '@solana/web3.js';
import { BN } from '@project-serum/anchor';

const Sell: React.FC = () => {
  const { publicKey, sendTransaction } = useWallet();
  const { pumpSdk } = useSolana();
  const [amount, setAmount] = useState('');
  const [mint, setMint] = useState('');
  const [minSolOut, setMinSolOut] = useState('');
  const [slippage, setSlippage] = useState('0.01');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // TODO: Replace with real pool/mint list fetching
  const exampleMints = [
    { label: 'Example Mint 1', value: 'EXAMPLE_MINT_ADDRESS_1' },
    { label: 'Example Mint 2', value: 'EXAMPLE_MINT_ADDRESS_2' },
  ];

  const handleSell = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setLoading(true);
    try {
      if (!pumpSdk || !publicKey) throw new Error('Wallet not connected or SDK not ready');
      if (!mint || !amount || !minSolOut) throw new Error('Please select a mint and enter all amounts');
      const mintKey = new PublicKey(mint);
      // 1. Fetch global
      const global = await pumpSdk.fetchGlobal();
      // 2. Build sell instructions
      const instructions = await pumpSdk.sellInstructions(
        global,
        null, // bondingCurveAccountInfo (null is fine for most cases)
        mintKey,
        publicKey,
        new BN(amount),
        new BN(minSolOut),
        parseFloat(slippage)
      );
      // 3. Create and send transaction
      const tx = new Transaction().add(...instructions);
      const txid = await sendTransaction(tx, pumpSdk["connection"] as Connection);
      setStatus(`Sell transaction sent! Tx: ${txid}`);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Sell</h2>
      <form onSubmit={handleSell}>
        <div>
          <label>Mint:</label>
          <select value={mint} onChange={e => setMint(e.target.value)} disabled={!publicKey || loading}>
            <option value="">Select a mint</option>
            {exampleMints.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Amount:</label>
          <input
            type="number"
            min="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            disabled={!publicKey || loading}
          />
        </div>
        <div>
          <label>Min SOL Out:</label>
          <input
            type="number"
            min="0"
            value={minSolOut}
            onChange={e => setMinSolOut(e.target.value)}
            disabled={!publicKey || loading}
          />
        </div>
        <div>
          <label>Slippage (e.g. 0.01 = 1%):</label>
          <input
            type="number"
            min="0"
            step="0.001"
            value={slippage}
            onChange={e => setSlippage(e.target.value)}
            disabled={!publicKey || loading}
          />
        </div>
        <button type="submit" disabled={!publicKey || loading || !mint || !amount || !minSolOut}>Sell</button>
      </form>
      {loading && <div>Sending transaction...</div>}
      {status && <div>{status}</div>}
      {!publicKey && <div style={{ color: 'orange' }}>Connect your wallet to sell.</div>}
    </div>
  );
};

export default Sell; 