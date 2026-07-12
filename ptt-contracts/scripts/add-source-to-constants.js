/**
 * Script: add-source-to-constants.js
 * Mục đích: Đọc các file .flat.sol và thêm trường `sourceCode` vào các file constants của Angular.
 * Chạy: node ptt-contracts/scripts/add-source-to-constants.js
 */

const fs = require('fs');
const path = require('path');

const CONTRACTS = [
  {
    flatFile: 'BoardGovernance.flat.sol',
    contractName: 'BoardGovernance',
    tsFile: path.join(__dirname, '../../ptt-web/src/app/core/constants/contracts/board-governance.ts'),
    exportName: 'BoardGovernance',
  },
  {
    flatFile: 'EquityToken.flat.sol',
    contractName: 'EquityToken',
    tsFile: path.join(__dirname, '../../ptt-web/src/app/core/constants/contracts/equity-token.ts'),
    exportName: 'EquityToken',
  },
  {
    flatFile: 'FinanceManager.flat.sol',
    contractName: 'FinanceManager',
    tsFile: path.join(__dirname, '../../ptt-web/src/app/core/constants/contracts/finance-manager.ts'),
    exportName: 'FinanceManager',
  },
  {
    flatFile: 'Marketplace.flat.sol',
    contractName: 'Marketplace',
    tsFile: path.join(__dirname, '../../ptt-web/src/app/core/constants/contracts/marketplace.ts'),
    exportName: 'Marketplace',
  },
];

const FLATTENED_DIR = path.join(__dirname, '../flattened');

for (const c of CONTRACTS) {
  const flatPath = path.join(FLATTENED_DIR, c.flatFile);
  if (!fs.existsSync(flatPath)) {
    console.warn(`[SKIP] Không tìm thấy: ${flatPath}`);
    continue;
  }

  const sourceCode = fs.readFileSync(flatPath, 'utf8');
  let tsContent = fs.readFileSync(c.tsFile, 'utf8');

  // Kiểm tra đã có sourceCode chưa
  if (tsContent.includes('sourceCode:')) {
    console.log(`[SKIP] ${c.tsFile} đã có sourceCode`);
    continue;
  }

  // Tìm vị trí trường bytecode để chèn sourceCode trước phần đóng object
  // Mẫu: `  bytecode: "..."` ở cuối, thêm `  sourceCode: \`...\`` sau bytecode
  const escaped = sourceCode.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\${/g, '\\${');
  const sourceCodeField = `  sourceCode: \`${escaped}\`\n};`;

  // Thay phần cuối file "};" bằng thêm field sourceCode
  if (!tsContent.trim().endsWith('};')) {
    console.warn(`[WARN] File ${c.tsFile} không kết thúc bằng "};", bỏ qua`);
    continue;
  }

  tsContent = tsContent.trimEnd().slice(0, -2) + ',\n' + sourceCodeField;

  fs.writeFileSync(c.tsFile, tsContent, 'utf8');
  console.log(`[OK] Đã thêm sourceCode vào ${path.basename(c.tsFile)} (${(sourceCode.length / 1024).toFixed(1)} KB)`);
}

console.log('\nHoàn tất! Hãy chạy lại "npm run build" để rebuild Angular DApp.');
