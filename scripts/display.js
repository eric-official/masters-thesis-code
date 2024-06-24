const {ethers} = require("hardhat");
const {getContributionCreatedEvents, getContributionAssignedEvents, getCoordinateUpdatedEvents, getContributionReviewedEvents, getVerifierUpdatedEvents} = require("./events");
const {createCliTable, formatCoordinatesFromBytes} = require("./utils");
const colors = require("@colors/colors");
const Table = require("cli-table3");
const eccrypto = require("eccrypto");


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
        const columns = ['Wallet', 'User Group', 'Address', 'Private Key', 'Balance (ETH)'];
        const table = await createCliTable(columns);

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

        const columns = ['Index', 'Participant Address', 'Image'];
        const table = await createCliTable(columns)

        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            const [participant, image] = event.args;
            table.push([i, participant, image]);
        }

        console.log(table.toString());
    },


    displayAssignedContributions: async function (CSPlatform) {
        const events = await getContributionAssignedEvents(CSPlatform);
        const columns = ['Index', 'Participant Address', 'Reviewer Address', 'Image'];
        const table = await createCliTable(columns);

        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            const [id, participant, reviewer, image] = event.args;
            table.push([id, participant, reviewer, image]);
        }

        console.log(table.toString());
    },


    displayUpdatedCoordinates: async function(CSPlatform) {
        const events = await getCoordinateUpdatedEvents(CSPlatform);

        const columns = ['Index', 'Participant Address', 'Reviewer Address', 'Image', 'Coordinates'];
        const table = await createCliTable(columns);

        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            const [id, participant, reviewer, image, coordinates] = event.args;
            table.push([id, participant, reviewer, image, coordinates]);
        }

        console.log(table.toString());
    },


    displayDecryptedCoordinates: async function(CSPlatform, participantWallets, reviewerWallets) {
        const events = await getCoordinateUpdatedEvents(CSPlatform)

        const columns = ['Index', 'Participant Address', 'Reviewer Address', 'Image', 'Coordinates'];
        const table = await createCliTable(columns);

        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            const [id, participant, reviewer, image, coordinates] = event.args;

            let reviewerIndex = reviewerWallets.findIndex(wallet => wallet.address === reviewer);
            let receiverPrivateKey = Buffer.from(reviewerWallets[reviewerIndex].privateKey.slice(2), 'hex');

            let encryptedCoordinates = await formatCoordinatesFromBytes(coordinates);
            let decryptedCoordinates = await eccrypto.decrypt(receiverPrivateKey, encryptedCoordinates);
            decryptedCoordinates = decryptedCoordinates.toString();

            table.push([id, participant, reviewer, image, decryptedCoordinates]);
        }

        console.log(table.toString());
    },


    displayReviewedContributions: async function(CSPlatform) {
        const events = await getContributionReviewedEvents(CSPlatform);

        const columns = ['Index', 'Participant Address', 'Reviewer Address', 'Image', 'Result'];
        const table = await createCliTable(columns);

        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            const [id, participant, reviewer, image, result] = event.args;
            table.push([id, participant, reviewer, image, result]);
        }

        console.log(table.toString());
    },


    displayUpdatedVerifiers: async function(CSPlatform) {
        const events = await getVerifierUpdatedEvents(CSPlatform);

        const columns = ['Index', 'Participant Address', 'Reviewer Address', 'Image', 'Verifier'];
        const table = await createCliTable(columns);

        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            const [id, participant, reviewer, image, verifier] = event.args;
            table.push([id, participant, reviewer, image, verifier]);
        }

        console.log(table.toString());
    }
}