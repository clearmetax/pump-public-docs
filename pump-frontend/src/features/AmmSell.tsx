import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSolana } from '../contexts/SolanaProvider';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@project-serum/anchor';

const AmmSell: React.FC = () => {
  const { publicKey, sendTransaction } = useWallet();
  const { pumpAmmSdk, pumpAmmProgram, connection } = useSolana();
  const safeConnection = connection!;
  const [amount, setAmount] = useState('');
  const [poolAddress, setPoolAddress] = useState('');
  const [slippage, setSlippage] = useState('0.01');
  const [minQuoteAmount, setMinQuoteAmount] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pools, setPools] = useState<any[]>([]);

  // Fetch available pools when component mounts
  useEffect(() => {
    const fetchPools = async () => {
      if (!pumpAmmSdk) return;
      
      try {
        const fetchedPools = await (pumpAmmSdk as any).fetchPools();
        setPools(fetchedPools || []);
      } catch (err) {
        console.error("Error fetching pools:", err);
      }
    };
    
    fetchPools();
  }, [pumpAmmSdk]);

  const handleSell = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setLoading(true);
    
    try {
      if (!publicKey || !pumpAmmSdk || !pumpAmmProgram) {
        throw new Error('Wallet not connected or SDK not ready');
      }
      
      if (!poolAddress || !amount || !minQuoteAmount) {
        throw new Error('Please fill in all required fields');
      }
      
      const poolPubkey = new PublicKey(poolAddress);
      
      // Fetch pool data to get mints and other required accounts
      const pool = await pumpAmmSdk.fetchPool(poolPubkey);
      if (!pool) {
        throw new Error('Pool not found');
      }
      
      // Get token accounts
      const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
      
      // Base token (the token you want to sell)
      const baseMint = pool.baseMint;
      const userBaseTokenAccount = await getAssociatedTokenAddress(
        publicKey,
        baseMint,
        false,
        TOKEN_PROGRAM_ID
      );
      
      // Quote token (usually SOL or USDC that you'll receive)
      const quoteMint = pool.quoteMint;
      const userQuoteTokenAccount = await getAssociatedTokenAddress(
        publicKey,
        quoteMint,
        false,
        TOKEN_PROGRAM_ID
      );
      
      // Protocol fee recipient (from global config)
      const globalConfig = await (pumpAmmSdk as any).fetchGlobalConfig();
      const protocolFeeRecipient = globalConfig.protocolFeeRecipients[0]; // First fee recipient
      
      const protocolFeeRecipientTokenAccount = await getAssociatedTokenAddress(
        protocolFeeRecipient,
        quoteMint,
        false,
        TOKEN_PROGRAM_ID
      );
      
      // Coin creator accounts
      const coinCreator = pool.coinCreator;
      const creatorVaultAuthority = await PublicKey.findProgramAddress(
        [Buffer.from('creator_vault'), coinCreator.toBuffer()],
        pumpAmmProgram.programId
      );
      
      const coinCreatorVaultAta = await getAssociatedTokenAddress(
        creatorVaultAuthority[0],
        quoteMint,
        false,
        TOKEN_PROGRAM_ID
      );
      
      // Build the transaction
      const tx = await pumpAmmProgram.methods
        .sell(
          new BN(amount), // baseAmountIn - amount of tokens to sell
          new BN(minQuoteAmount) // minQuoteAmountOut - min amount expected to receive
        )
        .accounts({
          pool: poolPubkey,
          user: publicKey,
          globalConfig: await (pumpAmmSdk as any).getPdaGlobalConfigAddress(),
          baseMint,
          quoteMint,
          userBaseTokenAccount,
          userQuoteTokenAccount,
          poolBaseTokenAccount: pool.poolBaseTokenAccount,
          poolQuoteTokenAccount: pool.poolQuoteTokenAccount,
          protocolFeeRecipient,
          protocolFeeRecipientTokenAccount,
          baseTokenProgram: TOKEN_PROGRAM_ID,
          quoteTokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: new PublicKey('11111111111111111111111111111111'),
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          coinCreatorVaultAta,
          coinCreatorVaultAuthority: creatorVaultAuthority[0],
        })
        .transaction();
      
      const txid = await sendTransaction(tx, safeConnection);
      
      setStatus(`Sell transaction sent! Tx: ${txid}`);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get associated token address
  async function getAssociatedTokenAddress(
    owner: PublicKey,
    mint: PublicKey,
    allowOwnerOffCurve = false,
    programId = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
    associatedTokenProgramId = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
  ): Promise<PublicKey> {
    // This is a simple implementation - in production, use @solana/spl-token
    const [address] = await PublicKey.findProgramAddress(
      [owner.toBuffer(), programId.toBuffer(), mint.toBuffer()],
      associatedTokenProgramId
    );
    return address;
  }

  return (
    <div>
      <h2>AMM Sell</h2>
      
      {!publicKey ? (
        <div>Connect your wallet to sell tokens.</div>
      ) : (
        <form onSubmit={handleSell}>
          <div>
            <label>Pool:</label>
            <select 
              value={poolAddress} 
              onChange={(e) => setPoolAddress(e.target.value)}
              disabled={loading}
              required
            >
              <option value="">Select a pool</option>
              {pools.map((pool, index) => (
                <option key={index} value={pool.publicKey.toString()}>
                  {pool.baseMint.toString().slice(0, 8)}.../{pool.quoteMint.toString().slice(0, 8)}...
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label>Amount to Sell:</label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount of tokens to sell"
              disabled={loading}
              required
            />
          </div>
          
          <div>
            <label>Min Amount to Receive:</label>
            <input
              type="text"
              value={minQuoteAmount}
              onChange={(e) => setMinQuoteAmount(e.target.value)}
              placeholder="Enter minimum amount you expect to receive"
              disabled={loading}
              required
            />
          </div>
          
          <div>
            <label>Slippage (%):</label>
            <input
              type="text"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
              placeholder="Enter slippage tolerance (e.g. 1.0 for 1%)"
              disabled={loading}
            />
          </div>
          
          <button type="submit" disabled={loading || !poolAddress || !amount || !minQuoteAmount}>
            {loading ? 'Processing...' : 'Sell'}
          </button>
        </form>
      )}
      
      {status && <div>{status}</div>}
    </div>
  );
};

export default AmmSell; 