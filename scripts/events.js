module.exports = {
    getContributionCreatedEvents: async function(CSPlatform) {
        try {
            const filter = CSPlatform.filters.ContributionCreated;
            return await CSPlatform.queryFilter(filter);
        } catch (e) {
            console.log('Failed to get event:', e);
        }
    },


    getContributionAssignedEvents: async function(CSPlatform) {
        try {
            const filter = CSPlatform.filters.ContributionAssigned;
            return await CSPlatform.queryFilter(filter);
        } catch (e) {
            console.log('Failed to get event:', e);
        }
    },


    getCoordinateUpdatedEvents: async function(CSPlatform) {
        try {
            const filter = CSPlatform.filters.CoordinateUpdated;
            return await CSPlatform.queryFilter(filter);
        } catch (e) {
            console.log('Failed to get event:', e);
        }
    }
};
