import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '@core/services/state.service';
import { ApiService } from '@core/services/api.service';
import { ModalRef } from '@core/services/modal-ref';
import { firstValueFrom } from 'rxjs';
import { ethers } from 'ethers';
import { BoardGovernance, EquityToken, FinanceManager } from '../../../core/constants/contracts';

import { ButtonComponent } from '@shared/components/button/button.component';
import { CustomSelectComponent } from '../../../shared/components/custom-select/custom-select.component';

@Component({
  selector: 'app-create-proposal-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, CustomSelectComponent],
  templateUrl: './create-proposal-modal.component.html'
})
export class CreateProposalModalComponent {
  public modalRef = inject(ModalRef);
  public stateService = inject(StateService);
  private apiService = inject(ApiService);

  public isLoading = signal(false);

  public proposalTypes = [
    { value: 'GRP1', label: 'Cổ phần & Quỹ doanh nghiệp', isHeader: true },
    { value: 'MINT', label: 'Phát hành cổ phần', parentGroup: 'GRP1' },
    { value: 'BURN', label: 'Hủy cổ phần', parentGroup: 'GRP1' },
    { value: 'WITHDRAW', label: 'Rút quỹ BNB', parentGroup: 'GRP1' },
    { value: 'WITHDRAW_ERC20', label: 'Rút quỹ Token ERC20', parentGroup: 'GRP1' },
    { value: 'WITHDRAW_NFT', label: 'Rút NFT (ERC721/1155)', parentGroup: 'GRP1' },
    
    { value: 'GRP2', label: 'Thành viên & Biểu quyết', isHeader: true },
    { value: 'ADD_MEMBER', label: 'Thêm thành viên HĐQT', parentGroup: 'GRP2' },
    { value: 'REMOVE_MEMBER', label: 'Xóa thành viên HĐQT', parentGroup: 'GRP2' },
    { value: 'CHANGE_THRESHOLD', label: 'Thay đổi số chữ ký duyệt đề xuất', parentGroup: 'GRP2' },
    
    { value: 'GRP3', label: 'Trạng thái chuyển nhượng', isHeader: true },
    { value: 'PAUSE_TOKEN', label: 'Khóa giao dịch cổ phần', parentGroup: 'GRP3' },
    { value: 'UNPAUSE_TOKEN', label: 'Mở khóa giao dịch cổ phần', parentGroup: 'GRP3' }
  ];

  public nftTypes = [
    { value: 'ERC721', label: 'ERC-721 (Single NFT)' },
    { value: 'ERC1155', label: 'ERC-1155 (Multi-token NFT)' }
  ];

  public newProposal = {
    title: '',
    description: '',
    type: '',
    target: '',
    value: '0',
    mintParams: {
      to: '',
      amount: 0
    },
    burnParams: {
      from: '',
      amount: 0
    },
    memberParams: {
      address: ''
    },
    thresholdParams: {
      newThreshold: 1
    },
    withdrawErc20Params: {
      tokenAddress: '',
      recipient: '',
      amount: 0,
      decimals: 18
    },
    withdrawNftParams: {
      nftType: 'ERC721',
      nftAddress: '',
      recipient: '',
      tokenId: '',
      amount: 1
    },
    expiration_days: 7
  };

  onCancel() {
    this.modalRef.close();
  }

