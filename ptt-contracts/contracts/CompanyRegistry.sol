// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract CompanyRegistry is Ownable {
    struct Company {
        string code;
        string name;
        address governance;
        address token;
        address treasury;
        address fundingManager;
        address distributionManager;
        address marketplace;
        address oracle;
        bool registered;
    }

    mapping(address => Company) public companies; // governance address => Company
    mapping(string => address) public codeToGovernance; // company code => governance address
    address[] public companyList;

    mapping(address => bool) public isFactory;

    event CompanyRegistered(
        string code,
        string name,
        address indexed governance,
        address indexed token,
        address treasury
    );
    event FactoryStatusUpdated(address indexed factory, bool status);

    modifier onlyFactory() {
        require(isFactory[msg.sender] || msg.sender == owner(), "Not authorized factory");
        _;
    }

    constructor() Ownable(msg.sender) {}

    function setFactory(address factory, bool status) external onlyOwner {
        isFactory[factory] = status;
        emit FactoryStatusUpdated(factory, status);
    }

    function registerCompany(
        string calldata code,
        string calldata name,
        address governance,
        address token,
        address treasury,
        address fundingManager,
        address distributionManager,
        address marketplace,
        address oracle
    ) external onlyFactory {
        require(governance != address(0) && token != address(0), "Invalid contract addresses");
        require(!companies[governance].registered, "Company already registered");
        require(codeToGovernance[code] == address(0), "Company code already exists");

        companies[governance] = Company({
            code: code,
            name: name,
            governance: governance,
            token: token,
            treasury: treasury,
            fundingManager: fundingManager,
            distributionManager: distributionManager,
            marketplace: marketplace,
            oracle: oracle,
            registered: true
        });

        codeToGovernance[code] = governance;
        companyList.push(governance);

        emit CompanyRegistered(code, name, governance, token, treasury);
    }

    function getCompanyCount() external view returns (uint256) {
        return companyList.length;
    }

    function getCompanyByCode(string calldata code) external view returns (Company memory) {
        address gov = codeToGovernance[code];
        require(gov != address(0), "Company code not found");
        return companies[gov];
    }
}
