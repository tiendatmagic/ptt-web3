import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { firstValueFrom } from 'rxjs';
import { Contract, ethers } from 'ethers';
import { Router, ActivatedRoute } from '@angular/router';

import { ModalService } from '@core/services/modal.service';
import { CreateProposalModalComponent } from './modals/create-proposal-modal.component';
import { ShareProposalModalComponent } from './modals/share-proposal-modal.component';
import { POPULAR_CHAINS } from '@core/utils/blockchain.utils';

import { EquityToken } from '@core/constants/contracts/equity-token';
import { BoardGovernance } from '@core/constants/contracts/board-governance';
import { FinanceManager } from '@core/constants/contracts/finance-manager';

// ABI rút gọn của BoardGovernance để thực thi executeProposal, signProposal & đọc threshold
const BOARD_GOVERNANCE_ABI = [
  "function executeProposal(uint256 proposalId) external returns (bytes memory)",
  "function signProposal(uint256 proposalId) external",
  "function threshold() external view returns (uint256)",
  "function getProposalThreshold(uint256 proposalId) external view returns (uint256)",
  "function getMembers() external view returns (address[])",
  "function proposals(uint256 proposalId) external view returns (uint256 id, address target, uint256 value, bytes memory data, string memory description, uint256 voteCount, uint256 effectiveDate, uint256 expirationDate, bool executed, bool cancelled, uint256 thresholdSnapshot)"
];

@Component({
  selector: 'app-governance',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ButtonComponent, PaginationComponent],
  templateUrl: './governance.component.html'
})
export class GovernanceComponent implements OnInit {
  public stateService = inject(StateService);
  private apiService = inject(ApiService);
  private modalService = inject(ModalService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  public proposalsList = signal<any[]>([]);
  public searchQuery = signal<string>('');
  public selectedProposal = signal<any | null>(null);
  public proposalSignatures = signal<any[]>([]);
  public proposalThreshold = signal<number>(1);
  public proposalTotalMembers = signal<number>(0);
  public decodedParams = signal<any | null>(null);
  public isPageLoading = signal(true);

  // Phân trang Client-side cho danh sách Đề xuất
  public currentPage = signal(1);
  public itemsPerPage = 5; // Hiển thị 5 đề xuất mỗi trang cho gọn

  public filteredProposals = computed(() => {
    const list = this.proposalsList();
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return list;
    return list.filter(p => 
      p.title?.toLowerCase().includes(query) || 
      String(p.id).includes(query)
    );
  });

  public paginatedProposals = computed(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredProposals().slice(start, end);
  });

  public totalPages = computed(() => {
    return Math.ceil(this.filteredProposals().length / this.itemsPerPage) || 1;
  });

  public onSearchQueryChange(query: string) {
    this.searchQuery.set(query);
    this.currentPage.set(1);
  }

  // Kiểm tra xem ví hiện tại đã ký đề xuất đang chọn chưa
  public hasCurrentWalletSigned = computed(() => {
    const address = this.stateService.address()?.toLowerCase();
    if (!address) return false;
    return this.proposalSignatures().some(
      (sig: any) => sig.wallet_address?.toLowerCase() === address
    );
  });

  public getProposalTypeLabel(type: string): string {
    const map: Record<string, string> = {
      'MINT': 'Phát hành cổ phần',
      'BURN': 'Hủy cổ phần',
      'WITHDRAW': 'Rút quỹ BNB',
      'WITHDRAW_ERC20': 'Rút quỹ Token ERC20',
      'WITHDRAW_NFT': 'Rút NFT (ERC721/1155)',
      'ADD_MEMBER': 'Thêm thành viên HĐQT',
      'REMOVE_MEMBER': 'Xóa thành viên HĐQT',
      'CHANGE_THRESHOLD': 'Đổi số chữ ký duyệt đề xuất',
      'PAUSE_TOKEN': 'Khóa giao dịch cổ phần',
      'UNPAUSE_TOKEN': 'Mở khóa giao dịch cổ phần',
    };
    return map[type] || type;
  }

