import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSolana } from '../contexts/SolanaProvider';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@project-serum/anchor';

const CreatePool: React.FC = () => {
  const { publicKey, sendTransaction } = useWallet();
  const { pumpAmmSdk, pumpAmmProgram, connection } = useSolana();
  const safeConnection = connection!;
  const [baseAmount, setBaseAmount] = useState('');
  const [quoteAmount, setQuoteAmount] = useState('');
  const [index, setIndex] = useState('0');
  const [baseMint, setBaseMint] = useState('');
  const [quoteMint, setQuoteMint] = useState('');
  const [coinCreator, setCoinCreator] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Set the current user as the default coin creator
  useEffect(() => {
    if (publicKey) {
      setCoinCreator(publicKey.toString());
    }
  }, [publicKey]);

  const handleCreatePool = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setLoading(true);
    
    try {
      if (!publicKey || !pumpAmmSdk || !pumpAmmProgram) {
        throw new Error('Wallet not connected or SDK not ready');
      }
      
      if (!baseMint || !quoteMint || !baseAmount || !quoteAmount || !index || !coinCreator) {
        throw new Error('Please fill in all required fields');
      }
      
      const baseMintPubkey = new PublicKey(baseMint);
      const quoteMintPubkey = new PublicKey(quoteMint);
      const coinCreatorPubkey = new PublicKey(coinCreator);
      
      // Get token accounts
      const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
      const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
      
      // User's token accounts for base and quote tokens
      const userBaseTokenAccount = await getAssociatedTokenAddress(
        publicKey,
        baseMintPubkey,
        false,
        TOKEN_PROGRAM_ID
      );
      
      const userQuoteTokenAccount = await getAssociatedTokenAddress(
        publicKey,
        quoteMintPubkey,
        false,
        TOKEN_PROGRAM_ID
      );
      
      // Calculate pool address (this will be calculated on-chain too)
      const [poolAddress] = await PublicKey.findProgramAddress(
        [
          Buffer.from('pool'),
          new Uint8Array([parseInt(index) & 0xff, (parseInt(index) >> 8) & 0xff]), // uint16 to two bytes
          publicKey.toBuffer(),
          baseMintPubkey.toBuffer(),
          quoteMintPubkey.toBuffer()
        ],
        pumpAmmProgram.programId
      );
      
      // Calculate LP mint address
      const [lpMint] = await PublicKey.findProgramAddress(
        [
          Buffer.from('pool_lp_mint'),
          poolAddress.toBuffer()
        ],
        pumpAmmProgram.programId
      );
      
      // User's LP token account
      const userPoolTokenAccount = await getAssociatedTokenAddress(
        publicKey,
        lpMint,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      
      // Pool token accounts
      const poolBaseTokenAccount = await getAssociatedTokenAddress(
        poolAddress,
        baseMintPubkey,
        true, // Allow off curve (pools are PDAs)
        TOKEN_PROGRAM_ID
      );
      
      const poolQuoteTokenAccount = await getAssociatedTokenAddress(
        poolAddress,
        quoteMintPubkey,
        true, // Allow off curve (pools are PDAs)
        TOKEN_PROGRAM_ID
      );
      
      // Get global config
      const globalConfig = await (pumpAmmSdk as any).getGlobalConfig();
      
      // Build the transaction
      const tx = await pumpAmmProgram.methods
        .createPool(
          parseInt(index), // index as u16
          new BN(baseAmount), // baseAmountIn
          new BN(quoteAmount), // quoteAmountIn
          coinCreatorPubkey // coinCreator
        )
        .accounts({
          pool: poolAddress,
          globalConfig,
          creator: publicKey,
          baseMint: baseMintPubkey,
          quoteMint: quoteMintPubkey,
          lpMint,
          userBaseTokenAccount,
          userQuoteTokenAccount,
          userPoolTokenAccount,
          poolBaseTokenAccount,
          poolQuoteTokenAccount,
          systemProgram: new PublicKey('11111111111111111111111111111111'),
          token2022Program: TOKEN_2022_PROGRAM_ID,
          baseTokenProgram: TOKEN_PROGRAM_ID,
          quoteTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .transaction();
      
      const txid = await sendTransaction(tx, safeConnection);
      
      setStatus(`Pool created successfully! Tx: ${txid}`);
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
      <h2>Create AMM Pool</h2>
      
      {!publicKey ? (
        <div>Connect your wallet to create a pool.</div>
      ) : (
        <form onSubmit={handleCreatePool}>
          <div>
            <label>Pool Index:</label>
            <input
              type="number"
              min="0"
              max="65535" // Max uint16
              value={index}
              onChange={(e) => setIndex(e.target.value)}
              placeholder="Enter pool index (unique identifier)"
              disabled={loading}
              required
            />
            <small>This should be a unique index per creator, base mint, and quote mint.</small>
          </div>
          
          <div>
            <label>Base Token Mint:</label>
            <input
              type="text"
              value={baseMint}
              onChange={(e) => setBaseMint(e.target.value)}
              placeholder="Enter base token mint address"
              disabled={loading}
              required
            />
            <small>This is the token you want to trade (e.g., your custom token).</small>
          </div>
          
          <div>
            <label>Quote Token Mint:</label>
            <input
              type="text"
              value={quoteMint}
              onChange={(e) => setQuoteMint(e.target.value)}
              placeholder="Enter quote token mint address"
              disabled={loading}
              required
            />
            <small>This is typically SOL (So11111111111111111111111111111111111111112).</small>
          </div>
          
          <div>
            <label>Base Amount to Deposit:</label>
            <input
              type="text"
              value={baseAmount}
              onChange={(e) => setBaseAmount(e.target.value)}
              placeholder="Enter base token amount to deposit"
              disabled={loading}
              required
            />
          </div>
          
          <div>
            <label>Quote Amount to Deposit:</label>
            <input
              type="text"
              value={quoteAmount}
              onChange={(e) => setQuoteAmount(e.target.value)}
              placeholder="Enter quote token amount to deposit"
              disabled={loading}
              required
            />
          </div>
          
          <div>
            <label>Coin Creator:</label>
            <input
              type="text"
              value={coinCreator}
              onChange={(e) => setCoinCreator(e.target.value)}
              placeholder="Enter coin creator address"
              disabled={loading}
              required
            />
            <small>This account will receive creator fees.</small>
          </div>
          
          <button 
            type="submit" 
            disabled={loading || !baseMint || !quoteMint || !baseAmount || !quoteAmount || !index}
          >
            {loading ? 'Processing...' : 'Create Pool'}
          </button>
        </form>
      )}
      
      {status && <div>{status}</div>}
    </div>
  );
};

export default CreatePool; 