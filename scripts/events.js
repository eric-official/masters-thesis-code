module.exports = {

    /**
     * Get all ContributionCreated events
     * @param CSPlatform - CSPlatform contract
     * @returns {Promise<Array.<ethers.EventLog>>}
     * @type {(CSPlatform: CSPlatform) => Promise<Array.<ethers.EventLog>>}
     */
    getContributionCreatedEvents: async function(CSPlatform) {
        try {
            const filter = CSPlatform.filters.ContributionCreated;
            return await CSPlatform.queryFilter(filter);
        } catch (e) {
            console.log('Failed to get event:', e);
        }
    },


    /**
     * Get all ContributionAssigned events
     * @param CSPlatform - CSPlatform contract
     * @returns {Promise<Array<ethers.EventLog>>}
     * @type {(CSPlatform: CSPlatform) => Promise<Array<ethers.EventLog>>}
     */
    getContributionAssignedEvents: async function(CSPlatform) {
        try {
            const filter = CSPlatform.filters.ContributionAssigned;
            return await CSPlatform.queryFilter(filter);
        } catch (e) {
            console.log('Failed to get event:', e);
        }
    },


    /**
     * Get all CoordinateUpdated events
     * @param CSPlatform - CSPlatform contract
     * @returns {Promise<Array<ethers.EventLog>>}
     * @type {(CSPlatform: CSPlatform) => Promise<Array<ethers.EventLog>>}
     */
    getCoordinateUpdatedEvents: async function(CSPlatform) {
        try {
            const filter = CSPlatform.filters.CoordinateUpdated;
            return await CSPlatform.queryFilter(filter);
        } catch (e) {
            console.log('Failed to get event:', e);
        }
    },


    /**
     * Get all ContributionReviewed events
     * @param CSPlatform - CSPlatform contract
     * @param result - filter for a specific result of the review
     * @returns {Promise<Array<ethers.EventLog>>}
     * @type {(CSPlatform: CSPlatform, result: number) => Promise<Array<ethers.EventLog>>}
     */
    getContributionReviewedEvents: async function(CSPlatform, result=NaN) {
        try {
            const filter = CSPlatform.filters.ContributionReviewed;
            const events = await CSPlatform.queryFilter(filter);
            if (result >= 0 && result <= 2) {
                return events.filter(event => Number(event.args.result) === result);
            } else if (isNaN(result)) {
                return events;
            } else {
                return [];
            }
        } catch (e) {
            console.log('Failed to get event:', e);
        }
    },


    /**
     * Get all VerifierUpdated events
     * @param CSPlatform - CSPlatform contract
     * @returns {Promise<Array<ethers.EventLog>>}
     * @type {(CSPlatform: CSPlatform) => Promise<Array<ethers.EventLog>>}
     */
    getVerifierUpdatedEvents: async function(CSPlatform) {
        try {
            const filter = CSPlatform.filters.VerifierUpdated;
            return await CSPlatform.queryFilter(filter);
        } catch (e) {
            console.log('Failed to get event:', e);
        }
    }
};