  async onSubmit() {
    if (!this.newProposal.title) return;
    if (!this.newProposal.type) {
      this.stateService.showToast('Vui lòng chọn loại đề xuất!', 'error');
      return;
    }
    const comp = this.stateService.currentCompany();
    if (!comp || !comp.governance_address || !comp.token_address) {
      this.stateService.showToast('Không tìm thấy cấu hình Smart Contracts của công ty!', 'error');
      return;
    }

    this.isLoading.set(true);
    try {
      const signer = await this.stateService.getSigner();
      const govContract = new ethers.Contract(comp.governance_address, BoardGovernance.abi, signer);

      let target = '';
      let value = '0';
      let calldata = '0x';

      // 1. Phân loại và encode calldata tương ứng
      if (this.newProposal.type === 'WITHDRAW') {
        target = this.newProposal.target;
        value = ethers.parseEther(this.newProposal.value.toString()).toString();
        // Rút BNB đơn giản gửi trực tiếp tới địa chỉ target với value BNB
      } else if (this.newProposal.type === 'WITHDRAW_ERC20') {
        target = this.newProposal.withdrawErc20Params.tokenAddress;
        const tokenInterface = new ethers.Interface([
          "function transfer(address to, uint256 value) external returns (bool)"
        ]);
        const decimals = this.newProposal.withdrawErc20Params.decimals || 18;
        const amountWei = ethers.parseUnits(this.newProposal.withdrawErc20Params.amount.toString(), decimals);
        calldata = tokenInterface.encodeFunctionData('transfer', [
          this.newProposal.withdrawErc20Params.recipient,
          amountWei
        ]);
      } else if (this.newProposal.type === 'WITHDRAW_NFT') {
        target = this.newProposal.withdrawNftParams.nftAddress;
        if (this.newProposal.withdrawNftParams.nftType === 'ERC721') {
          const nftInterface = new ethers.Interface([
            "function transferFrom(address from, address to, uint256 tokenId) external"
          ]);
          calldata = nftInterface.encodeFunctionData('transferFrom', [
            comp.governance_address,
            this.newProposal.withdrawNftParams.recipient,
            this.newProposal.withdrawNftParams.tokenId
          ]);
        } else {
          const nftInterface = new ethers.Interface([
            "function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes calldata data) external"
          ]);
          calldata = nftInterface.encodeFunctionData('safeTransferFrom', [
            comp.governance_address,
            this.newProposal.withdrawNftParams.recipient,
            this.newProposal.withdrawNftParams.tokenId,
            this.newProposal.withdrawNftParams.amount,
            '0x'
          ]);
        }
      } else if (this.newProposal.type === 'MINT') {
        target = comp.token_address;
        const tokenInterface = new ethers.Interface(EquityToken.abi);
        const amountWei = ethers.parseUnits(this.newProposal.mintParams.amount.toString(), 18);
        calldata = tokenInterface.encodeFunctionData('mint', [
          this.newProposal.mintParams.to,
          amountWei
        ]);
      } else if (this.newProposal.type === 'BURN') {
        target = comp.token_address;
        const tokenInterface = new ethers.Interface(EquityToken.abi);
        const amountWei = ethers.parseUnits(this.newProposal.burnParams.amount.toString(), 18);
        calldata = tokenInterface.encodeFunctionData('burnFrom', [
          this.newProposal.burnParams.from,
          amountWei
        ]);
      } else if (this.newProposal.type === 'PAUSE_TOKEN') {
        target = comp.token_address;
        const tokenInterface = new ethers.Interface(EquityToken.abi);
        calldata = tokenInterface.encodeFunctionData('pause', []);
      } else if (this.newProposal.type === 'UNPAUSE_TOKEN') {
        target = comp.token_address;
        const tokenInterface = new ethers.Interface(EquityToken.abi);
        calldata = tokenInterface.encodeFunctionData('unpause', []);
      } else if (this.newProposal.type === 'ADD_MEMBER') {
        target = comp.governance_address;
        const govInterface = new ethers.Interface(BoardGovernance.abi);
        calldata = govInterface.encodeFunctionData('addMember', [
          this.newProposal.memberParams.address
        ]);
      } else if (this.newProposal.type === 'REMOVE_MEMBER') {
        target = comp.governance_address;
        const govInterface = new ethers.Interface(BoardGovernance.abi);
        calldata = govInterface.encodeFunctionData('removeMember', [
          this.newProposal.memberParams.address
        ]);
      } else if (this.newProposal.type === 'CHANGE_THRESHOLD') {
        target = comp.governance_address;
        const govInterface = new ethers.Interface(BoardGovernance.abi);
        calldata = govInterface.encodeFunctionData('changeThreshold', [
          this.newProposal.thresholdParams.newThreshold
        ]);
      }

      this.stateService.showToast('Đang gửi đề xuất HĐQT lên blockchain...', 'warning');
      const gasOverrides = await this.stateService.getGasOverrides(signer);
      
      const delaySeconds = 0;
      const durationSeconds = this.newProposal.expiration_days * 86400;

      // 2. Gọi contract createProposal
      const tx = await govContract['createProposal'](
        target,
        value,
        calldata,
        this.newProposal.title,
        delaySeconds,
        durationSeconds,
        gasOverrides
      );

      this.stateService.showToast('Giao dịch đang chờ xác nhận từ blockchain...', 'warning');
      const receipt = await tx.wait();

      // Đọc proposalCount mới nhất làm onchain_id
      // Contract: proposalCount++ rồi mới gán ID → proposalCount sau khi tạo = ID của proposal mới
      const proposalCount = await govContract['proposalCount']();
      const onchainId = Number(proposalCount);

      // 3. Đồng bộ hóa với Backend DB
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + this.newProposal.expiration_days);

      const formatDate = (date: Date) => {
        const pad = (num: number) => String(num).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
      };

      const extraParams = (this.newProposal.type === 'ADD_MEMBER' || this.newProposal.type === 'REMOVE_MEMBER')
        ? { member_address: this.newProposal.memberParams.address }
        : {};

      const createResponse = await firstValueFrom(this.apiService.post<any>('proposals', {
        title: this.newProposal.title,
        description: this.newProposal.description,
        type: this.newProposal.type,
        params: {
          target,
          value,
          calldata,
          onchain_id: onchainId,
          ...extraParams  // lưu funding round params để dùng khi execute
        },
        expiration_date: formatDate(expirationDate)
      }, comp.id));

      // 4. Contract tự động signProposal() khi createProposal() → đồng bộ chữ ký người tạo vào backend
      // Để backend tính threshold đúng và UI hiển thị chữ ký đúng
      try {
        const signMessage = `Approve Proposal #${createResponse.proposal_id} for ${comp.name}\nType: ${this.newProposal.type}\nVal: ${value}`;
        const autoSig = await signer.signMessage(signMessage);

        let onchainThreshold = 1;
        try {
          const onchainThresholdVal = await govContract['threshold']();
          onchainThreshold = Number(onchainThresholdVal);
        } catch (e) {
          // ignore
        }

        await firstValueFrom(this.apiService.post<any>(`proposals/${createResponse.proposal_id}/sign`, {
          signature: autoSig,
          message: signMessage,
          threshold: onchainThreshold
        }, comp.id));
      } catch (sigErr) {
        // Không chặn flow chính nếu lưu chữ ký thất bại
        console.warn('Không thể đồng bộ chữ ký tạo đề xuất:', sigErr);
      }

      this.stateService.showToast('Tạo đề xuất thành công và đã đồng bộ lên hệ thống!', 'success');
      this.modalRef.close(true);
    } catch (e: any) {
      console.error(e);
      this.stateService.showToast(e.message || e.error?.message || 'Có lỗi xảy ra khi tạo đề xuất!', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }
}
