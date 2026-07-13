import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { getExplorerApiUrl } from '../utils/blockchain.utils';

export interface VerifyParams {
  contractAddress: string;
  contractName: string;
  sourceCode: string;
  chainId: number;
  constructorArguments?: string;
}

export interface VerifyResult {
  success: boolean;
  guid?: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class EtherscanVerifyService {
  private readonly apiKey = environment.etherscanApiKey;

  /**
   * Submit source code để verify contract qua Etherscan v2 API.
   * Trả về GUID để poll trạng thái, hoặc error message nếu thất bại.
   */
  async submitVerify(params: VerifyParams): Promise<VerifyResult> {
    const apiUrl = getExplorerApiUrl(params.chainId);
    if (!apiUrl) {
      return { success: false, message: `Không hỗ trợ auto-verify cho chainId ${params.chainId}` };
    }

    const body = new URLSearchParams({
      chainid: params.chainId.toString(),
      codeformat: 'solidity-single-file',
      sourceCode: params.sourceCode,
      contractaddress: params.contractAddress,
      contractname: params.contractName,
      compilerversion: 'v0.8.34+commit.be406b2c',
      optimizationUsed: '1',
      runs: '1',
      viaIR: 'true',
      evmversion: 'cancun',
      licenseType: '3', // MIT
      constructorArguements: params.constructorArguments ?? '',
      apikey: this.apiKey
    });

    try {
      const res = await fetch(`${apiUrl}?chainid=${params.chainId}&module=contract&action=verifysourcecode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
      const json = await res.json();

      if (json.status === '1') {
        return { success: true, guid: json.result, message: 'Đã gửi yêu cầu verify thành công!' };
      }
      return { success: false, message: json.result || json.message || 'Lỗi không xác định từ Etherscan' };
    } catch (err: any) {
      return { success: false, message: 'Network error: ' + (err.message ?? err) };
    }
  }

  /**
   * Poll trạng thái verify bằng GUID (chờ tối đa maxAttempts * 3 giây).
   * Trả về true nếu verified thành công, false nếu thất bại hoặc timeout.
   */
  async pollVerifyStatus(
    guid: string,
    chainId: number,
    maxAttempts = 15
  ): Promise<{ verified: boolean; message: string }> {
    const apiUrl = getExplorerApiUrl(chainId);
    if (!apiUrl) return { verified: false, message: 'chainId không hỗ trợ' };

    for (let i = 0; i < maxAttempts; i++) {
      await this.delay(3000);
      try {
        const res = await fetch(
          `${apiUrl}?chainid=${chainId}&module=contract&action=checkverifystatus&guid=${guid}&apikey=${this.apiKey}`
        );
        const json = await res.json();

        if (json.result === 'Pass - Verified') {
          return { verified: true, message: 'Contract đã được verify thành công trên Explorer!' };
        }
        if (json.result?.includes('Fail') || json.status === '0') {
          return { verified: false, message: json.result || 'Verify thất bại' };
        }
        // Đang pending → tiếp tục poll
      } catch {
        // ignore network hiccup, tiếp tục poll
      }
    }
    return { verified: false, message: 'Timeout: Verify đang xử lý, kiểm tra lại trên Explorer.' };
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
