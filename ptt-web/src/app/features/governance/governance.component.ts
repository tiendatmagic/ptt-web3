import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { firstValueFrom } from 'rxjs';
import { Contract } from 'ethers';

import { ModalService } from '@core/services/modal.service';
import { CreateProposalModalComponent } from './modals/create-proposal-modal.component';

// ABI rút gọn của BoardGovernance để thực thi executeProposal & signProposal
const BOARD_GOVERNANCE_ABI = [
  "function executeProposal(uint256 proposalId) external returns (bytes memory)",
  "function signProposal(uint256 proposalId) external"
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

  public proposalsList = signal<any[]>([]);
  public selectedProposal = signal<any | null>(null);
  public proposalSignatures = signal<any[]>([]);

  // Phân trang Client-side cho danh sách Đề xuất
  public currentPage = signal(1);
  public itemsPerPage = 5; // Hiển thị 5 đề xuất mỗi trang cho gọn

  public paginatedProposals = computed(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.proposalsList().slice(start, end);
  });

  public totalPages = computed(() => {
    return Math.ceil(this.proposalsList().length / this.itemsPerPage) || 1;
  });

  // Kiểm tra xem ví hiện tại đã ký đề xuất đang chọn chưa
  public hasCurrentWalletSigned = computed(() => {
    const address = this.stateService.address()?.toLowerCase();
    if (!address) return false;
    return this.proposalSignatures().some(
      (sig: any) => sig.wallet_address?.toLowerCase() === address
    );
  });

  ngOnInit() {
    this.loadProposals();
  }

  public async loadProposals() {
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    try {
      const list = await firstValueFrom(this.apiService.get<any[]>('proposals', comp.id));
      this.proposalsList.set(list || []);
      this.currentPage.set(1); // Reset về trang 1
    } catch (e) {
      console.error('Lỗi khi tải danh sách đề xuất:', e);
    }
  }

  public onPageChange(page: number) {
    this.currentPage.set(page);
  }

  public async selectProposal(proposal: any) {
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    try {
      const detail = await firstValueFrom(this.apiService.get<any>(`proposals/${proposal.id}`, comp.id));
      this.selectedProposal.set(detail.proposal);
      this.proposalSignatures.set(detail.signatures || []);
    } catch (e) {
      console.error('Lỗi tải chi tiết đề xuất:', e);
    }
  }

  // Tạo Proposal mới qua ModalService
  public openCreateProposal() {
    const ref = this.modalService.open(CreateProposalModalComponent, {
      title: 'Tạo đề xuất mới',
      size: 'lg'
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

      // 3. Gửi chữ ký off-chain lên Backend
      const response = await firstValueFrom(
        this.apiService.post<any>(`proposals/${proposal.id}/sign`, {
          signature: signature,
          message: message
        }, comp.id)
      );

      const newStatus = response.status;
      const msg = alreadySignedOnChain
        ? `Đã đồng bộ chữ ký! Trạng thái: ${newStatus}`
        : `Biểu quyết thành công! Trạng thái: ${newStatus}`;
      this.stateService.showToast(msg, 'success');

      // Load lại để phản ánh status mới nhất (PENDING → APPROVED nếu đủ threshold)
      await this.loadProposals();
      await this.selectProposal(proposal);
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

      const msg = alreadyExecutedOnChain
        ? 'Đồng bộ trạng thái thành công! Đề xuất đã EXECUTED.'
        : 'Đề xuất đã được thực thi thành công on-chain!';
      this.stateService.showToast(msg, 'success');

      // Load lại dữ liệu
      await this.loadProposals();
      await this.selectProposal(proposal);
    } catch (e: any) {
      console.error(e);
      const msg = e?.reason || e?.message || e?.error?.message || 'Lỗi thực thi đề xuất!';
      this.stateService.showToast(msg, 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }
}
