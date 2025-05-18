import React, { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useSolana } from '../contexts/SolanaProvider';
import { PublicKey, Transaction } from '@solana/web3.js';
import { BN } from '@project-serum/anchor';

const Withdraw: React.FC = () => {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { pumpAmmSdk } = useSolana();
  const [poolMint, setPoolMint] = useState('');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('0.01');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // TODO: Replace with real pool mint list fetching
  const examplePoolMints = [
    { label: 'Example Pool Mint 1', value: 'EXAMPLE_POOL_MINT_ADDRESS_1' },
    { label: 'Example Pool Mint 2', value: 'EXAMPLE_POOL_MINT_ADDRESS_2' },
  ];

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setLoading(true);
    try {
      if (!pumpAmmSdk || !publicKey) throw new Error('Wallet not connected or SDK not ready');
      if (!poolMint || !amount) throw new Error('Please select a pool mint and enter an amount');
      const poolMintKey = new PublicKey(poolMint);
      // 1. Build withdraw instructions (using a placeholder method, adjust as needed for your SDK)
      // You may need to fetch the pool object and use the correct method for your SDK version
      // This is a placeholder for the real withdraw call
      const instructions = await pumpAmmSdk.withdrawInstructions(
        poolMintKey,
        new BN(amount),
        parseFloat(slippage),
        publicKey
      );
      // 2. Create and send transaction
      const tx = new Transaction().add(...instructions);
      const txid = await sendTransaction(tx, connection);
      setStatus(`Withdraw transaction sent! Tx: ${txid}`);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Withdraw</h2>
      <form onSubmit={handleWithdraw}>
        <div>
          <label>Pool Mint:</label>
          <select value={poolMint} onChange={e => setPoolMint(e.target.value)} disabled={!publicKey || loading}>
            <option value="">Select a pool mint</option>
            {examplePoolMints.map(m => (
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
        <button type="submit" disabled={!publicKey || loading || !poolMint || !amount}>Withdraw</button>
      </form>
      {loading && <div>Sending transaction...</div>}
      {status && <div>{status}</div>}
      {!publicKey && <div style={{ color: 'orange' }}>Connect your wallet to withdraw.</div>}
    </div>
  );
};

export default Withdraw; 