import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSolana } from '../contexts/SolanaProvider';
import { PublicKey, Transaction, Connection } from '@solana/web3.js';

const Create: React.FC = () => {
  const { publicKey, sendTransaction } = useWallet();
  const { pumpSdk } = useSolana();
  const [mint, setMint] = useState('');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [uri, setUri] = useState('');
  const [creator, setCreator] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setLoading(true);
    try {
      if (!pumpSdk || !publicKey) throw new Error('Wallet not connected or SDK not ready');
      if (!mint || !name || !symbol || !uri || !creator) throw new Error('Please fill in all fields');
      const mintKey = new PublicKey(mint);
      const creatorKey = new PublicKey(creator);
      // 1. Build create instruction
      const instruction = await pumpSdk.createInstruction(
        mintKey,
        name,
        symbol,
        uri,
        creatorKey,
        publicKey
      );
      // 2. Create and send transaction
      const tx = new Transaction().add(instruction);
      const txid = await sendTransaction(tx, pumpSdk["connection"] as Connection);
      setStatus(`Create transaction sent! Tx: ${txid}`);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Create</h2>
      <form onSubmit={handleCreate}>
        <div>
          <label>Mint Address:</label>
          <input
            type="text"
            value={mint}
            onChange={e => setMint(e.target.value)}
            disabled={!publicKey || loading}
          />
        </div>
        <div>
          <label>Name:</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={!publicKey || loading}
          />
        </div>
        <div>
          <label>Symbol:</label>
          <input
            type="text"
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            disabled={!publicKey || loading}
          />
        </div>
        <div>
          <label>URI:</label>
          <input
            type="text"
            value={uri}
            onChange={e => setUri(e.target.value)}
            disabled={!publicKey || loading}
          />
        </div>
        <div>
          <label>Creator Address:</label>
          <input
            type="text"
            value={creator}
            onChange={e => setCreator(e.target.value)}
            disabled={!publicKey || loading}
          />
        </div>
        <button type="submit" disabled={!publicKey || loading || !mint || !name || !symbol || !uri || !creator}>Create</button>
      </form>
      {loading && <div>Sending transaction...</div>}
      {status && <div>{status}</div>}
      {!publicKey && <div style={{ color: 'orange' }}>Connect your wallet to create.</div>}
    </div>
  );
};

export default Create; 