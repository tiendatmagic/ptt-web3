
pragma solidity ^0.8.34;

contract BoardGovernance {
    struct Proposal {
        uint256 id;
        address target;
        uint256 value;
        bytes data;
        string description;
        uint256 voteCount;
        uint256 effectiveDate;
        uint256 expirationDate;
        bool executed;
        bool cancelled;
        uint256 thresholdSnapshot;
    }

    address[] private _members;
    mapping(address => bool) public isMember;
    uint256 public threshold;
    uint256 public proposalCount;

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event MemberAdded(address indexed member);
    event MemberRemoved(address indexed member);
    event ThresholdChanged(uint256 newThreshold);
    event ProposalCreated(uint256 indexed id, address indexed target, string description);
    event ProposalSigned(uint256 indexed id, address indexed member);
    event ProposalExecuted(uint256 indexed id);
    event ProposalCancelled(uint256 indexed id);

    modifier onlyMember() {
        require(isMember[msg.sender], "Not a board member");
        _;
    }

    modifier onlySelf() {
        require(msg.sender == address(this), "Only governance can execute this");
        _;
    }

    constructor(address[] memory initialMembers, uint256 initialThreshold) {
        require(initialMembers.length > 0, "Members required");
        require(initialThreshold > 0 && initialThreshold <= initialMembers.length, "Invalid threshold");

        for (uint256 i = 0; i < initialMembers.length; i++) {
            address member = initialMembers[i];
            require(member != address(0), "Invalid member address");
            require(!isMember[member], "Duplicate member");
            isMember[member] = true;
            _members.push(member);
            emit MemberAdded(member);
        }
        threshold = initialThreshold;
        emit ThresholdChanged(initialThreshold);
    }

    function getMembers() external view returns (address[] memory) {
        return _members;
    }

    function createProposal(
        address target,
        uint256 value,
        bytes memory data,
        string memory description,
        uint256 delaySeconds,
        uint256 durationSeconds
    ) external onlyMember returns (uint256) {
        proposalCount++;
        uint256 proposalId = proposalCount;

        proposals[proposalId] = Proposal({
            id: proposalId,
            target: target,
            value: value,
            data: data,
            description: description,
            voteCount: 0,
            effectiveDate: block.timestamp + delaySeconds,
            expirationDate: durationSeconds > 0 ? block.timestamp + delaySeconds + durationSeconds : 0,
            executed: false,
            cancelled: false,
            thresholdSnapshot: threshold
        });

        emit ProposalCreated(proposalId, target, description);

        signProposal(proposalId);

        return proposalId;
    }

    function signProposal(uint256 proposalId) public onlyMember {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.executed, "Proposal already executed");
        require(!proposal.cancelled, "Proposal cancelled");
        require(proposal.expirationDate == 0 || block.timestamp <= proposal.expirationDate, "Proposal expired");
        require(!hasVoted[proposalId][msg.sender], "Already signed");

        hasVoted[proposalId][msg.sender] = true;
        proposal.voteCount++;

        emit ProposalSigned(proposalId, msg.sender);
    }

    function executeProposal(uint256 proposalId) external returns (bytes memory) {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.executed, "Proposal already executed");
        require(!proposal.cancelled, "Proposal cancelled");
        require(block.timestamp >= proposal.effectiveDate, "Proposal not active yet");
        require(proposal.expirationDate == 0 || block.timestamp <= proposal.expirationDate, "Proposal expired");
        require(proposal.voteCount >= threshold, "Not enough signatures");

        proposal.executed = true;

        (bool success, bytes memory returnData) = proposal.target.call{value: proposal.value}(proposal.data);
        require(success, "Execution failed");

        emit ProposalExecuted(proposalId);
        return returnData;
    }

    function cancelProposal(uint256 proposalId) external onlyMember {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.executed, "Proposal already executed");
        require(!proposal.cancelled, "Proposal already cancelled");

        proposal.cancelled = true;
        emit ProposalCancelled(proposalId);
    }

    function addMember(address member) external onlySelf {
        require(member != address(0), "Invalid address");
        require(!isMember[member], "Already a member");
        isMember[member] = true;
        _members.push(member);
        emit MemberAdded(member);
    }

    function removeMember(address member) external onlySelf {
        require(isMember[member], "Not a member");
        require(_members.length > 1, "Cannot remove last member");

        isMember[member] = false;

        for (uint256 i = 0; i < _members.length; i++) {
            if (_members[i] == member) {
                _members[i] = _members[_members.length - 1];
                _members.pop();
                break;
            }
        }
        emit MemberRemoved(member);

        if (threshold > _members.length) {
            threshold = _members.length;
            emit ThresholdChanged(threshold);
        }
    }

    function changeThreshold(uint256 newThreshold) external onlySelf {
        require(newThreshold > 0 && newThreshold <= _members.length, "Invalid threshold");
        threshold = newThreshold;
        emit ThresholdChanged(newThreshold);
    }

    function getProposalThreshold(uint256 proposalId) external view returns (uint256) {
        return proposals[proposalId].thresholdSnapshot;
    }

    receive() external payable {}
}
