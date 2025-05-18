import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSolana } from '../contexts/SolanaProvider';
import { PublicKey } from '@solana/web3.js';

const CollectFees: React.FC = () => {
  const { publicKey, sendTransaction } = useWallet();
  const { pumpSdk, pumpAmmSdk, pumpProgram, pumpAmmProgram, connection } = useSolana();
  const safeConnection = connection!;
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [mint, setMint] = useState('');
  const [selectedProgram, setSelectedProgram] = useState<'pump' | 'pumpAmm'>('pump');
  const [quoteMint, setQuoteMint] = useState('');

  // Check if creator wallet is connected
  const isWalletConnected = !!publicKey;

  const handleCollectFees = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setLoading(true);
    
    try {
      if (!publicKey) {
        throw new Error('Wallet not connected');
      }
      
      let tx, txid;
      
      if (selectedProgram === 'pump') {
        // Collect creator fee from Pump program
        if (!pumpSdk || !pumpProgram) {
          throw new Error('Pump SDK not ready');
        }
        
        if (!mint) {
          throw new Error('Mint address is required');
        }
        
        // Get creator vault PDA
        const creatorVaultAddress = await PublicKey.findProgramAddress(
          [
            Buffer.from('creator-vault'),
            publicKey.toBuffer(),
          ],
          pumpProgram.programId
        );
        
        tx = await pumpProgram.methods
          .collectCreatorFee()
          .accounts({
            creator: publicKey,
            creatorVault: creatorVaultAddress[0],
            systemProgram: SystemProgram.programId,
          })
          .transaction();
        
        txid = await sendTransaction(tx, safeConnection);
      } else {
        // Collect coin creator fee from Pump AMM program
        if (!pumpAmmSdk || !pumpAmmProgram) {
          throw new Error('Pump AMM SDK not ready');
        }
        
        if (!quoteMint) {
          throw new Error('Quote mint address is required');
        }
        
        const quoteMintPubkey = new PublicKey(quoteMint);
        
        // Get creator vault authority PDA
        const creatorVaultAuthority = await PublicKey.findProgramAddress(
          [
            Buffer.from('creator_vault'),
            publicKey.toBuffer(),
          ],
          pumpAmmProgram.programId
        );
        
        // Get ATA for the creator vault
        const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
        const creatorVaultAta = await getAssociatedTokenAddress(
          creatorVaultAuthority[0],
          quoteMintPubkey,
          false,
          TOKEN_PROGRAM_ID
        );
        
        // Get creator's own token account
        const creatorTokenAccount = await getAssociatedTokenAddress(
          publicKey,
          quoteMintPubkey,
          false,
          TOKEN_PROGRAM_ID
        );
        
        tx = await pumpAmmProgram.methods
          .collectCoinCreatorFee()
          .accounts({
            quoteMint: quoteMintPubkey,
            quoteTokenProgram: TOKEN_PROGRAM_ID,
            coinCreator: publicKey,
            coinCreatorVaultAuthority: creatorVaultAuthority[0],
            coinCreatorVaultAta: creatorVaultAta,
            coinCreatorTokenAccount: creatorTokenAccount,
          })
          .transaction();
        
        txid = await sendTransaction(tx, safeConnection);
      }
      
      setStatus(`Fees collected successfully! Tx: ${txid}`);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Helper functions for ATAs and PDAs
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

  // Solana native accounts
  const SystemProgram = {
    programId: new PublicKey('11111111111111111111111111111111')
  };

  return (
    <div>
      <h2>Collect Fees</h2>
      
      {!isWalletConnected ? (
        <div>Connect your wallet to collect your creator fees.</div>
      ) : (
        <>
          <div style={{ marginBottom: '20px' }}>
            <div>
              <label>
                <input
                  type="radio"
                  name="program"
                  value="pump"
                  checked={selectedProgram === 'pump'}
                  onChange={() => setSelectedProgram('pump')}
                  disabled={loading}
                />
                Pump (Original Bonding Curve)
              </label>
            </div>
            <div>
              <label>
                <input
                  type="radio"
                  name="program"
                  value="pumpAmm"
                  checked={selectedProgram === 'pumpAmm'}
                  onChange={() => setSelectedProgram('pumpAmm')}
                  disabled={loading}
                />
                Pump AMM
              </label>
            </div>
          </div>
          
          <form onSubmit={handleCollectFees}>
            {selectedProgram === 'pump' && (
              <div>
                <p>Collect creator fees from the Pump bonding curve program.</p>
                <div>
                  <label>Mint (optional):</label>
                  <input
                    type="text"
                    value={mint}
                    onChange={(e) => setMint(e.target.value)}
                    placeholder="Optional: Enter mint address"
                    disabled={loading}
                  />
                </div>
              </div>
            )}
            
            {selectedProgram === 'pumpAmm' && (
              <div>
                <p>Collect coin creator fees from the Pump AMM program.</p>
                <div>
                  <label>Quote Mint (usually SOL):</label>
                  <input
                    type="text"
                    value={quoteMint}
                    onChange={(e) => setQuoteMint(e.target.value)}
                    placeholder="Enter quote mint address"
                    disabled={loading}
                    required={selectedProgram === 'pumpAmm'}
                  />
                </div>
              </div>
            )}
            
            <button type="submit" disabled={loading || (selectedProgram === 'pumpAmm' && !quoteMint)}>
              {loading ? 'Processing...' : 'Collect Fees'}
            </button>
          </form>
          
          {status && <div>{status}</div>}
        </>
      )}
    </div>
  );
};

export default CollectFees; 