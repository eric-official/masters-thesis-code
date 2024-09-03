require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  hardhat: {
    forking: {
      url: "https://arb-mainnet.g.alchemy.com/v2/UXcKYOqEq7TfeHBznLVeT3MF75LU__2Z",
    }
  }
};
