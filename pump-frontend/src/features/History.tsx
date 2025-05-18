import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSolana } from '../contexts/SolanaProvider';
import { PublicKey } from '@solana/web3.js';

// Define event type interface
interface EventItem {
  eventName: string;
  signature: string;
  blockTime: number;
  timestamp: number;
  programId: string;
  data: any;
}

const History: React.FC = () => {
  const { publicKey } = useWallet();
  const { pumpSdk, pumpAmmSdk, connection } = useSolana();
  const safeConnection = connection!;
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mintFilter, setMintFilter] = useState('');
  const [selectedProgram, setSelectedProgram] = useState<'all' | 'pump' | 'pumpAmm'>('all');
  const [selectedEventType, setSelectedEventType] = useState<string>('all');

  // Define event types from the IDLs
  const pumpEventTypes = [
    'TradeEvent',
    'CreateEvent',
    'CollectCreatorFeeEvent',
    'CompleteEvent',
    'CompletePumpAmmMigrationEvent',
    'SetCreatorEvent',
    'SetParamsEvent',
    'UpdateGlobalAuthorityEvent',
  ];

  const pumpAmmEventTypes = [
    'BuyEvent',
    'SellEvent',
    'DepositEvent',
    'WithdrawEvent',
    'CreatePoolEvent',
    'CollectCoinCreatorFeeEvent',
    'UpdateAdminEvent',
    'UpdateFeeConfigEvent',
    'DisableEvent',
  ];

  // Fetch events when component mounts or filters change
  useEffect(() => {
    if (!pumpSdk || !pumpAmmSdk) return;
    
    const fetchEvents = async () => {
      setLoading(true);
      setError(null);
      try {
        const connection = safeConnection;
        
        // Define program IDs
        const pumpProgramId = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
        const pumpAmmProgramId = new PublicKey('pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA');
        
        // Get program accounts based on filters
        let programIds: PublicKey[] = [];
        if (selectedProgram === 'all' || selectedProgram === 'pump') {
          programIds.push(pumpProgramId);
        }
        if (selectedProgram === 'all' || selectedProgram === 'pumpAmm') {
          programIds.push(pumpAmmProgramId);
        }
        
        // Fetch all relevant signatures
        let allSignatures: { programId: string, signature: any }[] = [];
        
        for (const programId of programIds) {
          const signatures = await connection.getSignaturesForAddress(
            programId,
            { limit: 50 }
          );
          
          // Add programId to each signature
          signatures.forEach((sig: any) => {
            allSignatures.push({
              programId: programId.toString(),
              signature: sig
            });
          });
        }
        
        // Sort by blockTime (most recent first)
        allSignatures.sort((a, b) => {
          return (b.signature.blockTime || 0) - (a.signature.blockTime || 0);
        });
        
        // Get transaction details for each signature
        const fetchedEvents: EventItem[] = [];
        for (let i = 0; i < Math.min(allSignatures.length, 20); i++) {
          const { programId, signature } = allSignatures[i];
          
          try {
            const tx = await connection.getTransaction(signature.signature, {
              maxSupportedTransactionVersion: 0
            });
            
            if (tx && tx.meta && tx.meta.logMessages) {
              // Parse event data from logs
              const eventData = parseEventFromLogs(tx.meta.logMessages, programId);
              
              if (eventData) {
                // Apply mint filter if provided
                if (mintFilter && !JSON.stringify(eventData.data).includes(mintFilter)) {
                  continue;
                }
                
                // Apply event type filter
                if (selectedEventType !== 'all' && eventData.eventName !== selectedEventType) {
                  continue;
                }
                
                // Apply user filter if user is connected
                if (publicKey && !JSON.stringify(eventData.data).includes(publicKey.toString())) {
                  continue;
                }
                
                fetchedEvents.push({
                  eventName: eventData.eventName,
                  signature: signature.signature,
                  blockTime: signature.blockTime || 0,
                  timestamp: signature.blockTime ? signature.blockTime * 1000 : 0, // convert to ms
                  programId: programId,
                  data: eventData.data
                });
              }
            }
          } catch (err) {
            console.error(`Error fetching transaction ${signature.signature}:`, err);
          }
        }
        
        setEvents(fetchedEvents);
      } catch (err: any) {
        setError(`Error fetching events: ${err.message}`);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchEvents();
  }, [safeConnection]);

  // Helper function to parse event data from transaction logs
  const parseEventFromLogs = (logs: string[], programId: string): { eventName: string, data: any } | null => {
    // Simple event parsing logic - in a real implementation, this would be more robust
    try {
      const programEventLogs = logs.filter(log => log.includes('Program data:') && log.includes(programId));
      
      if (programEventLogs.length === 0) return null;
      
      // Find event name
      const eventNameLog = logs.find(log => 
        (log.includes('Program log: Event:') || log.includes('Program log: event:')) && 
        !log.includes('Event emitted')
      );
      
      if (!eventNameLog) return null;
      
      const eventName = eventNameLog.split(':').pop()?.trim() || 'Unknown';
      
      // Extract data
      const dataLog = programEventLogs[0];
      let data = {};
      
      try {
        // This is a simplified approach - real implementations would parse the event data
        // based on the event schema from the IDL
        data = { raw: dataLog };
      } catch (e) {
        console.error('Error parsing event data:', e);
      }
      
      return { eventName, data };
    } catch (err) {
      console.error('Error parsing logs:', err);
      return null;
    }
  };

  // Helper to format timestamps
  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return 'Unknown time';
    return new Date(timestamp).toLocaleString();
  };

  // Helper to format Solana explorer links
  const getSolanaExplorerLink = (signature: string) => {
    return `https://explorer.solana.com/tx/${signature}?cluster=mainnet-beta`;
  };

  return (
    <div>
      <h2>Transaction History</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <div>
          <label>Program: </label>
          <select 
            value={selectedProgram} 
            onChange={(e) => setSelectedProgram(e.target.value as any)}
            disabled={loading}
          >
            <option value="all">All Programs</option>
            <option value="pump">Pump (Bonding Curve)</option>
            <option value="pumpAmm">Pump AMM</option>
          </select>
        </div>
        
        <div>
          <label>Event Type: </label>
          <select 
            value={selectedEventType} 
            onChange={(e) => setSelectedEventType(e.target.value)}
            disabled={loading}
          >
            <option value="all">All Events</option>
            {selectedProgram === 'all' || selectedProgram === 'pump' ? 
              pumpEventTypes.map((eventType, i) => (
                <option key={`pump-${i}`} value={eventType}>{eventType}</option>
              )) : null
            }
            {selectedProgram === 'all' || selectedProgram === 'pumpAmm' ? 
              pumpAmmEventTypes.map((eventType, i) => (
                <option key={`amm-${i}`} value={eventType}>{eventType}</option>
              )) : null
            }
          </select>
        </div>
        
        <div>
          <label>Mint Filter: </label>
          <input
            type="text"
            value={mintFilter}
            onChange={(e) => setMintFilter(e.target.value)}
            placeholder="Enter mint address to filter"
            disabled={loading}
          />
        </div>
        
        <div>
          <label>
            <input
              type="checkbox"
              checked={!!publicKey}
              readOnly
            />
            Only My Transactions (requires wallet connection)
          </label>
        </div>
      </div>
      
      {loading && <div>Loading events...</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}
      
      {!loading && events.length === 0 && (
        <div>No events found matching your filters.</div>
      )}
      
      {!loading && events.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Event</th>
              <th>Program</th>
              <th>Timestamp</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event, index) => (
              <tr key={index} style={{ borderBottom: '1px solid #ccc' }}>
                <td>{event.eventName}</td>
                <td>{event.programId.includes('pAMM') ? 'Pump AMM' : 'Pump'}</td>
                <td>{formatTimestamp(event.timestamp)}</td>
                <td>
                  <a 
                    href={getSolanaExplorerLink(event.signature)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    View on Explorer
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default History; 