  ngOnInit() {
    this.initComponent();
  }

  private async initComponent() {
    await this.loadProposals();

    // Lắng nghe sự thay đổi của query parameters để tự động chọn đề xuất
    this.route.queryParams.subscribe(params => {
      const proposalId = params['proposalId'] ? Number(params['proposalId']) : null;
      if (proposalId) {
        // Tìm đề xuất trong danh sách đã tải
        const proposal = this.proposalsList().find(p => Number(p.id) === proposalId);
        if (proposal) {
          // Tự động chuyển trang về trang chứa đề xuất đó
          const index = this.proposalsList().findIndex(p => Number(p.id) === proposalId);
          if (index !== -1) {
            const page = Math.floor(index / this.itemsPerPage) + 1;
            this.currentPage.set(page);
          }
          this.fetchProposalDetail(proposal);
        }
      } else {
        this.selectedProposal.set(null);
        this.proposalSignatures.set([]);
      }
    });
  }

  public async loadProposals() {
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    this.isPageLoading.set(true);
    try {
      const list = await firstValueFrom(this.apiService.get<any[]>('proposals', comp.id));
      this.proposalsList.set(list || []);
      this.currentPage.set(1); // Reset về trang 1
    } catch (e) {
      console.error('Lỗi khi tải danh sách đề xuất:', e);
    } finally {
      this.isPageLoading.set(false);
    }
  }

  public onPageChange(page: number) {
    this.currentPage.set(page);
  }

