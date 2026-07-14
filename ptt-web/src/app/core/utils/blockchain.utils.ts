export const POPULAR_CHAINS = [
  { name: 'BNB Smart Chain', chainId: '56', rpcUrl: 'https://bsc-dataseed.binance.org', explorerUrl: 'https://bscscan.com', color: '#F3BA2F', nativeSymbol: 'BNB' },
  { name: 'BSC Testnet', chainId: '97', rpcUrl: 'https://bsc-testnet-rpc.publicnode.com', explorerUrl: 'https://testnet.bscscan.com', color: '#e6a817', nativeSymbol: 'tBNB' },
];

/**
 * Lấy API URL của Block Explorer tương ứng với chainId.
 */
export function getExplorerApiUrl(chainId: string | number): string | null {
  const id = chainId.toString().trim();
  switch (id) {
    case '56':
    case '97':
      return 'https://api.etherscan.io/v2/api';
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
    default: return [];
  }
}
