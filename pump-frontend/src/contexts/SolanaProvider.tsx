import React, { createContext, useContext, useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider, Program, Idl } from '@project-serum/anchor';
import pumpIdl from '../idl/pump.json';
import pumpAmmIdl from '../idl/pump_amm.json';
import { PumpSdk } from '@pump-fun/pump-sdk';
import { PumpAmmSdk } from '@pump-fun/pump-swap-sdk';
import { PublicKey, Connection } from '@solana/web3.js';

// Helper method to get Solana connection from the context
export function useSolanaConnection() {
  const { connection } = useConnection();
  return connection;
}

const SolanaContext = createContext<SolanaContextType>({
  anchorProvider: null,
  pumpProgram: null,
  pumpAmmProgram: null,
  pumpSdk: null,
  pumpAmmSdk: null,
  connection: null,
});

export const useSolana = () => useContext(SolanaContext);

export const SolanaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { connection } = useConnection();
  const wallet = useWallet();

  const anchorProvider = useMemo(() => {
    if (!wallet || !wallet.publicKey) return null;
    return new AnchorProvider(connection, wallet as any, { preflightCommitment: 'processed' });
  }, [connection, wallet]);

  const pumpProgram = useMemo(() => {
    if (!anchorProvider) return null;
    return new Program(pumpIdl as unknown as Idl, new PublicKey((pumpIdl as any).address), anchorProvider);
  }, [anchorProvider]);

  const pumpAmmProgram = useMemo(() => {
    if (!anchorProvider) return null;
    return new Program(pumpAmmIdl as unknown as Idl, new PublicKey((pumpAmmIdl as any).address), anchorProvider);
  }, [anchorProvider]);

  const pumpSdk = useMemo(() => {
    if (!connection) return null;
    return new PumpSdk(connection);
  }, [connection]);

  const pumpAmmSdk = useMemo(() => {
    if (!connection) return null;
    return new PumpAmmSdk(connection);
  }, [connection]);

  // Helper objects must be defined inside the component to access pumpProgram, pumpAmmProgram, etc.
  const pumpHelpers = {
    getPdaGlobalAddress: async (): Promise<PublicKey> => {
      if (!pumpProgram) throw new Error('pumpProgram not initialized');
      const [address] = await PublicKey.findProgramAddress(
        [Buffer.from('global')],
        pumpProgram.programId
      );
      return address;
    },
    getPdaBondingCurveAddress: async (mint: PublicKey): Promise<PublicKey> => {
      if (!pumpProgram) throw new Error('pumpProgram not initialized');
      const [address] = await PublicKey.findProgramAddress(
        [Buffer.from('bonding-curve'), mint.toBuffer()],
        pumpProgram.programId
      );
      return address;
    },
    getMetadata: async (mint: PublicKey): Promise<PublicKey> => {
      const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
      const [address] = await PublicKey.findProgramAddress(
        [
          Buffer.from('metadata'),
          METADATA_PROGRAM_ID.toBuffer(),
          mint.toBuffer(),
        ],
        METADATA_PROGRAM_ID
      );
      return address;
    },
  };

  const pumpAmmHelpers = {
    fetchPools: async (): Promise<any[]> => {
      if (!pumpAmmProgram) throw new Error('pumpAmmProgram not initialized');
      const accounts = await pumpAmmProgram.account.pool.all();
      return accounts || [];
    },
    findCanonicalPoolAddress: async (baseMint: PublicKey): Promise<PublicKey | null> => {
      const pools = await pumpAmmHelpers.fetchPools();
      const pool = pools?.find((p: any) => p.account.baseMint.equals(baseMint));
      return pool?.publicKey || null;
    },
    getPdaGlobalConfigAddress: async (): Promise<PublicKey> => {
      if (!pumpAmmProgram) throw new Error('pumpAmmProgram not initialized');
      const [address] = await PublicKey.findProgramAddress(
        [Buffer.from('global_config')],
        pumpAmmProgram.programId
      );
      return address;
    },
    fetchGlobalConfig: async (): Promise<any> => {
      if (!pumpAmmProgram) throw new Error('pumpAmmProgram not initialized');
      const configAddress = await pumpAmmHelpers.getPdaGlobalConfigAddress();
      return pumpAmmProgram.account.globalConfig.fetch(configAddress);
    },
  };

  // Now define the interface
  interface SolanaContextType {
    anchorProvider: AnchorProvider | null;
    pumpProgram: Program<Idl> | null;
    pumpAmmProgram: Program<Idl> | null;
    pumpSdk: typeof pumpHelpers | null;
    pumpAmmSdk: typeof pumpAmmHelpers | null;
    connection: Connection | null;
  }

  const contextValue: SolanaContextType = {
    anchorProvider,
    pumpProgram,
    pumpAmmProgram,
    pumpSdk: pumpHelpers,
    pumpAmmSdk: pumpAmmHelpers,
    connection,
  };

  return (
    <SolanaContext.Provider value={contextValue}>
      {children}
    </SolanaContext.Provider>
  );
}; 