  // Cập nhật URL query parameter khi người dùng click chọn đề xuất
  public selectProposal(proposal: any) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { proposalId: proposal.id },
      queryParamsHandling: 'merge'
    });
  }

  public openShareModal() {
    const proposal = this.selectedProposal();
    if (!proposal) return;

    this.modalService.open(ShareProposalModalComponent, {
      title: 'Chia sẻ đề xuất',
      size: 'md',
      data: { proposalId: proposal.id }
    });
  }

  public getTxExplorerUrl(txHash: string): string {
    if (!txHash) return '';
    let chainId = this.stateService.chainId();
    if (!chainId) {
      chainId = 97; // Mặc định BSC Testnet khi chưa kết nối ví
    }
    const popular = POPULAR_CHAINS.find(c => Number(c.chainId) === Number(chainId));
    const baseExplorer = popular ? popular.explorerUrl : 'https://testnet.bscscan.com';
    return `${baseExplorer}/tx/${txHash}`;
  }

  public getChainName(): string {
    let chainId = this.stateService.chainId();
    if (!chainId) {
      chainId = 97; // Mặc định BSC Testnet khi chưa kết nối ví
    }
    const popular = POPULAR_CHAINS.find(c => Number(c.chainId) === Number(chainId));
    return popular ? popular.name : 'BSC Testnet';
  }

  public formatValue(valueWei: any): string {
    if (!valueWei) return '0';
    try {
      return ethers.formatEther(valueWei.toString());
    } catch (e) {
      return '0';
    }
  }

  public formatTokenAmount(amount: any): string {
    if (!amount) return '0';
    try {
      const formatted = ethers.formatEther(amount.toString());
      return Number(formatted).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
    } catch (e) {
      return amount.toString();
    }
  }

  private decodeOnChainCalldata(target: string, calldata: string) {
    if (!calldata || calldata === '0x') {
      this.decodedParams.set(null);
      return;
    }

    const comp = this.stateService.currentCompany();
    if (!comp) return;

    try {
      let abi: any[] = [];
      const lowerTarget = target.toLowerCase();

      if (lowerTarget === comp.token_address?.toLowerCase()) {
        abi = EquityToken.abi;
      } else if (lowerTarget === comp.governance_address?.toLowerCase()) {
        abi = BoardGovernance.abi;
      } else if (lowerTarget === comp.funding_address?.toLowerCase()) {
        abi = FinanceManager.abi;
      }

      if (abi.length > 0) {
        const iface = new ethers.Interface(abi);
        const parsed = iface.parseTransaction({ data: calldata });
        if (parsed) {
          this.decodedParams.set({
            name: parsed.name,
            args: parsed.args,
            signature: parsed.signature
          });
          return;
        }
      }
    } catch (err) {
      console.warn('[Governance] Lỗi giải mã calldata on-chain, chuyển sang offline:', err);
    }
    
    this.decodedParams.set(null);
  }

  private decodeOfflineParams(proposal: any) {
    if (proposal && proposal.params) {
      const params = proposal.params;
      const type = proposal.type;
      
      if (type === 'MINT') {
        this.decodedParams.set({
          name: 'mint',
          args: [params.to || params.address, params.amount || params.value],
          signature: 'mint(address,uint256)'
        });
      } else if (type === 'BURN') {
        this.decodedParams.set({
          name: 'burn',
          args: [params.from || params.address, params.amount || params.value],
          signature: 'burn(address,uint256)'
        });
      } else if (type === 'ADD_MEMBER') {
        this.decodedParams.set({
          name: 'addMember',
          args: [params.member || params.address],
          signature: 'addMember(address)'
        });
      } else if (type === 'REMOVE_MEMBER') {
        this.decodedParams.set({
          name: 'removeMember',
          args: [params.member || params.address],
          signature: 'removeMember(address)'
        });
      } else if (type === 'CHANGE_THRESHOLD') {
        this.decodedParams.set({
          name: 'changeThreshold',
          args: [params.newThreshold || params.value],
          signature: 'changeThreshold(uint256)'
        });
      } else {
        this.decodedParams.set(null);
      }
    } else {
      this.decodedParams.set(null);
    }
  }

  // Tải chi tiết đề xuất
  private async fetchProposalDetail(proposal: any) {
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    try {
      const detail = await firstValueFrom(this.apiService.get<any>(`proposals/${proposal.id}`, comp.id));
      this.selectedProposal.set(detail.proposal);
      this.proposalSignatures.set(detail.signatures || []);

      // Đọc threshold trực tiếp từ Blockchain (Smart Contract BoardGovernance)
      if (comp.governance_address) {
        try {
          const provider = this.stateService.web3Service.getProvider();
          const govContract = new Contract(comp.governance_address, BOARD_GOVERNANCE_ABI, provider);
          
          const onchainId = proposal.params?.onchain_id;
          let onchainThreshold;
          let proposalDataOnChain: any = null;

          if (onchainId) {
            onchainThreshold = await govContract['getProposalThreshold'](onchainId);
            proposalDataOnChain = await govContract['proposals'](onchainId);
          } else {
            onchainThreshold = await govContract['threshold']();
          }
          this.proposalThreshold.set(Number(onchainThreshold));

          // Đọc số lượng thành viên HĐQT
          const members = await govContract['getMembers']();
          this.proposalTotalMembers.set(members.length);

          // Giải mã calldata on-chain
          if (proposalDataOnChain && proposalDataOnChain.data) {
            this.decodeOnChainCalldata(proposalDataOnChain.target, proposalDataOnChain.data);
          } else {
            this.decodeOfflineParams(detail.proposal);
          }
        } catch (contractErr) {
          console.warn('[Governance] Lỗi đọc blockchain, dùng fallback từ backend:', contractErr);
          this.proposalThreshold.set(detail.threshold || 1);
          this.proposalTotalMembers.set(detail.total_members || 1);
          this.decodeOfflineParams(detail.proposal);
        }
      } else {
        this.proposalThreshold.set(detail.threshold || 1);
        this.proposalTotalMembers.set(detail.total_members || 1);
        this.decodeOfflineParams(detail.proposal);
      }
    } catch (e) {
      console.error('Lỗi tải chi tiết đề xuất:', e);
    }
  }

  // Tạo Proposal mới qua ModalService
  public openCreateProposal() {
    const ref = this.modalService.open(CreateProposalModalComponent, {
      title: 'Tạo đề xuất mới',
      size: '2xl'
    });
    ref.afterClosed$.subscribe(success => {
      if (success) {
        this.loadProposals();
      }
    });
  }

  // Ký Biểu quyết (On-chain + Off-chain đồng bộ)
  public async handleSignProposal(proposal: any) {
    const comp = this.stateService.currentCompany();
    if (!comp || !comp.governance_address) return;

    const onchainId = proposal.params?.onchain_id;
    if (!onchainId) {
      this.stateService.showToast('Dữ liệu on-chain chưa sẵn sàng. Vui lòng thử lại sau!', 'error');
      return;
    }

    try {
      this.stateService.isLoading.set(true);

      const walletAddress = this.stateService.address();
      const message = `Approve Proposal #${proposal.id} for ${comp.name}\nType: ${proposal.type}\nVal: ${proposal.params?.value || 0}`;
      const signer = await this.stateService.getSigner();

      // 1. Ký thông điệp off-chain để lưu trử trên Backend
      const signature = await signer.signMessage(message);

      // 2. Thực hiện giao dịch ký duyệt on-chain
      // Nếu đã ký on-chain rồi (trường hợp người tạo proposal) thì bỏ qua bước này
      let alreadySignedOnChain = false;
      try {
        this.stateService.showToast('Vui lòng xác nhận giao dịch ký duyệt trên ví MetaMask...', 'warning');
        const govContract = new Contract(comp.governance_address, BOARD_GOVERNANCE_ABI, signer);
        const gasOverrides = await this.stateService.getGasOverrides(signer);
        const tx = await govContract['signProposal'](onchainId, gasOverrides);
        this.stateService.showToast('Giao dịch ký duyệt đã gửi. Chờ xác nhận từ mạng lưới...', 'warning');
        await tx.wait();
      } catch (onChainErr: any) {
        const errMsg = onChainErr?.reason || onChainErr?.message || '';
        if (errMsg.toLowerCase().includes('already signed') || errMsg.toLowerCase().includes('already voted')) {
          // Đã ký on-chain rồi (ví dụ: người tạo), chỉ cần đồng bộ vào backend
          alreadySignedOnChain = true;
          this.stateService.showToast('Ví đã ký on-chain, đang đồng bộ chữ ký vào hệ thống...', 'warning');
        } else {
          throw onChainErr; // Lỗi khác thì thả ra
        }
      }

      // Đọc threshold từ contract để đồng bộ lên Backend
      let currentThreshold = 1;
      try {
        const govContract = new Contract(comp.governance_address, BOARD_GOVERNANCE_ABI, signer);
        const onchainThreshold = await govContract['threshold']();
        currentThreshold = Number(onchainThreshold);
      } catch (e) {
        currentThreshold = this.proposalThreshold();
      }

      // 3. Gửi chữ ký off-chain lên Backend kèm theo threshold
      const response = await firstValueFrom(
        this.apiService.post<any>(`proposals/${proposal.id}/sign`, {
          signature: signature,
          message: message,
          threshold: currentThreshold
        }, comp.id)
      );

      const newStatus = response.status;
      const msg = alreadySignedOnChain
        ? `Đã đồng bộ chữ ký! Trạng thái: ${newStatus}`
        : `Biểu quyết thành công! Trạng thái: ${newStatus}`;
      this.stateService.showToast(msg, 'success');

      // Load lại để phản ánh status mới nhất (PENDING → APPROVED nếu đủ threshold)
      await this.loadProposals();
      const updatedProposal = this.proposalsList().find(p => Number(p.id) === Number(proposal.id));
      if (updatedProposal) {
        await this.fetchProposalDetail(updatedProposal);
      } else {
        await this.selectProposal(proposal);
      }
    } catch (e: any) {
      console.error(e);
      const msg = e?.reason || e?.message || e?.error?.message || 'Từ chối ký hoặc lỗi xác thực!';
      this.stateService.showToast(msg, 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }

  // Thực thi Proposal on-chain (Execute Proposal)
  public async handleExecuteProposal(proposal: any) {
    const comp = this.stateService.currentCompany();
    if (!comp || !comp.governance_address) return;

    const onchainId = proposal.params?.onchain_id;
    if (!onchainId) {
      this.stateService.showToast('Đề xuất này thiếu ID on-chain, không thể thực thi!', 'error');
      return;
    }

    try {
      this.stateService.isLoading.set(true);

      // 1. Lấy signer và khởi tạo contract BoardGovernance
      const signer = await this.stateService.getSigner();
      const govContract = new Contract(comp.governance_address, BOARD_GOVERNANCE_ABI, signer);

      // 2. Thực thi on-chain
      // Nếu đã execute rồi thì bỏ qua và chỉ đồng bộ backend
      let txHash: string | null = null;
      let alreadyExecutedOnChain = false;
      try {
        this.stateService.showToast('Đang gửi giao dịch execute on-chain...', 'warning');
        const gasOverrides = await this.stateService.getGasOverrides(signer);
        const tx = await govContract['executeProposal'](onchainId, gasOverrides);
        this.stateService.showToast('Giao dịch thực thi đang chờ xác nhận...', 'warning');
        await tx.wait();
        txHash = tx.hash;
      } catch (onChainErr: any) {
        const errMsg = onChainErr?.reason || onChainErr?.message || '';
        if (errMsg.toLowerCase().includes('already executed') || errMsg.toLowerCase().includes('proposal already')) {
          alreadyExecutedOnChain = true;
          this.stateService.showToast('Đề xuất đã thực thi on-chain, đang đồng bộ trạng thái...', 'warning');
        } else {
          throw onChainErr;
        }
      }

      // 3. Cập nhật backend (tx_hash có thể null nếu đã execute rồi)
      const body: any = {};
      if (txHash) body['tx_hash'] = txHash;

      await firstValueFrom(
        this.apiService.post<any>(`proposals/${proposal.id}/execute`, body, comp.id)
      );

      // 4. Nếu proposal là FUNDING_ROUND → tự động tạo record funding round DB status ACTIVE
      // để trang Gọi vốn hiển thị đúng
      if (proposal.type === 'FUNDING_ROUND') {
        try {
          const p = proposal.params || {};
          // share_price là giá BNB/share từ lúc tạo proposal, dùng trực tiếp
          // target_amount = max_supply * share_price (ước tính)
          const sharePrice = p.share_price || '0.001';
          const maxSupply = p.max_supply || 1000;
          const durationDays = p.duration_days || 30;
          const targetAmount = Number(sharePrice) * Number(maxSupply);

          const startDate = new Date();
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + durationDays);
          const fmt = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

          const paymentTokenAddress = p.payment_token_address || ethers.ZeroAddress;
          const paymentTokenSymbol = p.payment_token_symbol || 'BNB';
          const paymentTokenDecimals = p.payment_token_decimals || 18;

          await firstValueFrom(
            this.apiService.post<any>('funding', {
              name: p.name || proposal.title,
              share_price: Number(sharePrice),
              target_amount: targetAmount,
              start_date: fmt(startDate),
              end_date: fmt(endDate),
              onchain_round_id: onchainId,
              payment_token_address: paymentTokenAddress,
              payment_token_symbol: paymentTokenSymbol,
              payment_token_decimals: paymentTokenDecimals,
              status: 'ACTIVE'   // Tạo trực tiếp ACTIVE vì đã execute on-chain
            }, comp.id)
          );
        } catch (fundErr) {
          console.warn('Không thể tự động tạo funding round:', fundErr);
        }
      }

      const msg = alreadyExecutedOnChain
        ? 'Đồng bộ trạng thái thành công! Đề xuất đã EXECUTED.'
        : 'Đề xuất đã được thực thi thành công on-chain!';
      this.stateService.showToast(msg, 'success');

      // Load lại dữ liệu
      await this.loadProposals();
      const updatedProposal = this.proposalsList().find(p => Number(p.id) === Number(proposal.id));
      if (updatedProposal) {
        await this.fetchProposalDetail(updatedProposal);
      } else {
        await this.selectProposal(proposal);
      }
    } catch (e: any) {
      console.error(e);
      const msg = e?.reason || e?.message || e?.error?.message || 'Lỗi thực thi đề xuất!';
      this.stateService.showToast(msg, 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }
}
