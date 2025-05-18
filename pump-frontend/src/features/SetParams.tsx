import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSolana } from '../contexts/SolanaProvider';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@project-serum/anchor';

const SetParams: React.FC = () => {
  const { publicKey, sendTransaction } = useWallet();
  const { pumpSdk, pumpProgram, connection } = useSolana();
  const safeConnection = connection!;
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isAuthority, setIsAuthority] = useState(false);
  const [globalAccount, setGlobalAccount] = useState<any>(null);

  // Form state for all setParams parameters
  const [initialVirtualTokenReserves, setInitialVirtualTokenReserves] = useState('');
  const [initialVirtualSolReserves, setInitialVirtualSolReserves] = useState('');
  const [initialRealTokenReserves, setInitialRealTokenReserves] = useState('');
  const [tokenTotalSupply, setTokenTotalSupply] = useState('');
  const [feeBasisPoints, setFeeBasisPoints] = useState('');
  const [withdrawAuthority, setWithdrawAuthority] = useState('');
  const [enableMigrate, setEnableMigrate] = useState(false);
  const [poolMigrationFee, setPoolMigrationFee] = useState('');
  const [creatorFeeBasisPoints, setCreatorFeeBasisPoints] = useState('');
  const [setCreatorAuthority, setSetCreatorAuthority] = useState('');

  // Check if current wallet is the authority
  useEffect(() => {
    const checkAuthority = async () => {
      if (!publicKey || !pumpSdk) {
        setIsAuthority(false);
        return;
      }

      try {
        // Fetch global account to check authority
        const global = await pumpSdk.fetchGlobal();
        setGlobalAccount(global);
        
        // Check if the connected wallet is the authority
        setIsAuthority(global.authority.equals(publicKey));
        
        // Set form values based on current global state
        if (global) {
          setInitialVirtualTokenReserves(global.initialVirtualTokenReserves.toString());
          setInitialVirtualSolReserves(global.initialVirtualSolReserves.toString());
          setInitialRealTokenReserves(global.initialRealTokenReserves.toString());
          setTokenTotalSupply(global.tokenTotalSupply.toString());
          setFeeBasisPoints(global.feeBasisPoints.toString());
          setWithdrawAuthority(global.withdrawAuthority.toBase58());
          setEnableMigrate(global.enableMigrate);
          setPoolMigrationFee(global.poolMigrationFee.toString());
          setCreatorFeeBasisPoints(global.creatorFeeBasisPoints.toString());
          setSetCreatorAuthority((global as any)?.setCreatorAuthority?.toBase58?.() || '');
        }
      } catch (err) {
        console.error("Error checking authority status:", err);
        setIsAuthority(false);
      }
    };

    checkAuthority();
  }, [publicKey, pumpSdk]);

  const handleSetParams = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setLoading(true);
    
    try {
      if (!publicKey || !pumpSdk || !pumpProgram) {
        throw new Error('Wallet not connected or SDK not ready');
      }
      
      if (!isAuthority) {
        throw new Error('Current wallet is not authorized as authority');
      }
      
      // Validate inputs
      if (!initialVirtualTokenReserves || !initialVirtualSolReserves || 
          !initialRealTokenReserves || !tokenTotalSupply || !feeBasisPoints ||
          !withdrawAuthority || !poolMigrationFee || !creatorFeeBasisPoints || 
          !setCreatorAuthority) {
        throw new Error('All fields are required');
      }
      
      // Build and send setParams transaction
      const tx = await pumpProgram.methods
        .setParams(
          new BN(initialVirtualTokenReserves),
          new BN(initialVirtualSolReserves),
          new BN(initialRealTokenReserves),
          new BN(tokenTotalSupply),
          new BN(feeBasisPoints),
          new PublicKey(withdrawAuthority),
          enableMigrate,
          new BN(poolMigrationFee),
          new BN(creatorFeeBasisPoints),
          new PublicKey(setCreatorAuthority)
        )
        .accounts({
          global: globalAccount.publicKey,
          authority: publicKey,
        })
        .transaction();
      
      const txid = await sendTransaction(tx, safeConnection);
      setStatus(`Parameters set successfully! Tx: ${txid}`);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!publicKey) {
    return <div>Connect your wallet to access params settings.</div>;
  }

  if (!isAuthority) {
    return <div>This wallet is not authorized to set parameters.</div>;
  }

  return (
    <div>
      <h2>Set Global Parameters</h2>
      
      <form onSubmit={handleSetParams}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '500px' }}>
          <div>
            <label>Initial Virtual Token Reserves:</label>
            <input
              type="text"
              value={initialVirtualTokenReserves}
              onChange={(e) => setInitialVirtualTokenReserves(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          
          <div>
            <label>Initial Virtual SOL Reserves:</label>
            <input
              type="text" 
              value={initialVirtualSolReserves}
              onChange={(e) => setInitialVirtualSolReserves(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          
          <div>
            <label>Initial Real Token Reserves:</label>
            <input
              type="text"
              value={initialRealTokenReserves}
              onChange={(e) => setInitialRealTokenReserves(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          
          <div>
            <label>Token Total Supply:</label>
            <input
              type="text"
              value={tokenTotalSupply}
              onChange={(e) => setTokenTotalSupply(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          
          <div>
            <label>Fee Basis Points:</label>
            <input
              type="text"
              value={feeBasisPoints}
              onChange={(e) => setFeeBasisPoints(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          
          <div>
            <label>Withdraw Authority:</label>
            <input
              type="text"
              value={withdrawAuthority}
              onChange={(e) => setWithdrawAuthority(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          
          <div>
            <label>
              <input
                type="checkbox"
                checked={enableMigrate}
                onChange={(e) => setEnableMigrate(e.target.checked)}
                disabled={loading}
              />
              Enable Migrate
            </label>
          </div>
          
          <div>
            <label>Pool Migration Fee:</label>
            <input
              type="text"
              value={poolMigrationFee}
              onChange={(e) => setPoolMigrationFee(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          
          <div>
            <label>Creator Fee Basis Points:</label>
            <input
              type="text"
              value={creatorFeeBasisPoints}
              onChange={(e) => setCreatorFeeBasisPoints(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          
          <div>
            <label>Set Creator Authority:</label>
            <input
              type="text"
              value={setCreatorAuthority}
              onChange={(e) => setSetCreatorAuthority(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          
          <button type="submit" disabled={loading}>
            {loading ? 'Processing...' : 'Set Parameters'}
          </button>
        </div>
      </form>
      
      {status && <div>{status}</div>}
    </div>
  );
};

export default SetParams; 