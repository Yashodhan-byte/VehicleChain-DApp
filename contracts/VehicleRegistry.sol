// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title VehicleRegistry
 * @notice Vehicle registration and ownership transfer on-chain
 * @dev Compiler: 0.8.19 or newer. Network: Sepolia testnet recommended.
 */
contract VehicleRegistry {

    // ───────────── STATE ─────────────

    address public admin;

    struct Vehicle {
        string  vehicleId;
        string  model;
        uint256 year;
        address currentOwner;
        uint256 registrationDate;
        bool    exists;
    }

    mapping(string => Vehicle) private vehicles;
    mapping(string => address[]) private ownershipHistory;

    // ───────────── EVENTS ─────────────

    event VehicleRegistered(
        string  vehicleId,
        address indexed owner,
        uint256 timestamp
    );

    event OwnershipTransferred(
        string  vehicleId,
        address indexed from,
        address indexed to,
        uint256 timestamp
    );

    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);

    // ───────────── MODIFIERS ─────────────

    modifier onlyAdmin() {
        require(msg.sender == admin, "VehicleRegistry: Caller is not the admin");
        _;
    }

    modifier vehicleExists(string calldata _vehicleId) {
        require(vehicles[_vehicleId].exists, "VehicleRegistry: Vehicle does not exist");
        _;
    }

    modifier onlyVehicleOwner(string calldata _vehicleId) {
        require(
            vehicles[_vehicleId].currentOwner == msg.sender,
            "VehicleRegistry: Caller is not the current owner"
        );
        _;
    }

    // ───────────── CONSTRUCTOR ─────────────

    constructor() {
        admin = msg.sender;
    }

    // ───────────── WRITE ─────────────

    function registerVehicle(
        string calldata _vehicleId,
        string calldata _model,
        uint256         _year,
        address         _owner
    ) external onlyAdmin {
        require(bytes(_vehicleId).length > 0, "VehicleRegistry: vehicleId cannot be empty");
        require(bytes(_model).length > 0,     "VehicleRegistry: model cannot be empty");
        // Simple, safe range check (no date math drift)
        require(_year >= 1900 && _year <= 2100, "VehicleRegistry: Invalid year");
        require(_owner != address(0),         "VehicleRegistry: Invalid owner address");
        require(!vehicles[_vehicleId].exists, "VehicleRegistry: Vehicle already registered");

        vehicles[_vehicleId] = Vehicle({
            vehicleId:        _vehicleId,
            model:            _model,
            year:             _year,
            currentOwner:     _owner,
            registrationDate: block.timestamp,
            exists:           true
        });

        ownershipHistory[_vehicleId].push(_owner);

        emit VehicleRegistered(_vehicleId, _owner, block.timestamp);
    }

    function transferOwnership(
        string calldata _vehicleId,
        address         _newOwner
    ) external vehicleExists(_vehicleId) onlyVehicleOwner(_vehicleId) {
        require(_newOwner != address(0), "VehicleRegistry: Invalid new owner address");
        require(_newOwner != msg.sender, "VehicleRegistry: Cannot transfer to yourself");

        address previousOwner = msg.sender;
        vehicles[_vehicleId].currentOwner = _newOwner;
        ownershipHistory[_vehicleId].push(_newOwner);

        emit OwnershipTransferred(_vehicleId, previousOwner, _newOwner, block.timestamp);
    }

    function changeAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "VehicleRegistry: Invalid admin address");
        emit AdminChanged(admin, _newAdmin);
        admin = _newAdmin;
    }

    // ───────────── READ ─────────────

    function getVehicleDetails(string calldata _vehicleId)
        external
        view
        vehicleExists(_vehicleId)
        returns (
            string memory vehicleId,
            string memory model,
            uint256       year,
            address       currentOwner,
            uint256       registrationDate
        )
    {
        Vehicle storage v = vehicles[_vehicleId];
        return (v.vehicleId, v.model, v.year, v.currentOwner, v.registrationDate);
    }

    function getOwnershipHistory(string calldata _vehicleId)
        external
        view
        vehicleExists(_vehicleId)
        returns (address[] memory)
    {
        return ownershipHistory[_vehicleId];
    }

    function getCurrentOwner(string calldata _vehicleId)
        external
        view
        vehicleExists(_vehicleId)
        returns (address)
    {
        return vehicles[_vehicleId].currentOwner;
    }

    function isVehicleRegistered(string calldata _vehicleId)
        external
        view
        returns (bool)
    {
        return vehicles[_vehicleId].exists;
    }

    function getOwnershipCount(string calldata _vehicleId)
        external
        view
        vehicleExists(_vehicleId)
        returns (uint256)
    {
        return ownershipHistory[_vehicleId].length;
    }
}
