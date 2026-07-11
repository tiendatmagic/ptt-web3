export const POPULAR_CHAINS = [
  { name: 'Arbitrum One Mainnet', chainId: '42161', rpcUrl: 'https://arb1.arbitrum.io/rpc', explorerUrl: 'https://arbiscan.io', color: '#00a3ff' },
  { name: 'BNB Smart Chain', chainId: '56', rpcUrl: 'https://bsc-dataseed.binance.org', explorerUrl: 'https://bscscan.com', color: '#F3BA2F' },
  { name: 'Ethereum Mainnet', chainId: '1', rpcUrl: 'https://cloudflare-eth.com', explorerUrl: 'https://etherscan.io', color: '#627EEA' },
  { name: 'Arbitrum Sepolia', chainId: '421614', rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc', explorerUrl: 'https://sepolia.arbiscan.io', color: '#5ba4cf' },
  { name: 'BSC Testnet', chainId: '97', rpcUrl: 'https://bsc-testnet-rpc.publicnode.com', explorerUrl: 'https://testnet.bscscan.com', color: '#e6a817' },
];

/**
 * Lấy API URL của Block Explorer tương ứng với chainId.
 */
export function getExplorerApiUrl(chainId: string | number): string | null {
  const id = chainId.toString().trim();
  switch (id) {
    case '1': return 'https://api.etherscan.io/api';
    case '56': return 'https://api.bscscan.com/api';
    case '97': return 'https://api-testnet.bscscan.com/api';
    case '42161': return 'https://api.arbiscan.io/api';
    case '421614': return 'https://api-sepolia.arbiscan.io/api';
    default: return null;
  }
}

/**
 * Lấy danh sách backup RPC URL đáng tin cậy.
 */
export function getBackupRpcUrls(chainId: string | number): string[] {
  const id = chainId.toString().trim();
  switch (id) {
    case '97': return ['https://bsc-testnet.drpc.org', 'https://bsc-testnet-rpc.publicnode.com', 'https://bnb-testnet.api.onfinality.io/public'];
    case '56': return ['https://bsc.drpc.org', 'https://bsc-rpc.publicnode.com', 'https://binance.llamarpc.com', 'https://rpc.ankr.com/bsc'];
    case '1': return ['https://ethereum-rpc.publicnode.com', 'https://eth.llamarpc.com', 'https://rpc.ankr.com/eth'];
    case '42161': return ['https://arbitrum-one-rpc.publicnode.com', 'https://arbitrum.llamarpc.com', 'https://rpc.ankr.com/arbitrum'];
    case '421614': return ['https://arbitrum-sepolia-rpc.publicnode.com', 'https://rpc.ankr.com/arbitrum_sepolia'];
    default: return [];
  }
}
