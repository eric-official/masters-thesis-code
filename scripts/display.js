const colors = require("@colors/colors");
const Table = require("cli-table3");
const {ethers} = require("hardhat");
const {getContributionCreatedEvents, getContributionAssignedEvents} = require("./events");

7
module.exports = {

    /**
     * Display created wallets
     * @param participantWallets - Array of wallets for participants to execute transactions
     * @param reviewerWallets - Array of wallets for reviewer to execute transactions
     * @param provider - Ethers provider
     * @returns {Promise<void>}
     * @type {(connectedWallets: Array.<ethers.Wallet>, provider: ethers.HardhatEthersProvider) => Promise<void>}
     */
    displayWallets: async function(participantWallets, reviewerWallets, provider) {
        const columns = [
            colors.blue('Wallet'),
            colors.blue('User Group'),
            colors.blue('Public Key'),
            colors.blue('Private Key'),
            colors.blue('Balance in ETH'),
        ];
        const table = new Table({
            head: columns
        });

        for (let i = 0; i < participantWallets.length; i++) {
            let walletName = "Wallet " + (i + 1);
            let walletAddress = participantWallets[i].address;
            let walletPrivateKey = participantWallets[i].privateKey;
            let walletBalance = await provider.getBalance(participantWallets[i].address);
            table.push([walletName, "Participant", walletAddress, walletPrivateKey, ethers.formatEther(walletBalance)]);
        }

        for (let i = 0; i < reviewerWallets.length; i++) {
            let walletName = "Wallet " + (i + participantWallets.length + 1);
            let walletAddress = reviewerWallets[i].address;
            let walletPrivateKey = reviewerWallets[i].privateKey;
            let walletBalance = await provider.getBalance(reviewerWallets[i].address);
            table.push([walletName, "Reviewer", walletAddress, walletPrivateKey, ethers.formatEther(walletBalance)]);
        }

        console.log(table.toString());
    },


    displayCreatedContributions: async function(CSPlatform) {
        const events = await getContributionCreatedEvents(CSPlatform)

        const columns = [
            colors.blue('Contribution Index'),
            colors.blue('Participant Address'),
            colors.blue('Image'),
        ];
        const table = new Table({
            head: columns
        });

        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            const [participant, image] = event.args;
            table.push([i, participant, image]);
        }

        console.log(table.toString());
    },


    displayAssignedContributions: async function (CSPlatform) {
        const events = await getContributionAssignedEvents(CSPlatform);

        const columns = [
            colors.blue('Contribution Index'),
            colors.blue('Participant Address'),
            colors.blue('Image'),
            colors.blue('Reviewer Address'),
        ];
        const table = new Table({
            head: columns
        });

        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            const [id, participant, image, reviewer] = event.args;
            table.push([id, participant, image, reviewer]);
        }

        console.log(table.toString());
    }
}