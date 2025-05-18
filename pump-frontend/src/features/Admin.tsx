import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSolana } from '../contexts/SolanaProvider';
import { PublicKey, Transaction } from '@solana/web3.js';

// Admin panel with all admin-only operations
const Admin: React.FC = () => {
  const { publicKey, sendTransaction } = useWallet();
  const { pumpSdk, pumpAmmSdk, pumpProgram, pumpAmmProgram, connection } = useSolana();
  const safeConnection = connection!; // fallback to non-null assertion for now
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [globalAccount, setGlobalAccount] = useState<any>(null);
  const [action, setAction] = useState<string>('');

  // For updateGlobalAuthority
  const [newAuthority, setNewAuthority] = useState('');
  
  // For extendAccount
  const [accountToExtend, setAccountToExtend] = useState('');
  
  // For disable 
  const [disableCreatePool, setDisableCreatePool] = useState(false);
  const [disableDeposit, setDisableDeposit] = useState(false);
  const [disableWithdraw, setDisableWithdraw] = useState(false);
  const [disableBuy, setDisableBuy] = useState(false);
  const [disableSell, setDisableSell] = useState(false);
  
  // For updateAdmin
  const [newAdmin, setNewAdmin] = useState('');
  
  // For setCreator and setCoinCreator
  const [mint, setMint] = useState('');
  const [creator, setCreator] = useState('');
  
  // Check if current wallet is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (!publicKey || !pumpSdk || !pumpAmmSdk) {
        setIsAdmin(false);
        return;
      }

      try {
        // Fetch global accounts to check admin status
        const global = await pumpSdk.fetchGlobal();
        setGlobalAccount(global);
        
        // Check if the connected wallet is an admin for either program
        const isPumpAdmin = global.authority.equals(publicKey);
        const isPumpAmmAdmin = global.admin.equals(publicKey);
        
        setIsAdmin(isPumpAdmin || isPumpAmmAdmin);
      } catch (err) {
        console.error("Error checking admin status:", err);
        setIsAdmin(false);
      }
    };

    checkAdmin();
  }, [publicKey, pumpSdk, pumpAmmSdk]);

  // Handle admin operations
  const handleAdminOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setLoading(true);
    
    try {
      if (!publicKey || !pumpSdk || !pumpAmmSdk) {
        throw new Error('Wallet not connected or SDKs not ready');
      }
      
      if (!isAdmin) {
        throw new Error('Current wallet is not authorized as admin');
      }
      
      let tx, instructions, txid;
      
      switch (action) {
        case 'updateGlobalAuthority':
          if (!newAuthority) throw new Error('New authority address is required');
          tx = await pumpProgram!.methods
            .updateGlobalAuthority()
            .accounts({
              global: await (pumpSdk as any).getPdaGlobalAddress(),
              authority: publicKey,
              newAuthority: new PublicKey(newAuthority),
            })
            .transaction();
          txid = await sendTransaction(tx, safeConnection);
          break;
          
        case 'extendAccount':
          if (!accountToExtend) throw new Error('Account address is required');
          tx = await pumpProgram!.methods
            .extendAccount()
            .accounts({
              account: new PublicKey(accountToExtend),
              user: publicKey,
            })
            .transaction();
          txid = await sendTransaction(tx, safeConnection);
          break;
          
        case 'setCreator':
          if (!mint || !creator) throw new Error('Mint and creator addresses are required');
          const mintPubkey = new PublicKey(mint);
          const metadata = await (pumpSdk as any).getMetadata(mintPubkey);
          tx = await pumpProgram!.methods
            .setCreator(new PublicKey(creator))
            .accounts({
              setCreatorAuthority: publicKey,
              global: await (pumpSdk as any).getPdaGlobalAddress(),
              mint: mintPubkey,
              metadata,
              bondingCurve: await (pumpSdk as any).getPdaBondingCurveAddress(mintPubkey),
            })
            .transaction();
          txid = await sendTransaction(tx, safeConnection);
          break;
          
        case 'setMetaplexCreator':
          if (!mint) throw new Error('Mint address is required');
          const mintKey = new PublicKey(mint);
          const metadataAccount = await (pumpSdk as any).getMetadata(mintKey);
          tx = await pumpProgram!.methods
            .setMetaplexCreator()
            .accounts({
              mint: mintKey,
              metadata: metadataAccount,
              bondingCurve: await (pumpSdk as any).getPdaBondingCurveAddress(mintKey),
            })
            .transaction();
          txid = await sendTransaction(tx, safeConnection);
          break;
          
        case 'setCoinCreator':
          if (!mint) throw new Error('Mint address is required');
          const mintKeyForCoinCreator = new PublicKey(mint);
          tx = await pumpAmmProgram!.methods
            .setCoinCreator()
            .accounts({
              pool: await (pumpAmmSdk as any).findCanonicalPoolAddress(mintKeyForCoinCreator),
              metadata: await (pumpSdk as any).getMetadata(mintKeyForCoinCreator),
              bondingCurve: await (pumpSdk as any).getPdaBondingCurveAddress(mintKeyForCoinCreator),
            })
            .transaction();
          txid = await sendTransaction(tx, safeConnection);
          break;
          
        case 'initialize':
          tx = await pumpProgram!.methods
            .initialize()
            .accounts({
              global: await (pumpSdk as any).getPdaGlobalAddress(),
              user: publicKey,
            })
            .transaction();
          txid = await sendTransaction(tx, safeConnection);
          break;
          
        case 'migrate':
          if (!mint) throw new Error('Mint address is required');
          const mintKeyForMigrate = new PublicKey(mint);
          instructions = await (pumpSdk as any).migrateInstructions(
            globalAccount,
            null,
            mintKeyForMigrate,
            publicKey
          );
          tx = new Transaction().add(...instructions);
          txid = await sendTransaction(tx, safeConnection);
          break;
          
        case 'updateAdmin':
          if (!newAdmin) throw new Error('New admin address is required');
          tx = await pumpAmmProgram!.methods
            .updateAdmin()
            .accounts({
              admin: publicKey,
              globalConfig: await (pumpAmmSdk as any).getPdaGlobalConfigAddress(),
              newAdmin: new PublicKey(newAdmin),
            })
            .transaction();
          txid = await sendTransaction(tx, safeConnection);
          break;
          
        case 'disable':
          tx = await pumpAmmProgram!.methods
            .disable(
              disableCreatePool,
              disableDeposit,
              disableWithdraw,
              disableBuy,
              disableSell
            )
            .accounts({
              admin: publicKey,
              globalConfig: await (pumpAmmSdk as any).getPdaGlobalConfigAddress(),
            })
            .transaction();
          txid = await sendTransaction(tx, safeConnection);
          break;
          
        default:
          throw new Error('Invalid action selected');
      }
      
      setStatus(`Transaction sent! Tx: ${txid}`);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!publicKey) {
    return <div>Connect your wallet to access admin features.</div>;
  }

  if (!isAdmin) {
    return <div>This wallet is not authorized to perform admin operations.</div>;
  }

  return (
    <div>
      <h2>Admin Panel</h2>
      
      <div>
        <h3>Select Admin Operation</h3>
        <select 
          value={action} 
          onChange={(e) => setAction(e.target.value)}
          disabled={loading}
        >
          <option value="">Select an operation</option>
          <option value="updateGlobalAuthority">Update Global Authority</option>
          <option value="extendAccount">Extend Account</option>
          <option value="setCreator">Set Creator</option>
          <option value="setMetaplexCreator">Sync Metaplex Creator</option>
          <option value="initialize">Initialize</option>
          <option value="migrate">Migrate</option>
          <option value="updateAdmin">Update Admin</option>
          <option value="disable">Disable Features</option>
          <option value="setCoinCreator">Set Coin Creator</option>
        </select>
      </div>
      
      <form onSubmit={handleAdminOperation}>
        {action === 'updateGlobalAuthority' && (
          <div>
            <h3>Update Global Authority</h3>
            <div>
              <label>New Authority:</label>
              <input
                type="text"
                value={newAuthority}
                onChange={(e) => setNewAuthority(e.target.value)}
                placeholder="Enter new authority address"
                disabled={loading}
                required
              />
            </div>
          </div>
        )}
        
        {action === 'extendAccount' && (
          <div>
            <h3>Extend Account</h3>
            <div>
              <label>Account to Extend:</label>
              <input
                type="text"
                value={accountToExtend}
                onChange={(e) => setAccountToExtend(e.target.value)}
                placeholder="Enter account address"
                disabled={loading}
                required
              />
            </div>
          </div>
        )}
        
        {action === 'setCreator' && (
          <div>
            <h3>Set Creator</h3>
            <div>
              <label>Mint:</label>
              <input
                type="text"
                value={mint}
                onChange={(e) => setMint(e.target.value)}
                placeholder="Enter mint address"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label>Creator:</label>
              <input
                type="text"
                value={creator}
                onChange={(e) => setCreator(e.target.value)}
                placeholder="Enter creator address"
                disabled={loading}
                required
              />
            </div>
          </div>
        )}
        
        {action === 'setMetaplexCreator' && (
          <div>
            <h3>Sync Metaplex Creator</h3>
            <div>
              <label>Mint:</label>
              <input
                type="text"
                value={mint}
                onChange={(e) => setMint(e.target.value)}
                placeholder="Enter mint address"
                disabled={loading}
                required
              />
            </div>
          </div>
        )}
        
        {action === 'setCoinCreator' && (
          <div>
            <h3>Set Coin Creator (AMM)</h3>
            <div>
              <label>Mint:</label>
              <input
                type="text"
                value={mint}
                onChange={(e) => setMint(e.target.value)}
                placeholder="Enter mint address"
                disabled={loading}
                required
              />
            </div>
          </div>
        )}
        
        {action === 'migrate' && (
          <div>
            <h3>Migrate to AMM</h3>
            <div>
              <label>Mint:</label>
              <input
                type="text"
                value={mint}
                onChange={(e) => setMint(e.target.value)}
                placeholder="Enter mint address"
                disabled={loading}
                required
              />
            </div>
          </div>
        )}
        
        {action === 'updateAdmin' && (
          <div>
            <h3>Update Admin (AMM)</h3>
            <div>
              <label>New Admin:</label>
              <input
                type="text"
                value={newAdmin}
                onChange={(e) => setNewAdmin(e.target.value)}
                placeholder="Enter new admin address"
                disabled={loading}
                required
              />
            </div>
          </div>
        )}
        
        {action === 'disable' && (
          <div>
            <h3>Disable Features (AMM)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label>
                <input
                  type="checkbox"
                  checked={disableCreatePool}
                  onChange={(e) => setDisableCreatePool(e.target.checked)}
                  disabled={loading}
                />
                Disable Create Pool
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={disableDeposit}
                  onChange={(e) => setDisableDeposit(e.target.checked)}
                  disabled={loading}
                />
                Disable Deposit
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={disableWithdraw}
                  onChange={(e) => setDisableWithdraw(e.target.checked)}
                  disabled={loading}
                />
                Disable Withdraw
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={disableBuy}
                  onChange={(e) => setDisableBuy(e.target.checked)}
                  disabled={loading}
                />
                Disable Buy
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={disableSell}
                  onChange={(e) => setDisableSell(e.target.checked)}
                  disabled={loading}
                />
                Disable Sell
              </label>
            </div>
          </div>
        )}
        
        {action === 'initialize' && (
          <div>
            <h3>Initialize Global State</h3>
            <p>This will initialize the global state for the Pump program.</p>
          </div>
        )}
        
        {action && (
          <button type="submit" disabled={loading}>
            {loading ? 'Processing...' : 'Execute'}
          </button>
        )}
      </form>
      
      {status && <div>{status}</div>}
    </div>
  );
};

export default Admin; 