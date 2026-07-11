import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { firstValueFrom } from 'rxjs';
import { Contract } from 'ethers';

import { ModalService } from '@core/services/modal.service';
import { CreateProposalModalComponent } from './modals/create-proposal-modal.component';

// ABI rút gọn của BoardGovernance để thực thi executeProposal
const BOARD_GOVERNANCE_ABI = [
  "function executeProposal(uint256 proposalId, bytes[] memory signatures) external payable",
  "function getProposalHash(uint256 proposalId) public view returns (bytes32)"
];

@Component({
  selector: 'app-governance',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ButtonComponent],
  templateUrl: './governance.component.html'
})
export class GovernanceComponent implements OnInit {
  public stateService = inject(StateService);
  private apiService = inject(ApiService);
  private modalService = inject(ModalService);

  public proposalsList = signal<any[]>([]);
  public selectedProposal = signal<any | null>(null);
  public proposalSignatures = signal<any[]>([]);

  ngOnInit() {
    this.loadProposals();
  }

  public async loadProposals() {
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    try {
      const list = await firstValueFrom(this.apiService.get<any[]>('proposals', comp.id));
      this.proposalsList.set(list || []);
    } catch (e) {
      console.error('Lỗi khi tải danh sách đề xuất:', e);
    }
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

  // Ký Biểu quyết (EIP-712/personal_sign)
  public async handleSignProposal(proposal: any) {
    const comp = this.stateService.currentCompany();
    if (!comp) return;

    try {
      this.stateService.isLoading.set(true);

      // 1. Tạo thông điệp EIP-712 / personal_sign
      // Phục vụ ký off-chain: cấu trúc chuẩn hóa cho Board Governance
      const walletAddress = this.stateService.address();
      const message = `Approve Proposal #${proposal.id} for ${comp.name}\nType: ${proposal.type}\nVal: ${proposal.params?.value || 0}`;

      // 2. Ký qua ví
      const signer = await this.stateService.getSigner();
      const signature = await signer.signMessage(message);

      // 3. Gửi lên Backend
      const response = await firstValueFrom(
        this.apiService.post<any>(`proposals/${proposal.id}/sign`, {
          signature: signature,
          message: message
        }, comp.id)
      );

      this.stateService.showToast(`Biểu quyết thành công! Trạng thái hiện tại: ${response.status}`, 'success');
      
      // Load lại chi tiết
      await this.selectProposal(proposal);
      await this.loadProposals();
    } catch (e: any) {
      console.error(e);
      this.stateService.showToast(e.error?.message || 'Từ chối ký hoặc lỗi xác thực chữ ký!', 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }

  // Thực thi Proposal on-chain (Execute Proposal)
  public async handleExecuteProposal(proposal: any) {
    const comp = this.stateService.currentCompany();
    if (!comp || !comp.governance_address) return;

    try {
      this.stateService.isLoading.set(true);
      
      // 1. Lấy signer và khởi tạo contract BoardGovernance
      const signer = await this.stateService.getSigner();
      const govContract = new Contract(comp.governance_address, BOARD_GOVERNANCE_ABI, signer);

      // Lấy danh sách chữ ký hợp lệ từ Backend
      const detail = await firstValueFrom(this.apiService.get<any>(`proposals/${proposal.id}`, comp.id));
      const sigs = (detail.signatures || []).map((s: any) => s.signature);

      if (sigs.length === 0) {
        this.stateService.showToast('Không có đủ chữ ký để thực thi on-chain!', 'warning');
        return;
      }

      this.stateService.showToast('Đang gửi giao dịch execute on-chain...', 'warning');

      // 2. Gọi hàm executeProposal trên smart contract
      // Tùy thuộc vào value đề xuất chuyển native coin (BNB)
      const valueToSend = proposal.params?.value ? BigInt(proposal.params.value) : 0n;
      const gasOverrides = await this.stateService.getGasOverrides(signer);

      const tx = await govContract['executeProposal'](proposal.id, sigs, {
        value: valueToSend,
        ...gasOverrides
      });

      this.stateService.showToast('Giao dịch thực thi đã gửi. Chờ xác nhận...', 'warning');
      const receipt = await tx.wait();

      // 3. Gửi transaction hash lên Backend để cập nhật EXECUTED
      await firstValueFrom(
        this.apiService.post<any>(`proposals/${proposal.id}/execute`, {
          tx_hash: receipt.hash
        }, comp.id)
      );

      this.stateService.showToast('Thực thi đề xuất và cập nhật trạng thái thành công!', 'success');
      
      await this.selectProposal(proposal);
      await this.loadProposals();
    } catch (e: any) {
      console.error(e);
      this.stateService.showToast(e.message || 'Lỗi thực thi giao dịch blockchain!', 'error');
    } finally {
      this.stateService.isLoading.set(false);
    }
  }
}
